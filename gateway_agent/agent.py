"""
NetBridge local gateway helper.

- Controls Windows Mobile Hotspot
- Serves the join app to friends on the shared WiFi (works without upstream internet)
- Proxies /api to Django on this PC
"""

from __future__ import annotations

import ctypes
import json
import mimetypes
import os
import secrets
import string
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib import error, parse, request
from urllib.error import HTTPError, URLError

AGENT_HOST = os.environ.get("NETBRIDGE_AGENT_HOST", "0.0.0.0")
AGENT_PORT = int(os.environ.get("NETBRIDGE_AGENT_PORT", "8765"))
API_BASE = os.environ.get("NETBRIDGE_API_URL", "http://127.0.0.1:8000/api")
ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
SCRIPT = ROOT / "scripts" / "hotspot.ps1"
WEB_DIST = Path(os.environ.get("NETBRIDGE_WEB_DIST", PROJECT_ROOT / "frontend" / "dist"))
STATE_LOCK = threading.Lock()
HOTSPOT_LOCK = threading.Lock()
STATUS_CACHE_LOCK = threading.Lock()
STATUS_CACHE: dict = {"at": 0.0, "payload": None}
STATUS_CACHE_TTL_SEC = 4.0
STATE = {
    "auth_token": None,
    "device_name": None,
}


def is_admin() -> bool:
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:  # noqa: BLE001
        return False


def make_hotspot_credentials() -> tuple[str, str]:
    suffix = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(4))
    alphabet = string.ascii_letters + string.digits
    password = "".join(secrets.choice(alphabet) for _ in range(12))
    return f"NetBridge-{suffix}", password


def ensure_join_firewall() -> None:
    try:
        subprocess.run(
            [
                "netsh",
                "advfirewall",
                "firewall",
                "add",
                "rule",
                "name=NetBridge Join Portal",
                "dir=in",
                "action=allow",
                "protocol=TCP",
                f"localport={AGENT_PORT}",
                "profile=any",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
    except Exception:  # noqa: BLE001
        pass


def run_hotspot(action: str, ssid: str = "", password: str = "") -> dict:
    cmd = [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(SCRIPT),
        "-Action",
        action,
    ]
    if ssid:
        cmd.extend(["-Ssid", ssid])
    if password:
        cmd.extend(["-Password", password])

    # Only one hotspot script at a time (status/connect/disconnect share WinRT).
    with HOTSPOT_LOCK:
        completed = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            env={
                **os.environ,
                "TERM": "dumb",
            },
        )
    raw = (completed.stdout or "").strip() or (completed.stderr or "").strip()
    if not raw:
        return {
            "ok": False,
            "error": f"Hotspot script returned no output (exit {completed.returncode}).",
        }

    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    payload_line = next((line for line in reversed(lines) if line.startswith("{")), lines[-1])
    try:
        data = json.loads(payload_line)
    except json.JSONDecodeError:
        return {
            "ok": False,
            "error": f"Could not parse hotspot status: {payload_line[:240]}",
        }

    if completed.returncode != 0 and data.get("ok") is not False:
        data["ok"] = False
        data.setdefault("error", f"Hotspot command failed with exit {completed.returncode}.")
    return data


def get_status_cached(force: bool = False) -> dict:
    now = time.monotonic()
    with STATUS_CACHE_LOCK:
        cached = STATUS_CACHE.get("payload")
        age = now - float(STATUS_CACHE.get("at") or 0)
        if not force and cached is not None and age < STATUS_CACHE_TTL_SEC:
            return cached

    local = run_hotspot("status")
    with STATUS_CACHE_LOCK:
        STATUS_CACHE["at"] = time.monotonic()
        STATUS_CACHE["payload"] = local
    return local


def invalidate_status_cache() -> None:
    with STATUS_CACHE_LOCK:
        STATUS_CACHE["at"] = 0.0
        STATUS_CACHE["payload"] = None


def post_cloud(path: str, token: str, body: dict) -> dict:
    req = request.Request(
        f"{API_BASE}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def sync_cloud(local: dict, token: str, device_name: str | None = None) -> dict:
    privacy_ok = bool(local.get("privacy_shield_active")) or (
        bool(local.get("nat_active")) and bool(local.get("hotspot_active"))
    )
    live = bool(local.get("has_internet") and local.get("hotspot_active") and privacy_ok)
    payload = {
        "device_name": device_name or local.get("hostname") or "My PC",
        "hostname": local.get("hostname", ""),
        "has_internet": bool(local.get("has_internet")),
        "hotspot_active": bool(local.get("hotspot_active")),
        "hotspot_ssid": local.get("hotspot_ssid") or "",
        "hotspot_password": local.get("hotspot_password") or "",
        "gateway_lan_ip": local.get("gateway_lan_ip") or "",
        "uplink_profile": local.get("uplink_profile") or "",
        "uplink_alias": local.get("uplink_alias") or "",
        "uplink_ipv4": local.get("uplink_ipv4") or "",
        "uplink_mac": local.get("uplink_mac") or "",
        "share_mode": local.get("share_mode") or "windows_mobile_hotspot_nat",
        "client_count": int(local.get("client_count") or 0),
        "nat_active": bool(local.get("nat_active")),
        "ipv6_leak_blocked": bool(local.get("ipv6_leak_blocked")),
        "privacy_shield_active": bool(local.get("privacy_shield_active") or privacy_ok),
        "client_isolation_active": bool(local.get("client_isolation_active")),
        "privacy_notes": local.get("privacy_notes") or "",
        "hotspot_band": local.get("hotspot_band") or "",
        "coverage_optimized": bool(local.get("coverage_optimized")),
        "coverage_notes": local.get("coverage_notes") or "",
        "is_connected": live,
    }
    return post_cloud("/gateway/agent/sync/", token, payload)


def proxy_api(method: str, path_with_query: str, body: bytes | None, headers: dict) -> tuple[int, dict, bytes]:
    """Forward /api/* to Django on this PC (has uplink even if phones don't)."""
    parsed = parse.urlparse(path_with_query)
    api_path = parsed.path
    if not api_path.startswith("/api"):
        api_path = f"/api{api_path}"
    # Django expects trailing slashes on our API routes
    if not api_path.endswith("/"):
        api_path = f"{api_path}/"
    suffix = api_path[4:]  # drop '/api'
    target = f"{API_BASE.rstrip('/')}{suffix}"
    if parsed.query:
        target = f"{target}?{parsed.query}"

    req_headers = {"Content-Type": "application/json"}
    auth = headers.get("Authorization") or headers.get("authorization")
    if auth:
        req_headers["Authorization"] = auth

    req = request.Request(target, data=body if method != "GET" else None, headers=req_headers, method=method)
    try:
        with request.urlopen(req, timeout=45) as resp:
            payload = resp.read()
            return resp.status, dict(resp.headers), payload
    except HTTPError as exc:
        return exc.code, dict(exc.headers or {}), exc.read()
    except URLError as exc:
        return 502, {"Content-Type": "application/json"}, json.dumps(
            {"detail": f"API unavailable: {exc.reason}"}
        ).encode("utf-8")


class AgentHandler(BaseHTTPRequestHandler):
    server_version = "NetBridgeGatewayAgent/1.0"

    def _cors(self):
        origin = self.headers.get("Origin", "*")
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Credentials", "true")

    def _client_gone(self, exc: BaseException) -> bool:
        return isinstance(
            exc,
            (
                ConnectionAbortedError,
                ConnectionResetError,
                BrokenPipeError,
                TimeoutError,
            ),
        )

    def _json(self, code: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        try:
            self.send_response(code)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as exc:  # noqa: BLE001
            if self._client_gone(exc):
                return
            raise

    def _send_bytes(self, code: int, body: bytes, content_type: str, extra_headers: dict | None = None):
        try:
            self.send_response(code)
            self._cors()
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            if extra_headers:
                for key, value in extra_headers.items():
                    if key.lower() in {"content-length", "transfer-encoding", "connection"}:
                        continue
                    self.send_header(key, value)
            self.end_headers()
            self.wfile.write(body)
        except Exception as exc:  # noqa: BLE001
            if self._client_gone(exc):
                return
            raise

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return b""
        return self.rfile.read(length)

    def _read_json(self) -> dict:
        raw = self._read_body()
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))

    def _serve_static(self, url_path: str) -> bool:
        if not WEB_DIST.exists():
            return False

        clean = parse.urlparse(url_path).path
        if clean in {"", "/"}:
            clean = "/index.html"
        # SPA routes
        if clean in {"/join", "/dependant", "/login", "/signup", "/gateway"} or not Path(clean).suffix:
            candidate = WEB_DIST / "index.html"
        else:
            candidate = (WEB_DIST / clean.lstrip("/")).resolve()
            try:
                candidate.relative_to(WEB_DIST.resolve())
            except ValueError:
                return False

        if not candidate.exists() or not candidate.is_file():
            candidate = WEB_DIST / "index.html"
            if not candidate.exists():
                return False

        data = candidate.read_bytes()
        content_type = mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
        if candidate.name == "index.html":
            content_type = "text/html; charset=utf-8"
        self._send_bytes(200, data, content_type)
        return True

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = parse.urlparse(self.path)
        path = parsed.path

        if path.rstrip("/") == "/health":
            self._json(
                200,
                {
                    "ok": True,
                    "service": "netbridge-gateway-agent",
                    "is_admin": is_admin(),
                    "web_ready": WEB_DIST.exists(),
                    "join_path": "/join",
                },
            )
            return

        if path.rstrip("/") == "/status":
            local = get_status_cached()
            auth = self.headers.get("Authorization", "")
            header_token = auth.replace("Bearer ", "").strip() if auth else ""
            with STATE_LOCK:
                token = header_token or STATE["auth_token"]
                device_name = STATE["device_name"]
                if header_token:
                    STATE["auth_token"] = header_token
            cloud = None
            if token and local.get("ok"):
                try:
                    cloud = sync_cloud(local, token, device_name)
                except Exception as exc:  # noqa: BLE001
                    cloud = {"error": str(exc)}
            self._json(
                200 if local.get("ok") else 503,
                {"local": local, "cloud": cloud, "agent_running": True},
            )
            return

        if path.startswith("/api/"):
            status, headers, body = proxy_api("GET", self.path, None, dict(self.headers))
            content_type = headers.get("Content-Type", "application/json")
            self._send_bytes(status, body, content_type)
            return

        if self._serve_static(self.path):
            return

        # Fallback join tip if frontend not built yet
        if path.rstrip("/") in {"", "/", "/join"}:
            html = """<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>NetBridge Join</title>
            <style>body{font-family:system-ui;background:#0b1f1c;color:#f3f7f5;padding:2rem;max-width:28rem;margin:auto}a{color:#e8f56b}</style></head>
            <body><h1>NetBridge</h1><p>Join app is not built yet on this PC.</p>
            <p>On the gateway computer run: <code>cd frontend && npm run build</code></p>
            <p>Then restart the helper and open <a href="/join">/join</a> again.</p></body></html>"""
            self._send_bytes(200, html.encode("utf-8"), "text/html; charset=utf-8")
            return

        self._json(404, {"ok": False, "error": "Not found"})

    def do_POST(self):
        parsed = parse.urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path.startswith("/api"):
            body = self._read_body()
            status, headers, payload = proxy_api("POST", self.path, body, dict(self.headers))
            content_type = headers.get("Content-Type", "application/json")
            self._send_bytes(status, payload, content_type)
            return

        try:
            data = self._read_json() if int(self.headers.get("Content-Length", "0") or 0) else {}
        except json.JSONDecodeError:
            # body already consumed incorrectly — re-read not possible; handle empty
            self._json(400, {"ok": False, "error": "Invalid JSON body"})
            return

        if path == "/ensure-wifi":
            token = data.get("token") or self.headers.get("Authorization", "").replace("Bearer ", "")
            if not token:
                self._json(401, {"ok": False, "error": "Auth token required"})
                return
            device_name = (data.get("device_name") or "").strip() or None
            ssid, password = make_hotspot_credentials()
            local = run_hotspot("start", ssid=ssid, password=password)
            invalidate_status_cache()
            if not local.get("ok") or not local.get("hotspot_active"):
                self._json(
                    500,
                    {
                        "ok": False,
                        "local": local,
                        "error": local.get("error") or "Could not prepare shared WiFi.",
                    },
                )
                return
            # Always keep explicit password we just set
            local["hotspot_ssid"] = local.get("hotspot_ssid") or ssid
            local["hotspot_password"] = password
            try:
                cloud = sync_cloud(local, token, device_name)
            except Exception as exc:  # noqa: BLE001
                self._json(502, {"ok": False, "error": str(exc), "local": local})
                return
            with STATE_LOCK:
                STATE["auth_token"] = token
                if device_name:
                    STATE["device_name"] = device_name
            self._json(200, {"ok": True, "local": local, "cloud": cloud})
            return

        if path == "/connect":
            token = data.get("token") or self.headers.get("Authorization", "").replace("Bearer ", "")
            if not token:
                self._json(401, {"ok": False, "error": "Auth token required"})
                return

            device_name = (data.get("device_name") or "").strip() or None
            ssid = (data.get("hotspot_ssid") or "").strip()
            password = (data.get("hotspot_password") or "").strip()
            if not ssid or not password or len(password) < 8:
                ssid, password = make_hotspot_credentials()

            local = run_hotspot("start", ssid=ssid, password=password)
            invalidate_status_cache()
            if not local.get("ok"):
                self._json(500, {"ok": False, "local": local, "error": local.get("error")})
                return
            if not local.get("has_internet"):
                self._json(400, {"ok": False, "local": local, "error": "Connect this computer to WiFi first, then start sharing."})
                return
            if not local.get("hotspot_active"):
                self._json(500, {"ok": False, "local": local, "error": "Could not start sharing yet. Please try again."})
                return
            if not (local.get("privacy_shield_active") or (local.get("nat_active") and local.get("hotspot_active"))):
                self._json(500, {"ok": False, "local": local, "error": "Sharing is not ready yet. Please try again."})
                return
            if not local.get("client_isolation_active"):
                self._json(
                    403,
                    {
                        "ok": False,
                        "local": local,
                        "error": "Please start the NetBridge helper with Administrator permission (gateway_agent\\start_agent.bat) so friends only get internet.",
                    },
                )
                return

            try:
                cloud = sync_cloud(local, token, device_name)
            except error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="replace")
                self._json(exc.code, {"ok": False, "error": detail, "local": local})
                return
            except Exception as exc:  # noqa: BLE001
                self._json(502, {"ok": False, "error": str(exc), "local": local})
                return

            with STATE_LOCK:
                STATE["auth_token"] = token
                STATE["device_name"] = device_name or local.get("hostname")

            self._json(200, {"ok": True, "local": local, "cloud": cloud})
            return

        if path == "/disconnect":
            token = data.get("token") or self.headers.get("Authorization", "").replace("Bearer ", "")
            local = run_hotspot("stop")
            invalidate_status_cache()
            cloud = None
            if token:
                try:
                    payload = {
                        **local,
                        "has_internet": bool(local.get("has_internet")),
                        "hotspot_active": False,
                        "is_connected": False,
                    }
                    cloud = sync_cloud(payload, token, STATE.get("device_name"))
                except Exception as exc:  # noqa: BLE001
                    cloud = {"error": str(exc)}
            with STATE_LOCK:
                STATE["auth_token"] = None
            self._json(200 if local.get("ok") else 500, {"ok": bool(local.get("ok")), "local": local, "cloud": cloud})
            return

        self._json(404, {"ok": False, "error": "Not found"})

    def log_message(self, fmt: str, *args):
        # Keep health quieter — gateway page polls it often.
        try:
            msg = fmt % args
        except Exception:  # noqa: BLE001
            msg = str(fmt)
        if " /health " in msg:
            return
        sys.stdout.write("[helper] " + msg + "\n")

    def handle_error(self, request, client_address):
        exc = sys.exc_info()[1]
        if isinstance(
            exc,
            (ConnectionAbortedError, ConnectionResetError, BrokenPipeError, TimeoutError),
        ):
            return
        super().handle_error(request, client_address)


def main():
    if not SCRIPT.exists():
        raise SystemExit(f"Missing hotspot script: {SCRIPT}")

    ensure_join_firewall()
    admin = is_admin()
    server = ThreadingHTTPServer((AGENT_HOST, AGENT_PORT), AgentHandler)
    print(f"NetBridge helper listening on http://0.0.0.0:{AGENT_PORT}")
    print(f"Friend join page: http://192.168.137.1:{AGENT_PORT}/join (on your shared WiFi)")
    if WEB_DIST.exists():
        print(f"Serving app from {WEB_DIST}")
    else:
        print("Run 'npm run build' inside frontend so friends can open /join offline.")
    if admin:
        print("Protection mode: friends get internet only.")
    else:
        print("Tip: use gateway_agent\\start_agent.bat as Administrator for full protection.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nHelper stopped.")


if __name__ == "__main__":
    main()

"""Forward DNS from hotspot clients (UDP/53) to public resolvers."""

from __future__ import annotations

import socket
import threading

UPSTREAMS = (("8.8.8.8", 53), ("1.1.1.1", 53), ("8.8.4.4", 53))
LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 53
TIMEOUT_SEC = 4.0

_started = False
_lock = threading.Lock()


def _relay_once(data: bytes, addr: tuple[str, int], sock: socket.socket) -> None:
    for upstream in UPSTREAMS:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as upstream_sock:
                upstream_sock.settimeout(TIMEOUT_SEC)
                upstream_sock.sendto(data, upstream)
                response, _ = upstream_sock.recvfrom(4096)
                sock.sendto(response, addr)
                return
        except OSError:
            continue


def _serve_loop() -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind((LISTEN_HOST, LISTEN_PORT))
    except OSError as exc:
        print(f"[dns-proxy] Could not bind UDP/{LISTEN_PORT} ({exc}). ICS may already own DNS.")
        return

    print(f"[dns-proxy] Hotspot DNS forwarder on {LISTEN_HOST}:{LISTEN_PORT} → 8.8.8.8")
    while True:
        try:
            data, addr = sock.recvfrom(4096)
        except OSError:
            break
        threading.Thread(
            target=_relay_once,
            args=(data, addr, sock),
            daemon=True,
        ).start()


def start_dns_proxy() -> bool:
    global _started
    with _lock:
        if _started:
            return True
        thread = threading.Thread(target=_serve_loop, daemon=True, name="netbridge-dns-proxy")
        thread.start()
        _started = True
        return True

import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .models import ConnectionRequest, GatewayDevice, InviteCode

User = get_user_model()


def invite_ttl():
    return getattr(settings, "INVITE_CODE_TTL_SECONDS", 120)


def generate_invite_code():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(6))
        if not InviteCode.objects.filter(code=code).exists():
            return code


def get_or_create_gateway_device(user):
    device, _ = GatewayDevice.objects.get_or_create(
        owner=user,
        defaults={"device_name": "My PC"},
    )
    return device


def sync_gateway_from_agent(user, payload: dict):
    """
    Only the local PC agent can mark a gateway connected.
    Requires real internet + active Mobile Hotspot + NAT concealment
    so the voucher router only sees this PC.
    """
    device = get_or_create_gateway_device(user)
    now = timezone.now()

    has_internet = bool(payload.get("has_internet"))
    hotspot_active = bool(payload.get("hotspot_active"))
    nat_active = bool(payload.get("nat_active"))
    privacy_shield_active = bool(payload.get("privacy_shield_active")) or nat_active
    want_connected = (
        bool(payload.get("is_connected"))
        and has_internet
        and hotspot_active
        and privacy_shield_active
    )

    device.device_name = payload.get("device_name") or device.device_name or "My PC"
    device.hostname = payload.get("hostname") or device.hostname
    device.has_internet = has_internet
    device.hotspot_active = hotspot_active
    if payload.get("hotspot_ssid"):
        device.hotspot_ssid = payload.get("hotspot_ssid") or device.hotspot_ssid
    if payload.get("hotspot_password"):
        device.hotspot_password = payload.get("hotspot_password") or ""
    if payload.get("gateway_lan_ip"):
        device.gateway_lan_ip = payload.get("gateway_lan_ip") or device.gateway_lan_ip
    device.uplink_profile = payload.get("uplink_profile") or ""
    device.uplink_alias = payload.get("uplink_alias") or ""
    device.uplink_ipv4 = payload.get("uplink_ipv4") or ""
    device.uplink_mac = payload.get("uplink_mac") or ""
    device.share_mode = payload.get("share_mode") or ""
    device.client_count = int(payload.get("client_count") or 0)
    device.nat_active = nat_active
    device.ipv6_leak_blocked = bool(payload.get("ipv6_leak_blocked"))
    device.privacy_shield_active = privacy_shield_active
    device.client_isolation_active = bool(payload.get("client_isolation_active"))
    device.privacy_notes = payload.get("privacy_notes") or ""
    if payload.get("hotspot_band"):
        device.hotspot_band = payload.get("hotspot_band") or device.hotspot_band
    if "coverage_optimized" in payload:
        device.coverage_optimized = bool(payload.get("coverage_optimized"))
    if payload.get("coverage_notes"):
        device.coverage_notes = payload.get("coverage_notes") or device.coverage_notes
    device.agent_last_seen = now

    if want_connected:
        if not device.is_connected:
            device.connected_at = now
        device.is_connected = True
        device.disconnected_at = None
    else:
        was_connected = device.is_connected
        if was_connected:
            device.disconnected_at = now
        device.is_connected = False
        if was_connected or not hotspot_active:
            ConnectionRequest.objects.filter(
                gateway=user,
                status=ConnectionRequest.Status.CONNECTED,
            ).update(
                status=ConnectionRequest.Status.DISCONNECTED,
                disconnected_at=now,
                disconnect_reason="gateway_offline",
                responded_at=now,
            )

    device.save()
    expire_stale_sessions(gateway=user)
    return device


def disconnect_gateway(user):
    """Stop sharing on this PC and end every dependant session."""
    now = timezone.now()
    device = get_or_create_gateway_device(user)
    device.is_connected = False
    device.hotspot_active = False
    device.has_internet = False
    device.disconnected_at = now
    device.save(
        update_fields=[
            "is_connected",
            "hotspot_active",
            "has_internet",
            "disconnected_at",
            "updated_at",
        ]
    )
    ConnectionRequest.objects.filter(
        gateway=user,
        status=ConnectionRequest.Status.CONNECTED,
    ).update(
        status=ConnectionRequest.Status.DISCONNECTED,
        disconnected_at=now,
        disconnect_reason="gateway_offline",
        responded_at=now,
    )
    return device


def normalize_session_minutes(value):
    """None or 0 = unlimited. Otherwise clamp to a sane range."""
    if value is None:
        return None
    minutes = int(value)
    if minutes <= 0:
        return None
    return max(5, min(minutes, 24 * 60))


def apply_session_window(request_obj, session_minutes, now=None):
    now = now or timezone.now()
    minutes = normalize_session_minutes(session_minutes)
    request_obj.session_minutes = minutes
    if minutes:
        request_obj.session_expires_at = now + timedelta(minutes=minutes)
    else:
        request_obj.session_expires_at = None


def expire_stale_sessions(*, gateway=None, dependant=None):
    """
    End timed sessions that ran out. Returns how many were expired.
    Callers (gateway kick UI) may rotate WiFi password when count > 0.
    """
    now = timezone.now()
    qs = ConnectionRequest.objects.filter(
        status=ConnectionRequest.Status.CONNECTED,
        session_expires_at__isnull=False,
        session_expires_at__lte=now,
    )
    if gateway is not None:
        qs = qs.filter(gateway=gateway)
    if dependant is not None:
        qs = qs.filter(dependant=dependant)
    return qs.update(
        status=ConnectionRequest.Status.DISCONNECTED,
        disconnected_at=now,
        disconnect_reason="expired",
        responded_at=now,
    )


def end_connection(request_obj, *, reason: str, now=None):
    now = now or timezone.now()
    request_obj.status = ConnectionRequest.Status.DISCONNECTED
    request_obj.disconnected_at = now
    request_obj.disconnect_reason = reason
    request_obj.responded_at = now
    request_obj.save(
        update_fields=[
            "status",
            "disconnected_at",
            "disconnect_reason",
            "responded_at",
        ]
    )
    return request_obj


def create_invite_code(user):
    device = get_or_create_gateway_device(user)
    if not (device.is_connected and device.hotspot_active):
        raise ValueError(
            "Start sharing on this computer first, then create a code."
        )
    if not device.privacy_shield_active and not device.nat_active:
        raise ValueError(
            "Sharing is not ready yet. Start sharing on this computer, then try again."
        )

    InviteCode.objects.filter(
        gateway=user,
        used_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).update(used_at=timezone.now())

    code = generate_invite_code()
    invite = InviteCode.objects.create(
        gateway=user,
        code=code,
        expires_at=timezone.now() + timedelta(seconds=invite_ttl()),
    )
    return invite


def get_valid_invite(code):
    normalized = code.strip().upper()
    try:
        invite = InviteCode.objects.select_related("gateway").get(code=normalized)
    except InviteCode.DoesNotExist:
        return None

    if invite.used_at is not None:
        return None
    if invite.expires_at <= timezone.now():
        return None
    return invite


@transaction.atomic
def request_connection(dependant, code):
    invite = get_valid_invite(code)
    if invite is None:
        raise ValueError("Invalid or expired invite code.")

    gateway_device = get_or_create_gateway_device(invite.gateway)
    if not (gateway_device.is_connected and gateway_device.hotspot_active):
        raise ValueError("That gateway is not sharing WiFi right now.")

    if dependant.id == invite.gateway_id:
        raise ValueError("You cannot connect to your own gateway.")

    existing_pending = ConnectionRequest.objects.filter(
        dependant=dependant,
        status=ConnectionRequest.Status.PENDING,
    ).first()
    if existing_pending:
        raise ValueError("You already have a pending connection request.")

    invite.used_at = timezone.now()
    invite.save(update_fields=["used_at"])

    request_obj = ConnectionRequest.objects.create(
        gateway=invite.gateway,
        dependant=dependant,
        invite_code=invite.code,
        status=ConnectionRequest.Status.PENDING,
    )
    return request_obj


@transaction.atomic
def respond_to_request(gateway_user, request_id, approve, session_minutes=None):
    try:
        request_obj = ConnectionRequest.objects.select_related("dependant").get(
            id=request_id,
            gateway=gateway_user,
        )
    except ConnectionRequest.DoesNotExist:
        raise ValueError("Connection request not found.")

    if request_obj.status != ConnectionRequest.Status.PENDING:
        raise ValueError("This request has already been handled.")

    now = timezone.now()
    request_obj.responded_at = now
    if approve:
        device = get_or_create_gateway_device(gateway_user)
        # hotspot_active + credentials are enough; is_connected can lag after agent sync
        if not device.hotspot_active:
            raise ValueError(
                "Start sharing on this computer first, then approve your friend."
            )
        if not device.hotspot_ssid or not device.hotspot_password:
            raise ValueError(
                "Shared WiFi password is missing. Tap Start sharing again, then approve."
            )

        ConnectionRequest.objects.filter(
            dependant=request_obj.dependant,
            status=ConnectionRequest.Status.CONNECTED,
        ).update(
            status=ConnectionRequest.Status.DISCONNECTED,
            disconnected_at=now,
            disconnect_reason="replaced",
            responded_at=now,
        )

        request_obj.status = ConnectionRequest.Status.CONNECTED
        request_obj.connected_at = now
        request_obj.disconnected_at = None
        request_obj.disconnect_reason = ""
        apply_session_window(request_obj, session_minutes, now=now)
    else:
        request_obj.status = ConnectionRequest.Status.DENIED

    request_obj.save()
    return request_obj


@transaction.atomic
def gateway_disconnect_dependant(gateway_user, request_id):
    """Gateway ends one friend's session while sharing stays on."""
    expire_stale_sessions(gateway=gateway_user)
    try:
        request_obj = ConnectionRequest.objects.select_related("dependant", "gateway").get(
            id=request_id,
            gateway=gateway_user,
        )
    except ConnectionRequest.DoesNotExist:
        raise ValueError("Connection not found.")

    if request_obj.status != ConnectionRequest.Status.CONNECTED:
        raise ValueError("That friend is not connected right now.")

    end_connection(request_obj, reason="gateway")
    # Caller should rotate hotspot password so the friend loses real WiFi access.
    return request_obj, True


@transaction.atomic
def gateway_set_session(gateway_user, request_id, session_minutes):
    expire_stale_sessions(gateway=gateway_user)
    try:
        request_obj = ConnectionRequest.objects.select_related("dependant", "gateway").get(
            id=request_id,
            gateway=gateway_user,
        )
    except ConnectionRequest.DoesNotExist:
        raise ValueError("Connection not found.")

    if request_obj.status != ConnectionRequest.Status.CONNECTED:
        raise ValueError("That friend is not connected right now.")

    apply_session_window(request_obj, session_minutes)
    request_obj.save(
        update_fields=["session_minutes", "session_expires_at"]
    )
    return request_obj


@transaction.atomic
def dependant_disconnect_self(dependant_user):
    """Friend ends their own session (gateway keeps sharing for others)."""
    expire_stale_sessions(dependant=dependant_user)
    request_obj = (
        ConnectionRequest.objects.filter(
            dependant=dependant_user,
            status=ConnectionRequest.Status.CONNECTED,
        )
        .select_related("gateway", "gateway__gateway_device")
        .order_by("-connected_at", "-requested_at")
        .first()
    )
    if request_obj is None:
        raise ValueError("You are not connected right now.")

    end_connection(request_obj, reason="self")
    # Do not rotate WiFi here — other friends stay online. Dependant must leave the WiFi.
    return request_obj

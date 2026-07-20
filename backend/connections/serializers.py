from rest_framework import serializers

from accounts.serializers import UserSerializer

from .models import ConnectionRequest, GatewayDevice, InviteCode


class GatewayDeviceSerializer(serializers.ModelSerializer):
    is_live = serializers.BooleanField(read_only=True)
    can_approve_dependants = serializers.BooleanField(read_only=True)

    class Meta:
        model = GatewayDevice
        fields = (
            "device_name",
            "hostname",
            "is_connected",
            "is_live",
            "can_approve_dependants",
            "has_internet",
            "hotspot_active",
            "hotspot_ssid",
            "hotspot_password",
            "gateway_lan_ip",
            "uplink_profile",
            "uplink_alias",
            "uplink_ipv4",
            "uplink_mac",
            "share_mode",
            "client_count",
            "nat_active",
            "ipv6_leak_blocked",
            "privacy_shield_active",
            "client_isolation_active",
            "privacy_notes",
            "hotspot_band",
            "coverage_optimized",
            "coverage_notes",
            "agent_last_seen",
            "connected_at",
            "disconnected_at",
            "updated_at",
        )


class InviteCodeSerializer(serializers.ModelSerializer):
    ttl_seconds = serializers.SerializerMethodField()

    class Meta:
        model = InviteCode
        fields = ("code", "expires_at", "created_at", "ttl_seconds")

    def get_ttl_seconds(self, obj):
        from django.utils import timezone

        remaining = (obj.expires_at - timezone.now()).total_seconds()
        return max(0, int(remaining))


class ConnectionRequestSerializer(serializers.ModelSerializer):
    dependant = UserSerializer(read_only=True)
    gateway = UserSerializer(read_only=True)
    wifi = serializers.SerializerMethodField()
    seconds_remaining = serializers.SerializerMethodField()
    session_label = serializers.SerializerMethodField()

    class Meta:
        model = ConnectionRequest
        fields = (
            "id",
            "gateway",
            "dependant",
            "invite_code",
            "status",
            "requested_at",
            "responded_at",
            "connected_at",
            "session_minutes",
            "session_expires_at",
            "seconds_remaining",
            "session_label",
            "disconnected_at",
            "disconnect_reason",
            "wifi",
        )

    def get_seconds_remaining(self, obj):
        if obj.status != ConnectionRequest.Status.CONNECTED:
            return None
        return obj.seconds_remaining

    def get_session_label(self, obj):
        if obj.status != ConnectionRequest.Status.CONNECTED:
            return None
        if not obj.session_expires_at:
            return "No time limit"
        remaining = obj.seconds_remaining
        if remaining is None:
            return "No time limit"
        if remaining <= 0:
            return "Time ended"
        mins = remaining // 60
        secs = remaining % 60
        if mins >= 60:
            hours = mins // 60
            mins = mins % 60
            return f"{hours}h {mins}m left"
        if mins > 0:
            return f"{mins}m {secs:02d}s left"
        return f"{secs}s left"

    def get_wifi(self, obj):
        """Real shared WiFi — only while session is still active."""
        include = self.context.get("include_wifi")
        if not include:
            return None
        if not obj.session_active:
            return None
        device = getattr(obj.gateway, "gateway_device", None)
        if device is None:
            try:
                device = GatewayDevice.objects.get(owner=obj.gateway)
            except GatewayDevice.DoesNotExist:
                return None
        if not device.hotspot_active or not device.hotspot_ssid or not device.hotspot_password:
            return {
                "ready": False,
                "ssid": device.hotspot_ssid or "",
                "password": "",
                "gateway_lan_ip": device.gateway_lan_ip or "192.168.137.1",
                "message": "Your friend needs to start sharing again so you can join their WiFi.",
            }
        return {
            "ready": True,
            "ssid": device.hotspot_ssid,
            "password": device.hotspot_password,
            "gateway_lan_ip": device.gateway_lan_ip or "192.168.137.1",
            "message": "Join this WiFi on your phone to use real internet through your friend.",
        }


class AgentSyncSerializer(serializers.Serializer):
    device_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    hostname = serializers.CharField(max_length=120, required=False, allow_blank=True)
    has_internet = serializers.BooleanField()
    hotspot_active = serializers.BooleanField()
    hotspot_ssid = serializers.CharField(max_length=64, required=False, allow_blank=True)
    hotspot_password = serializers.CharField(max_length=128, required=False, allow_blank=True)
    gateway_lan_ip = serializers.CharField(max_length=64, required=False, allow_blank=True)
    uplink_profile = serializers.CharField(max_length=120, required=False, allow_blank=True)
    uplink_alias = serializers.CharField(max_length=120, required=False, allow_blank=True)
    uplink_ipv4 = serializers.CharField(max_length=64, required=False, allow_blank=True)
    uplink_mac = serializers.CharField(max_length=64, required=False, allow_blank=True)
    share_mode = serializers.CharField(max_length=64, required=False, allow_blank=True)
    client_count = serializers.IntegerField(required=False, min_value=0, default=0)
    nat_active = serializers.BooleanField(required=False, default=False)
    ipv6_leak_blocked = serializers.BooleanField(required=False, default=False)
    privacy_shield_active = serializers.BooleanField(required=False, default=False)
    client_isolation_active = serializers.BooleanField(required=False, default=False)
    privacy_notes = serializers.CharField(required=False, allow_blank=True, default="")
    hotspot_band = serializers.CharField(max_length=32, required=False, allow_blank=True)
    coverage_optimized = serializers.BooleanField(required=False, default=False)
    coverage_notes = serializers.CharField(required=False, allow_blank=True, default="")
    is_connected = serializers.BooleanField()


class RequestConnectSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=8)


class RespondRequestSerializer(serializers.Serializer):
    approve = serializers.BooleanField()
    session_minutes = serializers.IntegerField(
        required=False,
        allow_null=True,
        min_value=0,
        max_value=24 * 60,
    )


class SessionLimitSerializer(serializers.Serializer):
    session_minutes = serializers.IntegerField(
        required=True,
        allow_null=True,
        min_value=0,
        max_value=24 * 60,
    )

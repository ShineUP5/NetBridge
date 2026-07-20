from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone

User = get_user_model()


class GatewayDevice(models.Model):
    owner = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="gateway_device",
    )
    device_name = models.CharField(max_length=120, default="My PC")
    hostname = models.CharField(max_length=120, blank=True)
    is_connected = models.BooleanField(default=False)
    has_internet = models.BooleanField(default=False)
    hotspot_active = models.BooleanField(default=False)
    hotspot_ssid = models.CharField(max_length=64, blank=True)
    hotspot_password = models.CharField(max_length=128, blank=True)
    gateway_lan_ip = models.CharField(max_length=64, blank=True, default="192.168.137.1")
    uplink_profile = models.CharField(max_length=120, blank=True)
    uplink_alias = models.CharField(max_length=120, blank=True)
    uplink_ipv4 = models.CharField(max_length=64, blank=True)
    uplink_mac = models.CharField(max_length=64, blank=True)
    share_mode = models.CharField(max_length=64, blank=True)
    client_count = models.PositiveIntegerField(default=0)
    nat_active = models.BooleanField(default=False)
    ipv6_leak_blocked = models.BooleanField(default=False)
    privacy_shield_active = models.BooleanField(default=False)
    client_isolation_active = models.BooleanField(default=False)
    privacy_notes = models.TextField(blank=True)
    hotspot_band = models.CharField(max_length=32, blank=True)
    coverage_optimized = models.BooleanField(default=False)
    coverage_notes = models.TextField(blank=True)
    agent_last_seen = models.DateTimeField(null=True, blank=True)
    connected_at = models.DateTimeField(null=True, blank=True)
    disconnected_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        state = "connected" if self.is_connected else "offline"
        return f"{self.owner.phone} ({state})"

    @property
    def is_live(self):
        if not self.is_connected or not self.hotspot_active or not self.has_internet:
            return False
        if not self.privacy_shield_active and not self.nat_active:
            return False
        if not self.agent_last_seen:
            return False
        age = (timezone.now() - self.agent_last_seen).total_seconds()
        return age <= 600

    @property
    def can_approve_dependants(self):
        """Ready to approve friends onto real shared WiFi."""
        return bool(
            self.is_connected
            and self.hotspot_active
            and self.hotspot_ssid
            and self.hotspot_password
        )


class InviteCode(models.Model):
    gateway = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="invite_codes",
    )
    code = models.CharField(max_length=8, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_valid(self):
        return self.used_at is None and self.expires_at > timezone.now()


class ConnectionRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONNECTED = "connected", "Connected"
        DENIED = "denied", "Denied"
        DISCONNECTED = "disconnected", "Disconnected"

    gateway = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="incoming_requests",
    )
    dependant = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="outgoing_requests",
    )
    invite_code = models.CharField(max_length=8)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    connected_at = models.DateTimeField(null=True, blank=True)
    # null / 0 = no time limit; otherwise minutes allowed online after approve
    session_minutes = models.PositiveIntegerField(null=True, blank=True)
    session_expires_at = models.DateTimeField(null=True, blank=True)
    disconnected_at = models.DateTimeField(null=True, blank=True)
    disconnect_reason = models.CharField(max_length=32, blank=True)

    class Meta:
        ordering = ["-requested_at"]

    def __str__(self):
        return f"{self.dependant.phone} -> {self.gateway.phone} ({self.status})"

    @property
    def session_active(self):
        if self.status != self.Status.CONNECTED:
            return False
        if self.session_expires_at and self.session_expires_at <= timezone.now():
            return False
        return True

    @property
    def seconds_remaining(self):
        if not self.session_active or not self.session_expires_at:
            return None
        return max(0, int((self.session_expires_at - timezone.now()).total_seconds()))

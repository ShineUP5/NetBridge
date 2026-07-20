from django.contrib import admin

from .models import ConnectionRequest, GatewayDevice, InviteCode


@admin.register(GatewayDevice)
class GatewayDeviceAdmin(admin.ModelAdmin):
    list_display = ("owner", "device_name", "is_connected", "connected_at", "updated_at")
    list_filter = ("is_connected",)
    search_fields = ("owner__phone", "owner__email", "device_name")


@admin.register(InviteCode)
class InviteCodeAdmin(admin.ModelAdmin):
    list_display = ("code", "gateway", "expires_at", "used_at", "created_at")
    list_filter = ("used_at",)
    search_fields = ("code", "gateway__phone")


@admin.register(ConnectionRequest)
class ConnectionRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "dependant",
        "gateway",
        "status",
        "invite_code",
        "requested_at",
        "connected_at",
    )
    list_filter = ("status",)
    search_fields = ("dependant__phone", "gateway__phone", "invite_code")

from django.urls import path

from .views import (
    DependantConnectionView,
    DependantDisconnectView,
    DependantRequestConnectView,
    GatewayAgentSyncView,
    GatewayConnectedDependantsView,
    GatewayDisconnectDependantView,
    GatewayDisconnectView,
    GatewayInviteView,
    GatewayPendingRequestsView,
    GatewayRespondRequestView,
    GatewaySetSessionView,
    GatewayStatusView,
)

urlpatterns = [
    path("gateway/status/", GatewayStatusView.as_view(), name="gateway-status"),
    path("gateway/agent/sync/", GatewayAgentSyncView.as_view(), name="gateway-agent-sync"),
    path("gateway/disconnect/", GatewayDisconnectView.as_view(), name="gateway-disconnect"),
    path("gateway/invite/", GatewayInviteView.as_view(), name="gateway-invite"),
    path("gateway/requests/pending/", GatewayPendingRequestsView.as_view(), name="gateway-pending"),
    path(
        "gateway/requests/<int:request_id>/respond/",
        GatewayRespondRequestView.as_view(),
        name="gateway-respond",
    ),
    path(
        "gateway/dependants/connected/",
        GatewayConnectedDependantsView.as_view(),
        name="gateway-connected",
    ),
    path(
        "gateway/dependants/<int:request_id>/disconnect/",
        GatewayDisconnectDependantView.as_view(),
        name="gateway-disconnect-dependant",
    ),
    path(
        "gateway/dependants/<int:request_id>/session/",
        GatewaySetSessionView.as_view(),
        name="gateway-set-session",
    ),
    path(
        "dependant/request-connect/",
        DependantRequestConnectView.as_view(),
        name="dependant-request-connect",
    ),
    path(
        "dependant/connection/",
        DependantConnectionView.as_view(),
        name="dependant-connection",
    ),
    path(
        "dependant/disconnect/",
        DependantDisconnectView.as_view(),
        name="dependant-disconnect",
    ),
]

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ConnectionRequest
from .permissions import ensure_dependant, ensure_gateway
from .serializers import (
    AgentSyncSerializer,
    ConnectionRequestSerializer,
    GatewayDeviceSerializer,
    InviteCodeSerializer,
    RequestConnectSerializer,
    RespondRequestSerializer,
    SessionLimitSerializer,
)
from .services import (
    create_invite_code,
    dependant_disconnect_self,
    disconnect_gateway,
    expire_stale_sessions,
    gateway_disconnect_dependant,
    gateway_set_session,
    get_or_create_gateway_device,
    request_connection,
    respond_to_request,
    sync_gateway_from_agent,
)


class GatewayStatusView(APIView):
    def get(self, request):
        ensure_gateway(request.user)
        expire_stale_sessions(gateway=request.user)
        device = get_or_create_gateway_device(request.user)
        return Response(GatewayDeviceSerializer(device).data)


class GatewayAgentSyncView(APIView):
    """Receives real PC/hotspot status from the local gateway agent only."""

    def post(self, request):
        ensure_gateway(request.user)
        serializer = AgentSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        device = sync_gateway_from_agent(request.user, serializer.validated_data)
        expired = expire_stale_sessions(gateway=request.user)
        data = GatewayDeviceSerializer(device).data
        data["sessions_expired"] = expired
        return Response(data)


class GatewayDisconnectView(APIView):
    def post(self, request):
        ensure_gateway(request.user)
        device = disconnect_gateway(request.user)
        return Response(GatewayDeviceSerializer(device).data)


class GatewayInviteView(APIView):
    def post(self, request):
        ensure_gateway(request.user)
        try:
            invite = create_invite_code(request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(InviteCodeSerializer(invite).data, status=status.HTTP_201_CREATED)


class GatewayPendingRequestsView(APIView):
    def get(self, request):
        ensure_gateway(request.user)
        pending = ConnectionRequest.objects.filter(
            gateway=request.user,
            status=ConnectionRequest.Status.PENDING,
        ).select_related("dependant")
        return Response(ConnectionRequestSerializer(pending, many=True).data)


class GatewayRespondRequestView(APIView):
    def post(self, request, request_id):
        ensure_gateway(request.user)
        serializer = RespondRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            connection = respond_to_request(
                request.user,
                request_id,
                approve=serializer.validated_data["approve"],
                session_minutes=serializer.validated_data.get("session_minutes"),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            ConnectionRequestSerializer(
                connection,
                context={"include_wifi": True},
            ).data
        )


class GatewayConnectedDependantsView(APIView):
    def get(self, request):
        ensure_gateway(request.user)
        expired = expire_stale_sessions(gateway=request.user)
        connected = ConnectionRequest.objects.filter(
            gateway=request.user,
            status=ConnectionRequest.Status.CONNECTED,
        ).select_related("dependant")
        return Response(
            {
                "dependants": ConnectionRequestSerializer(connected, many=True).data,
                "sessions_expired": expired,
            }
        )


class GatewayDisconnectDependantView(APIView):
    def post(self, request, request_id):
        ensure_gateway(request.user)
        try:
            connection, rotate_wifi = gateway_disconnect_dependant(
                request.user,
                request_id,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "connection": ConnectionRequestSerializer(connection).data,
                "rotate_wifi": rotate_wifi,
                "detail": "Friend disconnected. WiFi password will change so they go offline.",
            }
        )


class GatewaySetSessionView(APIView):
    def post(self, request, request_id):
        ensure_gateway(request.user)
        serializer = SessionLimitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            connection = gateway_set_session(
                request.user,
                request_id,
                serializer.validated_data["session_minutes"],
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ConnectionRequestSerializer(connection).data)


class DependantRequestConnectView(APIView):
    def post(self, request):
        ensure_dependant(request.user)
        serializer = RequestConnectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            connection = request_connection(
                request.user,
                serializer.validated_data["code"],
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            ConnectionRequestSerializer(connection, context={"include_wifi": True}).data,
            status=status.HTTP_201_CREATED,
        )


class DependantConnectionView(APIView):
    def get(self, request):
        ensure_dependant(request.user)
        expire_stale_sessions(dependant=request.user)
        latest = (
            ConnectionRequest.objects.filter(dependant=request.user)
            .select_related("gateway", "gateway__gateway_device")
            .order_by("-requested_at")
            .first()
        )
        if latest is None:
            return Response({"connection": None})
        return Response(
            {
                "connection": ConnectionRequestSerializer(
                    latest,
                    context={"include_wifi": True},
                ).data
            }
        )


class DependantDisconnectView(APIView):
    def post(self, request):
        ensure_dependant(request.user)
        try:
            connection = dependant_disconnect_self(request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "connection": ConnectionRequestSerializer(
                    connection,
                    context={"include_wifi": True},
                ).data,
                "detail": "You are disconnected. Leave their WiFi in phone settings to go fully offline.",
            }
        )

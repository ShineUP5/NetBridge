from rest_framework.exceptions import PermissionDenied

from accounts.models import UserRole


def ensure_gateway(user):
    if user.role != UserRole.GATEWAY:
        raise PermissionDenied("Gateway account required.")


def ensure_dependant(user):
    if user.role != UserRole.DEPENDANT:
        raise PermissionDenied("Dependant account required.")

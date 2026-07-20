from django.urls import path

from .views import HealthView, LoginView, MeView, SignupView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("auth/signup/", SignupView.as_view(), name="signup"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/me/", MeView.as_view(), name="me"),
]

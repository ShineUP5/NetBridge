from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserRole(models.TextChoices):
    GATEWAY = "gateway", "Gateway"
    DEPENDANT = "dependant", "Dependant"


class UserManager(BaseUserManager):
    def create_user(self, phone, email, password=None, role=UserRole.DEPENDANT, **extra_fields):
        if not phone:
            raise ValueError("Phone number is required")
        if not email:
            raise ValueError("Email is required")
        if role not in UserRole.values:
            raise ValueError("Invalid role")

        email = self.normalize_email(email)
        user = self.model(
            phone=phone.strip(),
            email=email,
            role=role,
            **extra_fields,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", UserRole.GATEWAY)
        return self.create_user(phone, email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Account for either a gateway giver or a dependant receiver."""

    phone = models.CharField(max_length=20, unique=True)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=UserRole.choices)
    full_name = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["email"]

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.phone} ({self.role})"

    @property
    def is_gateway(self):
        return self.role == UserRole.GATEWAY

    @property
    def is_dependant(self):
        return self.role == UserRole.DEPENDANT

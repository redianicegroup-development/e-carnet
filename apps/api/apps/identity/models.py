import uuid

from django.conf import settings
from django.db import models
from .theme import default_theme


class ThemePreference(models.Model):
    """Préférences d'apparence privées à un compte, jamais à un carnet partagé."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="theme_preference")
    theme = models.JSONField(default=default_theme)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        verbose_name = "préférence de thème"
        verbose_name_plural = "préférences de thème"
    def __str__(self):
        return f"Thème du compte {self.user_id}"


class AccountProfile(models.Model):
    """Identité de présentation privée et éditable au niveau du compte."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="account_profile")
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    avatar_url = models.URLField(max_length=500, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class AccountContext(models.Model):
    """Contexte d’usage sélectionné par un compte, sans créer de doublon d’identité."""
    ROLE_CHOICES = (("patient", "Patient"), ("professional", "Professionnel"), ("establishment", "Établissement"))
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="account_contexts")
    role = models.CharField(max_length=24, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=False)
    onboarding_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=("user", "role"), name="unique_user_context_role")]
        ordering = ("role",)


class AuthIdentity(models.Model):
    """Identité fournie par Google, Facebook ou Apple, rattachée à un compte interne."""
    PROVIDER_CHOICES = (("google", "Google"), ("facebook", "Facebook"), ("apple", "Apple"))
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="auth_identities")
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    provider_user_id = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    display_name = models.CharField(max_length=180, blank=True)
    avatar_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("provider", "provider_user_id"), name="unique_provider_identity"),
            models.UniqueConstraint(fields=("user", "provider"), name="unique_user_provider_identity"),
        ]
        indexes = [models.Index(fields=("provider", "email"))]

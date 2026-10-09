import uuid

from django.conf import settings
from django.db import models


class ProfessionalProfile(models.Model):
    VERIFICATION_CHOICES = (("pending", "À vérifier"), ("verified", "Vérifié"), ("rejected", "Refusé"))

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="professional_profile")
    professional_title = models.CharField(max_length=80)
    specialty = models.CharField(max_length=120, blank=True)
    professional_identifier = models.CharField(max_length=120, blank=True)
    verification_status = models.CharField(max_length=16, choices=VERIFICATION_CHOICES, default="pending")
    active_establishment = models.ForeignKey("establishments.Establishment", on_delete=models.PROTECT, null=True, blank=True, related_name="active_professionals")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class ProfessionalSpecialty(models.Model):
    """Choix global de spécialité déclaré par les utilisateurs, sans valeur de vérification."""
    name = models.CharField(max_length=120)
    normalized_name = models.CharField(max_length=120, unique=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="declared_professional_specialties")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name

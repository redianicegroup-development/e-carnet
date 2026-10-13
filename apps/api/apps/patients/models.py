import uuid

from django.conf import settings
from django.db import models


class PatientProfile(models.Model):
    """Informations administratives du carnet, possédées par le patient."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="patient_profile")
    phone = models.CharField(max_length=32, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    address = models.CharField(max_length=240, blank=True)
    coverage_provider = models.CharField(max_length=160, blank=True)
    coverage_number = models.CharField(max_length=80, blank=True)
    coverage_expiry = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("created_at",)


class ClinicalDeclaration(models.Model):
    """Déclaration patient dont la provenance initiale reste visible."""
    KIND_CHOICES = (("antecedent", "Antécédent"), ("allergy", "Allergie"), ("treatment", "Traitement"), ("blood_group", "Groupe sanguin"))
    STATUS_CHOICES = (("declared", "Déclaré par le patient"), ("cancelled", "Annulé avec historique"))
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="declarations")
    kind = models.CharField(max_length=24, choices=KIND_CHOICES)
    label = models.CharField(max_length=160)
    details = models.TextField(blank=True, max_length=2000)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default="declared")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)
        constraints = [models.UniqueConstraint(fields=("patient", "kind", "label"), name="unique_patient_declaration")]


class PatientEmergencyCard(models.Model):
    """Carte d’urgence facultative, publiée uniquement par QR à la demande du patient."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.OneToOneField(PatientProfile, on_delete=models.CASCADE, related_name="emergency_card")
    contact_name = models.CharField(max_length=120, blank=True)
    contact_phone = models.CharField(max_length=32, blank=True)
    qr_enabled = models.BooleanField(default=False)
    qr_version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

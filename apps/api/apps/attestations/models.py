import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class DeclarationAttachment(models.Model):
    """Justificatif d'une déclaration (PDF, PNG, JPG, DOCX). Octets en base, jamais d'URL publique : téléchargement authentifié seulement."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    declaration = models.ForeignKey("patients.ClinicalDeclaration", on_delete=models.CASCADE, related_name="attachments")
    original_name = models.CharField(max_length=180)
    content_type = models.CharField(max_length=120)
    size_bytes = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    data = models.BinaryField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)


class DeclarationShare(models.Model):
    """Partage d'UNE déclaration avec UN établissement. Il ne donne accès à aucune autre partie du carnet."""
    STATUS_CHOICES = (("pending", "À attester"), ("info_requested", "Informations demandées"), ("attested", "Attestée"), ("revoked", "Retirée par le patient"))

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    declaration = models.ForeignKey("patients.ClinicalDeclaration", on_delete=models.CASCADE, related_name="shares")
    establishment = models.ForeignKey("establishments.Establishment", on_delete=models.PROTECT, related_name="declaration_shares")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    info_message = models.CharField(max_length=300, blank=True, default="")
    error_message = models.CharField(max_length=300, blank=True, default="")
    error_reported_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [models.UniqueConstraint(fields=("declaration", "establishment"), condition=~Q(status="revoked"), name="unique_active_declaration_share")]


class DeclarationAttestation(models.Model):
    """Une seule attestation par partage (OneToOne) : le premier professionnel habilité l'emporte, même en cas de clics simultanés.
    Le contenu attesté est figé dans `snapshot` ; l'attestation ne couvre jamais autre chose."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    share = models.OneToOneField(DeclarationShare, on_delete=models.PROTECT, related_name="attestation")
    professional = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    professional_name = models.CharField(max_length=160)
    professional_title = models.CharField(max_length=80)
    professional_specialty = models.CharField(max_length=120, blank=True, default="")
    professional_identifier = models.CharField(max_length=120, blank=True, default="")
    signature_fingerprint = models.CharField(max_length=64, blank=True, default="")
    snapshot = models.JSONField()
    attested_at = models.DateTimeField(auto_now_add=True)


class AttestationEvent(models.Model):
    """Historique en ajout seul d'une déclaration partagée."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    declaration = models.ForeignKey("patients.ClinicalDeclaration", on_delete=models.CASCADE, related_name="attestation_events")
    kind = models.CharField(max_length=24)
    actor_label = models.CharField(max_length=160, blank=True, default="")
    detail = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

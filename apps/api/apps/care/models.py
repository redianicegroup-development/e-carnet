import uuid
import hashlib
from datetime import timedelta

from django.db import models, transaction
from django.utils import timezone
from apps.patients.models import PatientProfile


class CareEncounter(models.Model):
    """Pré-consultation patient explicitement cloisonnée par établissement destinataire."""
    STATUS_CHOICES = (("draft", "Brouillon"), ("closed", "Clôturée"))
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="encounters")
    establishment = models.ForeignKey("establishments.Establishment", null=True, blank=True, on_delete=models.PROTECT, related_name="preconsultations")
    facility_label = models.CharField(max_length=180, blank=True)
    reason = models.CharField(max_length=240, blank=True)
    observations = models.TextField(blank=True, max_length=4000)
    recorded_with_help = models.CharField(max_length=160, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="draft")
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)


class PreConsultationRevision(models.Model):
    """Trace append-only des clôtures/corrections de pré-consultation."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    encounter = models.ForeignKey(CareEncounter, on_delete=models.CASCADE, related_name="revisions")
    snapshot = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)


class AccessGrant(models.Model):
    """Autorisation temporaire contrôlée par le patient et le serveur."""
    STATUS_CHOICES = (("pending", "En attente"), ("active", "Active"), ("refused", "Refusée"), ("expired", "Expirée"), ("revoked", "Révoquée"))
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="access_grants")
    professional = models.ForeignKey("professionals.ProfessionalProfile", on_delete=models.PROTECT, related_name="access_grants")
    establishment = models.ForeignKey("establishments.Establishment", on_delete=models.PROTECT, related_name="access_grants")
    professional_name = models.CharField(max_length=180)
    facility_label = models.CharField(max_length=180)
    scope = models.JSONField(default=list)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    requested_at = models.DateTimeField(auto_now_add=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    extension_count = models.PositiveSmallIntegerField(default=0)
    revoked_at = models.DateTimeField(null=True, blank=True)
    refused_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-requested_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("patient", "professional", "establishment"),
                condition=models.Q(status__in=("pending", "active")),
                name="unique_open_access_grant_target",
            ),
            models.CheckConstraint(
                condition=~models.Q(status__in=("pending", "active"), expires_at__isnull=True),
                name="open_access_grant_has_expiry",
            ),
        ]

    def save(self, *args, **kwargs):
        if self.status == "pending" and self.expires_at is None:
            self.expires_at = timezone.now() + timedelta(days=7)
        return super().save(*args, **kwargs)

    @transaction.atomic
    def refresh_expiration(self):
        if self.status in ("pending", "active") and self.expires_at and self.expires_at <= timezone.now():
            previous_status = self.status
            changed = AccessGrant.objects.filter(
                pk=self.pk, status=previous_status, expires_at__lte=timezone.now()
            ).update(status="expired")
            if changed:
                self.status = "expired"
                from apps.audit.models import AuditEvent

                AuditEvent.objects.create(
                    event_type="access_grant.expired",
                    actor=None,
                    actor_role="system",
                    patient=self.patient,
                    establishment=self.establishment,
                    access_grant=self,
                    metadata={"action": "expired", "status": "expired"},
                )
            else:
                self.refresh_from_db(fields=("status",))
        return self


class PatientAccessQrToken(models.Model):
    """Jeton opaque d’initiation : le QR ne contient jamais le dossier patient."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="access_qr_tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def digest(raw_token):
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


class Consultation(models.Model):
    """Contribution médicale affichée au patient avec sa provenance."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="consultations")
    professional = models.ForeignKey("professionals.ProfessionalProfile", null=True, blank=True, on_delete=models.PROTECT, related_name="consultations")
    establishment = models.ForeignKey("establishments.Establishment", null=True, blank=True, on_delete=models.PROTECT, related_name="consultations")
    access_grant = models.ForeignKey(AccessGrant, null=True, blank=True, on_delete=models.PROTECT, related_name="consultations")
    source_encounter = models.ForeignKey(CareEncounter, null=True, blank=True, on_delete=models.PROTECT, related_name="consultations")
    professional_name = models.CharField(max_length=180)
    facility_label = models.CharField(max_length=180)
    reason = models.CharField(max_length=240)
    observations = models.TextField(blank=True, max_length=4000)
    conclusion = models.TextField(blank=True, max_length=4000)
    care_plan = models.TextField(blank=True, max_length=4000)
    attestation_svg = models.TextField(blank=True, max_length=20000)
    attestation_svg_hash = models.CharField(max_length=64, blank=True)
    attestation_signed_at = models.DateTimeField(null=True, blank=True)
    validated_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-validated_at",)


class ConsultationRevision(models.Model):
    """Historique append-only de la validation et des corrections traçables."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consultation = models.ForeignKey(Consultation, on_delete=models.PROTECT, related_name="revisions")
    action = models.CharField(max_length=24, default="validated")
    snapshot = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

import hashlib
import json
import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class CareReferral(models.Model):
    STATUS_CHOICES = (
        ("draft", "Brouillon"), ("proposed", "Proposée"), ("accepted", "Acceptée"),
        ("declined", "Refusée"), ("expired", "Expirée"), ("cancelled", "Annulée"),
        ("revoked", "Révoquée"), ("consulted", "Consultée"), ("closed", "Clôturée"),
    )
    REASON_CHOICES = (
        ("avis_specialise", "Avis spécialisé"), ("examen_complementaire", "Examen complémentaire"),
        ("hospitalisation", "Hospitalisation"), ("suivi", "Suivi"), ("autre", "Autre"),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey("patients.PatientProfile", on_delete=models.PROTECT, related_name="care_referrals")
    from_establishment = models.ForeignKey("establishments.Establishment", on_delete=models.PROTECT, related_name="outgoing_referrals")
    from_professional = models.ForeignKey("professionals.ProfessionalProfile", on_delete=models.PROTECT, related_name="outgoing_referrals")
    to_establishment = models.ForeignKey("establishments.Establishment", on_delete=models.PROTECT, related_name="incoming_referrals")
    reason_category = models.CharField(max_length=32, choices=REASON_CHOICES)
    reason_note = models.CharField(max_length=240, blank=True, default="")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="draft")
    proposed_at = models.DateTimeField(null=True, blank=True)
    patient_decided_at = models.DateTimeField(null=True, blank=True)
    read_until = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("patient", "status")), models.Index(fields=("to_establishment", "status"))]


class CareReferralItem(models.Model):
    RECORD_CHOICES = (("consultation", "Consultation"), ("encounter", "Pré-consultation"), ("measurement", "Mesure"), ("document", "Document"), ("vaccination", "Vaccination"))
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral = models.ForeignKey(CareReferral, on_delete=models.CASCADE, related_name="items")
    record_type = models.CharField(max_length=20, choices=RECORD_CHOICES)
    record_id = models.UUIDField()
    proposed_by_a = models.BooleanField(default=True)
    accepted_by_patient = models.BooleanField(default=False)
    class Meta:
        constraints = [models.UniqueConstraint(fields=("referral", "record_type", "record_id"), name="unique_referral_record_item")]


class ImmutableSnapshotQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise TypeError("Les instantanés d’adressage sont immuables.")
    def delete(self):
        raise TypeError("Les instantanés d’adressage sont immuables.")
    def bulk_update(self, objs, fields, batch_size=None):
        raise TypeError("Les instantanés d’adressage sont immuables.")


class CareSnapshot(models.Model):
    objects = ImmutableSnapshotQuerySet.as_manager()
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral = models.OneToOneField(CareReferral, on_delete=models.PROTECT, related_name="snapshot")
    payload = models.JSONField()
    payload_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ("-created_at",)
    @staticmethod
    def digest(payload):
        encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()
    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise TypeError("Les instantanés d’adressage sont immuables.")
        if not self.payload_hash:
            self.payload_hash = self.digest(self.payload)
        return super().save(*args, **kwargs)
    def delete(self, *args, **kwargs):
        raise TypeError("Les instantanés d’adressage sont immuables.")

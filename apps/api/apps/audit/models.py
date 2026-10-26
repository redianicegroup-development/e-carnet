import uuid

from django.conf import settings
from django.db import models


class AuditEventQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise TypeError("Les événements d’audit sont immuables.")

    def delete(self):
        raise TypeError("Les événements d’audit sont immuables.")

    def bulk_update(self, objs, fields, batch_size=None):
        raise TypeError("Les événements d’audit sont immuables.")


class AuditEvent(models.Model):
    """Événement append-only : uniquement contexte, transition et identifiants."""
    objects = AuditEventQuerySet.as_manager()

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=80)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="audit_events")
    actor_role = models.CharField(max_length=32)
    patient = models.ForeignKey("patients.PatientProfile", null=True, blank=True, on_delete=models.PROTECT, related_name="audit_events")
    establishment = models.ForeignKey("establishments.Establishment", null=True, blank=True, on_delete=models.PROTECT, related_name="audit_events")
    access_grant = models.ForeignKey("care.AccessGrant", null=True, blank=True, on_delete=models.PROTECT, related_name="audit_events")
    consultation = models.ForeignKey("care.Consultation", null=True, blank=True, on_delete=models.PROTECT, related_name="audit_events")
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("created_at",)
        indexes = [
            models.Index(fields=("event_type", "created_at")),
            models.Index(fields=("actor", "created_at")),
            models.Index(fields=("establishment", "patient", "event_type", "created_at"), name="aud_evt_est_pt_type_time_idx"),
        ]

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise TypeError("Les événements d’audit sont immuables.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise TypeError("Les événements d’audit sont immuables.")

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.patients.models import PatientProfile
from .models import PatientNotification
from .notifications import notify_patient


class NotifyPatientTests(TestCase):
    def setUp(self):
        self.patient = PatientProfile.objects.create()

    def test_same_unread_notification_is_coalesced_within_window(self):
        first = notify_patient(
            self.patient,
            "establishment_record.opened",
            "Votre dossier a été consulté",
            "Clinique · motif : soins en cours",
            metadata={"reason_category": "soins_en_cours"},
            coalesce_key="admin:patient",
        )
        second = notify_patient(
            self.patient,
            "establishment_record.opened",
            "Votre dossier a été consulté",
            "Clinique · motif : soins en cours",
            metadata={"reason_category": "soins_en_cours"},
            coalesce_key="admin:patient",
        )

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(PatientNotification.objects.count(), 1)
        first.refresh_from_db()
        self.assertEqual(first.metadata["count"], 2)
        self.assertNotIn("coalesce_key", first.metadata)

    def test_read_and_out_of_window_notifications_are_not_coalesced(self):
        read = notify_patient(
            self.patient, "notice", "Info", "Texte", coalesce_key="same"
        )
        read.read_at = timezone.now()
        read.save(update_fields=("read_at",))
        old = notify_patient(
            self.patient, "notice", "Info", "Texte", coalesce_key="same"
        )
        PatientNotification.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(hours=1)
        )

        fresh = notify_patient(
            self.patient, "notice", "Info", "Texte", coalesce_key="same"
        )
        self.assertNotEqual(fresh.pk, old.pk)
        self.assertEqual(PatientNotification.objects.count(), 3)
        self.assertEqual(fresh.metadata["count"], 1)

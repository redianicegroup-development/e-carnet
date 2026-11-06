from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.care.models import PatientNotification
from apps.establishments.models import Establishment

from .models import PatientAccessSummaryPreference, PatientProfile, PatientRepresentation


User = get_user_model()
URL = "/api/v1/patient/care/access-summary-preference/"


class PatientAccessSummaryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="summary-owner", email="owner@example.test", password="local-test-password")
        self.patient = PatientProfile.objects.create(user=self.user, first_name="Awa", last_name="Kouassi")
        self.preference = PatientAccessSummaryPreference.objects.create(patient=self.patient, frequency="weekly")
        self.site = Establishment.objects.create(name="Clinique", establishment_type="Clinique", status="active")

    def access(self, patient=None, when=None):
        return AuditEvent.objects.create(
            event_type="clinical_data.read", actor=self.user, actor_role="professional",
            patient=patient or self.patient, establishment=self.site, metadata={"action": "read_consultations"},
            created_at=when or timezone.now(),
        )

    def execute_command(self):
        call_command("send_access_summaries", stdout=StringIO())

    def test_frequency_is_respected_and_restart_does_not_duplicate(self):
        self.access()
        self.execute_command(); self.execute_command()
        notifications = PatientNotification.objects.filter(patient=self.patient, kind="patient.access_summary")
        self.assertEqual(notifications.count(), 1)
        self.assertEqual(notifications.get().metadata["accesses_by_structure_type"][0]["count"], 1)
        self.preference.refresh_from_db()
        self.assertIsNotNone(self.preference.last_sent_at)

    def test_monthly_preference_does_not_send_weekly(self):
        self.preference.frequency = "monthly"; self.preference.save(update_fields=("frequency", "updated_at"))
        self.access()
        self.execute_command()
        self.assertEqual(PatientNotification.objects.filter(kind="patient.access_summary").count(), 1)

    def test_patient_without_access_receives_an_empty_non_medical_summary(self):
        self.execute_command()
        notification = PatientNotification.objects.get(patient=self.patient, kind="patient.access_summary")
        self.assertEqual(notification.metadata["accesses_by_structure_type"], [])
        self.assertIn("Aucun accès", notification.body)

    def test_patient_receives_only_own_summary(self):
        other_user = User.objects.create_user(username="summary-other", password="local-test-password")
        other = PatientProfile.objects.create(user=other_user)
        PatientAccessSummaryPreference.objects.create(patient=other, frequency="weekly")
        self.access(patient=other)
        self.execute_command()
        self.assertEqual(PatientNotification.objects.filter(patient=self.patient).count(), 1)
        self.assertEqual(PatientNotification.objects.filter(patient=other).count(), 1)
        self.assertNotIn(str(other.pk), str(PatientNotification.objects.get(patient=self.patient).metadata))

    def test_represented_child_profile_is_supported(self):
        guardian = User.objects.create_user(username="guardian", password="local-test-password")
        child = PatientProfile.objects.create(first_name="Enfant", last_name="Représenté")
        PatientRepresentation.objects.create(guardian=guardian, patient=child, relationship="child", status="active")
        PatientAccessSummaryPreference.objects.create(patient=child, frequency="weekly")
        self.access(patient=child)
        self.execute_command()
        notification = PatientNotification.objects.get(patient=child, kind="patient.access_summary")
        self.assertEqual(notification.metadata["accesses_by_structure_type"][0]["structure_type"], "Clinique")

    def test_patient_can_read_and_change_preference(self):
        client = APIClient(); client.force_authenticate(self.user)
        self.assertEqual(client.get(URL).data["data"]["frequency"], "weekly")
        response = client.patch(URL, {"frequency": "monthly"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["frequency"], "monthly")

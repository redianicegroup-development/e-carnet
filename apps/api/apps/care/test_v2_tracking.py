from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from apps.patients.models import PatientProfile
from .models import HealthMeasurement, MedicationReminder, PatientNotification

User = get_user_model()

class V2TrackingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="v2-patient", password="password")
        self.other = User.objects.create_user(username="v2-other", password="password")
        self.profile = PatientProfile.objects.create(user=self.user)
        PatientProfile.objects.create(user=self.other)
        self.client = APIClient(); self.client.force_authenticate(self.user)

    def test_patient_can_create_plausible_measurement(self):
        response = self.client.post("/api/v1/patient/care/measurements/", {"kind": "weight", "value": "68.4", "unit": "kg", "source": "measured", "measured_at": "2026-10-18T06:00:00Z"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["data"]["source_label"], "Mesuré")

    def test_implausible_measurement_is_rejected(self):
        response = self.client.post("/api/v1/patient/care/measurements/", {"kind": "temperature", "value": 80, "unit": "°C", "source": "measured", "measured_at": "2026-10-18T06:00:00Z"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(HealthMeasurement.objects.count(), 0)

    def test_reminder_creates_private_in_app_notification(self):
        response = self.client.post("/api/v1/patient/care/medication-reminders/", {"name": "Traitement", "dosage": "1 comprimé", "times": ["08:00", "20:00"], "starts_on": "2026-10-18"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(MedicationReminder.objects.count(), 1)
        self.assertEqual(self.client.get("/api/v1/patient/care/notifications/").data["data"][0]["kind"], "medication.created")
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/v1/patient/care/notifications/").data["data"], [])

    def test_notification_can_be_marked_read(self):
        notification = PatientNotification.objects.create(patient=self.profile, kind="access.requested", title="Accès", body="Une demande attend votre décision.")
        response = self.client.patch(f"/api/v1/patient/care/notifications/{notification.id}/read/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["data"]["read_at"])

    def test_patient_can_request_and_cancel_appointment(self):
        response = self.client.post("/api/v1/patient/care/appointments/", {"reason": "Contrôle", "starts_at": "2026-10-20T10:00:00Z"}, format="json")
        self.assertEqual(response.status_code, 201)
        appointment_id = response.data["data"]["id"]
        cancelled = self.client.patch(f"/api/v1/patient/care/appointments/{appointment_id}/", {"status": "cancelled"}, format="json")
        self.assertEqual(cancelled.status_code, 200)
        self.assertEqual(cancelled.data["data"]["status"], "cancelled")

    def test_patient_can_export_a_private_carnet_pdf(self):
        response = self.client.get("/api/v1/patient/care/export/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))

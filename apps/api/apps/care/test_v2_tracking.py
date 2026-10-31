from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
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

    def test_notification_inbox_has_global_unread_count_and_only_recent_patient_items(self):
        for index in range(12):
            PatientNotification.objects.create(
                patient=self.profile,
                kind="notice",
                title=f"Alerte {index}",
                body="Contenu privé",
                read_at=timezone.now() if index == 0 else None,
            )
        other_profile = PatientProfile.objects.get(user=self.other)
        PatientNotification.objects.create(patient=other_profile, kind="notice", title="Ne pas exposer", body="Autre patient")

        response = self.client.get("/api/v1/patient/care/notifications/inbox/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertEqual(response.data["data"]["unread_count"], 11)
        items = response.data["data"]["items"]
        self.assertEqual(len(items), 10)
        self.assertNotIn("Ne pas exposer", [item["title"] for item in items])

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

class CarnetExcelExportTests(TestCase):
    """PAT-09 : export Excel du carnet, sur la période choisie, journalisé, réservé au titulaire."""

    def setUp(self):
        self.user = User.objects.create_user(username="export-patient", password="password", first_name="Awa", last_name="Test")
        self.profile = PatientProfile.objects.create(user=self.user)
        self.client = APIClient(); self.client.force_authenticate(self.user)

    def test_excel_export_is_a_private_workbook_and_is_audited(self):
        from apps.audit.models import AuditEvent
        response = self.client.get("/api/v1/patient/care/export/?format=xlsx")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.assertIn("no-store", response["Cache-Control"])
        self.assertTrue(response.content.startswith(b"PK"))
        event = AuditEvent.objects.filter(event_type="patient.carnet.exported").latest("created_at")
        self.assertEqual(event.metadata["resource_type"], "patient_carnet_xlsx")

    def test_period_filters_the_measurements(self):
        import io, zipfile
        HealthMeasurement.objects.create(patient=self.profile, kind="weight", value="68.4", unit="kg", source="measured", measured_at="2026-01-10T08:00:00Z")
        HealthMeasurement.objects.create(patient=self.profile, kind="weight", value="70.1", unit="kg", source="measured", measured_at="2026-09-10T08:00:00Z")
        response = self.client.get("/api/v1/patient/care/export/?format=xlsx&from=2026-09-01&to=2026-09-30")
        self.assertEqual(response.status_code, 200)
        sheet = zipfile.ZipFile(io.BytesIO(response.content)).read("xl/worksheets/sheet4.xml").decode("utf-8")
        self.assertIn("70.1", sheet)
        self.assertNotIn("68.4", sheet)

    def test_invalid_or_reversed_period_is_refused(self):
        self.assertEqual(self.client.get("/api/v1/patient/care/export/?format=xlsx&from=pas-une-date").status_code, 400)
        self.assertEqual(self.client.get("/api/v1/patient/care/export/?format=xlsx&from=2026-10-01&to=2026-09-01").status_code, 400)

    def test_export_requires_authentication(self):
        anonymous = APIClient()
        self.assertIn(anonymous.get("/api/v1/patient/care/export/?format=xlsx").status_code, (401, 403))

    def test_spreadsheet_cells_cannot_be_read_as_formulas(self):
        from .export_xlsx import build_xlsx
        import io, zipfile
        data = build_xlsx([("Test", ["A"], [["=2+2"], ["@cmd"]])])
        xml = zipfile.ZipFile(io.BytesIO(data)).read("xl/worksheets/sheet1.xml").decode("utf-8")
        self.assertIn(">'=2+2<", xml)
        self.assertIn(">'@cmd<", xml)

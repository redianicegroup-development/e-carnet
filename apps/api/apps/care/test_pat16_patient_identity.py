from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.establishments.models import Establishment, EstablishmentAdministrator
from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile
from .models import Appointment

User = get_user_model()


class PatientIdentityInAgendaTests(TestCase):
    def setUp(self):
        self.doctor_user = User.objects.create_user(username="pat16-doctor", password="password")
        self.doctor = ProfessionalProfile.objects.create(
            user=self.doctor_user, professional_title="Médecin", verification_status="verified"
        )
        self.other_user = User.objects.create_user(username="pat16-other-doctor", password="password")
        self.other_doctor = ProfessionalProfile.objects.create(
            user=self.other_user, professional_title="Médecin", verification_status="verified"
        )
        self.patient_user = User.objects.create_user(
            username="pat16-child", password="password", first_name="Lina", last_name="Diallo"
        )
        self.child = PatientProfile.objects.create(user=self.patient_user, first_name="Lina", last_name="Diallo")
        self.patient = PatientProfile.objects.create(
            user=User.objects.create_user(username="pat16-patient", password="password", first_name="Amadou", last_name="Koné")
        )
        self.site = Establishment.objects.create(
            created_by=self.doctor_user, name="Clinique PAT16", status="active"
        )
        self.appointment = Appointment.objects.create(
            patient=self.child, professional=self.doctor, establishment=self.site,
            reason="Contrôle", starts_at="2026-11-06T10:00:00Z", status="requested",
        )
        self.other_appointment = Appointment.objects.create(
            patient=self.patient, professional=self.other_doctor, establishment=self.site,
            reason="Suivi", starts_at="2026-11-06T11:00:00Z", status="requested",
        )
        self.client = APIClient()

    def test_professional_sees_only_their_appointments_and_child_profile_name(self):
        self.client.force_authenticate(self.doctor_user)
        response = self.client.get("/api/v1/patient/care/professional/appointments/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), 1)
        row = response.data["data"][0]
        self.assertEqual(row["id"], str(self.appointment.id))
        self.assertEqual(row["patient_name"], "Lina Diallo")
        for forbidden in ("birth_date", "phone", "address", "gender", "email"):
            self.assertNotIn(forbidden, row)

    def test_patient_endpoint_never_returns_patient_identity_field(self):
        self.client.force_authenticate(self.patient_user)
        response = self.client.get("/api/v1/patient/care/appointments/")
        self.assertEqual(response.status_code, 200)
        row = next(item for item in response.data["data"] if item["id"] == str(self.appointment.id))
        self.assertNotIn("patient_name", row)
        self.assertNotIn("birth_date", row)
        self.assertNotIn("phone", row)

    def test_establishment_agenda_has_only_technical_id_dates_and_status(self):
        EstablishmentAdministrator.objects.create(
            establishment=self.site, user=self.doctor_user, assigned_by=self.doctor_user, status="active"
        )
        self.client.force_authenticate(self.doctor_user)
        response = self.client.get(f"/api/v1/patient/care/establishment/{self.site.id}/appointments/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), 2)
        for row in response.data["data"]:
            self.assertEqual(set(row), {"id", "starts_at", "ends_at", "status"})
            self.assertNotIn("patient_name", row)
            self.assertNotIn("reason", row)

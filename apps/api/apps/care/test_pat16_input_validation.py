from datetime import timedelta
import uuid

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.establishments.models import Establishment
from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile
from config.exception_handler import exception_handler
from .models import Appointment

User = get_user_model()


class AppointmentInputValidationTests(TestCase):
    def setUp(self):
        self.doctor_user = User.objects.create_user(username="pat16-c3-doctor", password="password")
        self.doctor = ProfessionalProfile.objects.create(
            user=self.doctor_user, professional_title="Médecin", verification_status="verified"
        )
        self.patient_user = User.objects.create_user(username="pat16-c3-patient", password="password")
        self.patient = PatientProfile.objects.create(user=self.patient_user)
        self.site = Establishment.objects.create(created_by=self.doctor_user, name="Clinique C3", status="active")
        self.appointment = Appointment.objects.create(
            patient=self.patient,
            professional=self.doctor,
            establishment=self.site,
            reason="Contrôle",
            starts_at=timezone.now() + timedelta(days=20),
            status="requested",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.doctor_user)

    def test_options_rejects_empty_and_malformed_establishment_uuid(self):
        for raw in ("", "pas-un-uuid", "123"):
            with self.subTest(value=raw):
                response = self.client.get("/api/v1/patient/care/appointments/options/", {"establishment_id": raw})
                self.assertEqual(response.status_code, 400)

    def test_unknown_but_valid_establishment_id_returns_no_professionals(self):
        response = self.client.get(
            "/api/v1/patient/care/appointments/options/", {"establishment_id": str(uuid.uuid4())}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["professionals"], [])

    def test_professional_agenda_rejects_malformed_or_empty_bounds(self):
        endpoint = "/api/v1/patient/care/professional/appointments/"
        for name, value in (("from", "pas-une-date"), ("from", ""), ("to", "hier"), ("to", "")):
            with self.subTest(parameter=name, value=value):
                response = self.client.get(endpoint, {name: value})
                self.assertEqual(response.status_code, 400)

    def test_professional_agenda_rejects_reversed_or_overlong_window(self):
        endpoint = "/api/v1/patient/care/professional/appointments/"
        today = timezone.localdate()
        reversed_response = self.client.get(endpoint, {"from": str(today + timedelta(days=2)), "to": str(today)})
        self.assertEqual(reversed_response.status_code, 400)
        wide_response = self.client.get(endpoint, {"from": str(today), "to": str(today + timedelta(days=93))})
        self.assertEqual(wide_response.status_code, 400)

    def test_professional_agenda_caps_response_at_500_rows(self):
        for index in range(500):
            Appointment.objects.create(
                patient=self.patient,
                professional=self.doctor,
                establishment=self.site,
                reason=f"Contrôle {index}",
                starts_at=timezone.now() + timedelta(days=21, minutes=index),
                status="requested",
            )
        response = self.client.get("/api/v1/patient/care/professional/appointments/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), 500)

    def test_propose_rejects_malformed_naive_past_and_invalid_end_dates(self):
        endpoint = "/api/v1/patient/care/professional/appointments/"
        future = (timezone.now() + timedelta(days=5)).isoformat()
        past = (timezone.now() - timedelta(days=1)).isoformat()
        naive = (timezone.now() + timedelta(days=5)).replace(tzinfo=None).isoformat()
        payloads = (
            {"starts_at": "pas-une-date", "reason": "Indisponibilité"},
            {"starts_at": naive, "reason": "Indisponibilité"},
            {"starts_at": past, "reason": "Indisponibilité"},
            {"starts_at": future, "ends_at": (timezone.now() + timedelta(days=4)).isoformat(), "reason": "Indisponibilité"},
            {"starts_at": future, "reason": "x" * 501},
            {"reason": "Créneau manquant"},
        )
        for payload in payloads:
            with self.subTest(payload=payload):
                response = self.client.post(
                    endpoint,
                    {"appointment_id": str(self.appointment.id), "action": "propose", **payload},
                    format="json",
                )
                self.assertEqual(response.status_code, 400)

    def test_valid_proposal_persists_timezone_aware_dates(self):
        starts = timezone.now() + timedelta(days=7)
        ends = starts + timedelta(hours=1)
        response = self.client.post(
            "/api/v1/patient/care/professional/appointments/",
            {
                "appointment_id": str(self.appointment.id),
                "action": "propose",
                "starts_at": starts.isoformat(),
                "ends_at": ends.isoformat(),
                "reason": "Indisponibilité du médecin",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.appointment.refresh_from_db()
        self.assertIsNotNone(self.appointment.proposed_starts_at)
        self.assertTrue(timezone.is_aware(self.appointment.proposed_starts_at))

    def test_global_handler_maps_django_validation_error_to_bad_request(self):
        response = exception_handler(DjangoValidationError({"starts_at": ["invalide"]}), {})
        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, 400)
        self.assertIn("starts_at", response.data)

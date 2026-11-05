from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile
from .models import Appointment
from .views import APPOINTMENT_TRANSITIONS

User = get_user_model()


class AppointmentTransitionTests(TestCase):
    def setUp(self):
        self.doctor_user = User.objects.create_user(username="pat16-c4-doctor", password="password")
        self.doctor = ProfessionalProfile.objects.create(
            user=self.doctor_user, professional_title="Médecin", verification_status="verified"
        )
        self.patient_user = User.objects.create_user(username="pat16-c4-patient", password="password")
        self.patient = PatientProfile.objects.create(user=self.patient_user)
        self.professional_client = APIClient()
        self.professional_client.force_authenticate(self.doctor_user)
        self.patient_client = APIClient()
        self.patient_client.force_authenticate(self.patient_user)

    def make_appointment(self, status="requested", **overrides):
        values = {
            "patient": self.patient,
            "professional": self.doctor,
            "reason": "Consultation",
            "starts_at": timezone.now() + timedelta(days=10),
            "status": status,
        }
        values.update(overrides)
        return Appointment.objects.create(**values)

    def test_transition_matrix_allows_only_documented_status_actions(self):
        expected = {
            ("professional", "propose"): {"requested": "requested", "confirmed": "confirmed"},
            ("professional", "withdraw-proposal"): {"requested": "requested", "confirmed": "confirmed"},
            ("professional", "confirm"): {"requested": "confirmed"},
            ("professional", "complete"): {"confirmed": "completed"},
            ("professional", "cancel"): {"requested": "cancelled", "confirmed": "cancelled"},
            ("patient", "confirm-proposal"): {"requested": "confirmed", "confirmed": "confirmed"},
            ("patient", "decline-proposal"): {"requested": "requested", "confirmed": "confirmed"},
            ("patient", "cancel"): {"requested": "cancelled", "confirmed": "cancelled"},
        }
        self.assertEqual(APPOINTMENT_TRANSITIONS, expected)
        all_statuses = {"requested", "confirmed", "cancelled", "completed"}
        for action, allowed in APPOINTMENT_TRANSITIONS.items():
            for status in all_statuses:
                self.assertEqual(status in allowed, status in APPOINTMENT_TRANSITIONS[action])

    def test_professional_can_propose_move_for_confirmed_appointment_without_moving_original_slot(self):
        original_start = timezone.now() + timedelta(days=10)
        original_end = original_start + timedelta(hours=1)
        appointment = self.make_appointment("confirmed", starts_at=original_start, ends_at=original_end)
        proposed_start = timezone.now() + timedelta(days=15)
        proposed_end = proposed_start + timedelta(hours=1)
        response = self.professional_client.post(
            "/api/v1/patient/care/professional/appointments/",
            {
                "appointment_id": str(appointment.id),
                "action": "propose",
                "starts_at": proposed_start.isoformat(),
                "ends_at": proposed_end.isoformat(),
                "reason": "Indisponibilité",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, "confirmed")
        self.assertEqual(appointment.starts_at, original_start)
        self.assertEqual(appointment.ends_at, original_end)
        self.assertEqual(appointment.proposed_starts_at, proposed_start)
        self.assertEqual(appointment.proposed_ends_at, proposed_end)

    def test_patient_accepts_proposal_on_confirmed_appointment_and_moves_slot(self):
        original_start = timezone.now() + timedelta(days=10)
        proposed_start = timezone.now() + timedelta(days=15)
        appointment = self.make_appointment(
            "confirmed",
            starts_at=original_start,
            proposed_starts_at=proposed_start,
            proposed_ends_at=proposed_start + timedelta(hours=1),
        )
        response = self.patient_client.post(
            f"/api/v1/patient/care/appointments/{appointment.id}/",
            {"action": "confirm-proposal"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, "confirmed")
        self.assertEqual(appointment.starts_at, proposed_start)
        self.assertIsNone(appointment.proposed_starts_at)
        self.assertIsNone(appointment.proposed_ends_at)

    def test_patient_can_decline_proposal_without_changing_status_or_original_slot(self):
        original_start = timezone.now() + timedelta(days=10)
        appointment = self.make_appointment(
            "requested",
            starts_at=original_start,
            proposed_starts_at=timezone.now() + timedelta(days=15),
            proposed_ends_at=timezone.now() + timedelta(days=15, hours=1),
        )
        response = self.patient_client.post(
            f"/api/v1/patient/care/appointments/{appointment.id}/",
            {"action": "decline-proposal"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, "requested")
        self.assertEqual(appointment.starts_at, original_start)
        self.assertIsNone(appointment.proposed_starts_at)
        self.assertIsNone(appointment.proposed_ends_at)

    def test_patient_can_accept_proposal_on_requested_appointment(self):
        proposed_start = timezone.now() + timedelta(days=14)
        appointment = self.make_appointment(
            "requested",
            proposed_starts_at=proposed_start,
            proposed_ends_at=proposed_start + timedelta(hours=1),
        )
        response = self.patient_client.post(
            f"/api/v1/patient/care/appointments/{appointment.id}/",
            {"action": "confirm-proposal"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, "confirmed")
        self.assertEqual(appointment.starts_at, proposed_start)

    def test_patient_cannot_accept_or_decline_when_no_proposal_is_pending(self):
        appointment = self.make_appointment("confirmed")
        for action in ("confirm-proposal", "decline-proposal"):
            with self.subTest(action=action):
                response = self.patient_client.post(
                    f"/api/v1/patient/care/appointments/{appointment.id}/", {"action": action}, format="json"
                )
                self.assertEqual(response.status_code, 409)

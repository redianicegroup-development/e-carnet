from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile
from .models import Appointment

User = get_user_model()


class AppointmentProposalAuditTests(TestCase):
    def setUp(self):
        self.doctor_user = User.objects.create_user(username="pat16-c5-doctor", password="password")
        self.doctor = ProfessionalProfile.objects.create(
            user=self.doctor_user, professional_title="Médecin", verification_status="verified"
        )
        self.patient_user = User.objects.create_user(username="pat16-c5-patient", password="password")
        self.patient = PatientProfile.objects.create(user=self.patient_user)
        self.patient_client = APIClient()
        self.patient_client.force_authenticate(self.patient_user)
        self.professional_client = APIClient()
        self.professional_client.force_authenticate(self.doctor_user)

    def make_appointment(self, status="requested", proposal=True):
        starts = timezone.now() + timedelta(days=10)
        return Appointment.objects.create(
            patient=self.patient,
            professional=self.doctor,
            reason="Contrôle",
            starts_at=starts,
            status=status,
            proposed_starts_at=starts + timedelta(days=2) if proposal else None,
            proposed_ends_at=starts + timedelta(days=2, hours=1) if proposal else None,
            change_reason="Créneau proposé",
        )

    def assert_no_proposal(self, appointment):
        appointment.refresh_from_db()
        self.assertIsNone(appointment.proposed_starts_at)
        self.assertIsNone(appointment.proposed_ends_at)

    def patient_action(self, appointment, action):
        return self.patient_client.post(
            f"/api/v1/patient/care/appointments/{appointment.id}/", {"action": action}, format="json"
        )

    def professional_action(self, appointment, action, **extra):
        return self.professional_client.post(
            "/api/v1/patient/care/professional/appointments/",
            {"appointment_id": str(appointment.id), "action": action, **extra},
            format="json",
        )

    def test_professional_cannot_confirm_or_complete_while_proposal_is_pending(self):
        appointment = self.make_appointment("confirmed")
        original_start = appointment.starts_at
        for action in ("confirm", "complete"):
            with self.subTest(action=action):
                response = self.professional_action(appointment, action)
                self.assertEqual(response.status_code, 409)
                appointment.refresh_from_db()
                self.assertEqual(appointment.starts_at, original_start)
                self.assertIsNotNone(appointment.proposed_starts_at)

    def test_professional_can_withdraw_pending_proposal(self):
        appointment = self.make_appointment("confirmed")
        response = self.professional_action(appointment, "withdraw-proposal")
        self.assertEqual(response.status_code, 200)
        self.assert_no_proposal(appointment)
        self.assertEqual(appointment.status, "confirmed")
        event = AuditEvent.objects.get(event_type="appointment.proposal_withdrawn", patient=self.patient)
        self.assertEqual(event.metadata, {"appointment_id": str(appointment.id), "status": "confirmed"})

    @patch("apps.care.views.notify_professional")
    def test_patient_acceptance_audits_and_notifies_professional_after_proposal_clears(self, notify_professional):
        appointment = self.make_appointment("confirmed")
        proposed_start = appointment.proposed_starts_at
        response = self.patient_action(appointment, "confirm-proposal")
        self.assertEqual(response.status_code, 200)
        self.assert_no_proposal(appointment)
        self.assertEqual(appointment.starts_at, proposed_start)
        event = AuditEvent.objects.get(event_type="appointment.proposal_confirmed", patient=self.patient)
        self.assertEqual(event.actor, self.patient_user)
        self.assertEqual(event.metadata, {"appointment_id": str(appointment.id), "status": "confirmed"})
        notify_professional.assert_called_once()
        self.assertEqual(notify_professional.call_args.kwargs["appointment_id"], appointment.id)

    @patch("apps.care.views.notify_professional")
    def test_patient_decline_audits_and_notifies_without_changing_status_or_slot(self, notify_professional):
        appointment = self.make_appointment("confirmed")
        original_start = appointment.starts_at
        response = self.patient_action(appointment, "decline-proposal")
        self.assertEqual(response.status_code, 200)
        self.assert_no_proposal(appointment)
        self.assertEqual(appointment.status, "confirmed")
        self.assertEqual(appointment.starts_at, original_start)
        event = AuditEvent.objects.get(event_type="appointment.proposal_declined", patient=self.patient)
        self.assertEqual(event.actor, self.patient_user)
        self.assertEqual(event.metadata, {"appointment_id": str(appointment.id), "status": "confirmed"})
        notify_professional.assert_called_once()

    def test_patient_cancellation_clears_pending_proposal(self):
        appointment = self.make_appointment("confirmed")
        response = self.patient_client.post(
            f"/api/v1/patient/care/appointments/{appointment.id}/",
            {"action": "cancel", "reason": "Changement de programme"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assert_no_proposal(appointment)
        self.assertEqual(appointment.status, "cancelled")

    def test_professional_cancellation_clears_pending_proposal(self):
        appointment = self.make_appointment("confirmed")
        response = self.professional_action(appointment, "cancel", reason="Indisponibilité")
        self.assertEqual(response.status_code, 200)
        self.assert_no_proposal(appointment)
        self.assertEqual(appointment.status, "cancelled")

    def test_patient_acceptance_clears_proposal_fields(self):
        appointment = self.make_appointment("requested")
        response = self.patient_action(appointment, "confirm-proposal")
        self.assertEqual(response.status_code, 200)
        self.assert_no_proposal(appointment)
        self.assertEqual(appointment.status, "confirmed")

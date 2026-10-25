from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.care.models import AccessGrant
from apps.care.services import require_scope
from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile

from .models import Establishment, EstablishmentAdministrator

User = get_user_model()


@override_settings(DEBUG=True)
class EstablishmentGovernanceTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="governance-staff@example.test", email="governance-staff@example.test", password="staff-password", is_staff=True)
        self.outsider = User.objects.create_user(username="outsider@example.test", email="outsider@example.test", password="outsider-password")
        self.owner = User.objects.create_user(username="owner@example.test", email="owner@example.test", password="owner-password")
        self.establishment = Establishment.objects.create(name="Clinique de test", status="active")
        EstablishmentAdministrator.objects.create(establishment=self.establishment, user=self.owner, assigned_by=self.staff, status="active")
        self.staff_client = APIClient()
        self.staff_client.force_authenticate(self.staff)
        self.owner_client = APIClient()
        self.owner_client.force_authenticate(self.owner)
        self.outsider_client = APIClient()
        self.outsider_client.force_authenticate(self.outsider)
        self.status_url = f"/api/v1/establishments/startup/{self.establishment.id}/status/"
        self.audit_url = f"/api/v1/establishments/startup/{self.establishment.id}/audit/"
        self.profile_url = f"/api/v1/establishments/{self.establishment.id}/profile/"

    def test_non_staff_cannot_suspend_reactivate_or_read_staff_audit(self):
        for method, url, body in (
            ("post", self.status_url, {"action": "suspend", "reason": "security_review"}),
            ("get", self.audit_url, None),
        ):
            response = getattr(self.outsider_client, method)(url, body, format="json") if body is not None else self.outsider_client.get(url)
            self.assertEqual(response.status_code, 403)
        self.assertEqual(self.owner_client.post(self.status_url, {"action": "suspend", "reason": "security_review"}, format="json").status_code, 403)
        self.assertEqual(self.owner_client.get(self.audit_url).status_code, 403)
        self.assertEqual(self.establishment.status, "active")

    def test_suspension_requires_a_valid_reason_and_blocks_admin_and_clinical_access(self):
        invalid = self.staff_client.post(self.status_url, {"action": "suspend", "reason": "free text"}, format="json")
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(self.establishment.status, "active")

        patient_user = User.objects.create_user(username="patient@example.test", email="patient@example.test", password="patient-password")
        patient = PatientProfile.objects.create(user=patient_user)
        professional_user = User.objects.create_user(username="doctor@example.test", email="doctor@example.test", password="doctor-password")
        professional = ProfessionalProfile.objects.create(user=professional_user, professional_title="Médecin", active_establishment=self.establishment)
        grant = AccessGrant.objects.create(
            patient=patient,
            professional=professional,
            establishment=self.establishment,
            professional_name="Médecin test",
            facility_label=self.establishment.name,
            scope=["consultations"],
            status="active",
            starts_at=timezone.now(),
            expires_at=timezone.now() + timedelta(hours=1),
        )

        suspended = self.staff_client.post(self.status_url, {"action": "suspend", "reason": "security_review"}, format="json")
        self.assertEqual(suspended.status_code, 200, suspended.data)
        self.establishment.refresh_from_db()
        self.assertEqual(self.establishment.status, "suspended")
        self.assertEqual(self.establishment.suspended_by, self.staff)
        self.assertIsNotNone(self.establishment.suspended_at)
        self.assertEqual(self.owner_client.get(self.profile_url).status_code, 403)
        with self.assertRaises(PermissionDenied):
            require_scope(grant, "consultations")

        event = AuditEvent.objects.get(event_type="establishment.suspended", establishment=self.establishment)
        self.assertEqual(event.actor, self.staff)
        self.assertEqual(event.metadata, {"action": "suspend", "status": "suspended", "reason_code": "security_review"})
        self.assertIsNone(event.patient_id, "le journal de gouvernance ne doit contenir aucune association patient")

    def test_reactivation_is_staff_only_audited_and_restores_admin_access(self):
        self.staff_client.post(self.status_url, {"action": "suspend", "reason": "compliance_review"}, format="json")
        response = self.staff_client.post(self.status_url, {"action": "reactivate"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.establishment.refresh_from_db()
        self.assertEqual(self.establishment.status, "active")
        self.assertEqual(self.owner_client.get(self.profile_url).status_code, 200)
        self.assertTrue(AuditEvent.objects.filter(event_type="establishment.reactivated", actor=self.staff, establishment=self.establishment).exists())

    def test_replacement_requires_confirmation_and_revokes_the_old_admin_scope(self):
        successor = User.objects.create_user(username="successor@example.test", email="successor@example.test", password="successor-password")
        url = f"/api/v1/establishments/startup/{self.establishment.id}/administrator-invitation/"
        refused = self.staff_client.post(url, {"email": successor.email, "use_existing_account": True}, format="json")
        self.assertEqual(refused.status_code, 409)
        self.assertEqual(EstablishmentAdministrator.objects.filter(establishment=self.establishment, status="active").count(), 1)

        replaced = self.staff_client.post(url, {"email": successor.email, "use_existing_account": True, "confirm_replace": True}, format="json")
        self.assertEqual(replaced.status_code, 200, replaced.data)
        self.assertEqual(self.owner_client.get(self.profile_url).status_code, 403)
        successor_client = APIClient()
        successor_client.force_authenticate(successor)
        self.assertEqual(successor_client.get(self.profile_url).status_code, 200)
        self.assertEqual(EstablishmentAdministrator.objects.filter(establishment=self.establishment, status="active").count(), 1)
        self.assertTrue(AuditEvent.objects.filter(event_type="establishment.administrator.replaced", actor=self.staff, establishment=self.establishment).exists())

    def test_staff_audit_is_bounded_minimal_and_includes_governance_events(self):
        self.staff_client.post(self.status_url, {"action": "suspend", "reason": "operational"}, format="json")
        AuditEvent.objects.create(
            event_type="consultation.signed",
            actor=self.owner,
            actor_role="professional",
            establishment=self.establishment,
            metadata={"encounter_id": "clinical-id-must-not-leak"},
        )
        response = self.staff_client.get(self.audit_url)
        self.assertEqual(response.status_code, 200, response.data)
        body = response.data["data"]
        self.assertEqual(body["limit"], 100)
        self.assertEqual(body["items"][0]["event_type"], "establishment.suspended")
        self.assertEqual(body["items"][0]["metadata"]["reason_code"], "operational")
        self.assertNotIn("patient", body["items"][0])
        self.assertNotIn("consultation", body["items"][0])
        self.assertNotIn("access_grant", body["items"][0])
        self.assertNotIn("consultation.signed", [item["event_type"] for item in body["items"]])
        self.assertNotIn("clinical-id-must-not-leak", str(body["items"]))

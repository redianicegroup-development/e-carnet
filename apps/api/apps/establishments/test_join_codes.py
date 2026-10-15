from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.care.models import AccessGrant
from apps.care.services import create_patient_qr_token
from apps.audit.models import AuditEvent
from apps.identity.models import AccountContext
from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile
from .models import Establishment, EstablishmentAdministrator, EstablishmentJoinCode, EstablishmentMembership

User = get_user_model()


class EstablishmentJoinCodeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(username="staff-join", password="staff-password", is_staff=True)
        self.admin = User.objects.create_user(username="admin-join", email="admin-join@test", password="admin-password")
        self.doctor = User.objects.create_user(username="doctor-join", email="doctor-join@test", password="doctor-password")
        self.profile = ProfessionalProfile.objects.create(user=self.doctor, professional_title="Médecin", verification_status="pending")
        self.establishment = Establishment.objects.create(name="Clinique codes", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="codes@test", responsible_name="Admin", status="active")
        EstablishmentAdministrator.objects.create(establishment=self.establishment, user=self.admin, assigned_by=self.staff)
        AccountContext.objects.create(user=self.admin, role="establishment", is_active=True)
        AccountContext.objects.create(user=self.doctor, role="professional", is_active=True)

    def issue_code(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(f"/api/v1/establishments/{self.establishment.id}/join-codes/", format="json")
        self.assertEqual(response.status_code, 201)
        return response.data["data"]["code"]

    def test_admin_can_issue_hashed_code_and_doctor_consumption_only_creates_pending(self):
        code = self.issue_code()
        record = EstablishmentJoinCode.objects.get()
        self.assertNotEqual(code, record.code_hash)
        self.assertLess(abs((record.expires_at - record.created_at).total_seconds() - 48 * 3600), 2)

        self.client.force_authenticate(self.doctor)
        response = self.client.post("/api/v1/establishments/join-codes/redeem/", {"code": code, "agreement_accepted": True, "agreement_version": "2026-10-08-v1"}, format="json")
        self.assertEqual(response.status_code, 201)
        membership = EstablishmentMembership.objects.get()
        self.assertEqual(membership.status, "pending")
        record.refresh_from_db()
        self.assertIsNotNone(record.consumed_at)
        self.assertIsNone(self.profile.active_establishment_id)
        self.assertEqual(self.client.post("/api/v1/establishments/join-codes/redeem/", {"code": code, "agreement_accepted": True, "agreement_version": "2026-10-08-v1"}, format="json").status_code, 400)

        self.client.force_authenticate(self.admin)
        decision = self.client.post(f"/api/v1/establishments/{self.establishment.id}/memberships/{membership.id}/decision/", {"decision": "approve"}, format="json")
        self.assertEqual(decision.status_code, 200)
        membership.refresh_from_db()
        self.assertEqual(membership.status, "active")

    def test_expired_code_cannot_be_consumed(self):
        code = self.issue_code()
        record = EstablishmentJoinCode.objects.get()
        record.expires_at = timezone.now() - timedelta(seconds=1)
        record.save(update_fields=("expires_at",))
        self.client.force_authenticate(self.doctor)
        response = self.client.post("/api/v1/establishments/join-codes/redeem/", {"code": code, "agreement_accepted": True, "agreement_version": "2026-10-08-v1"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(EstablishmentMembership.objects.exists())

    def test_code_is_not_consumed_without_explicit_agreement(self):
        code = self.issue_code()
        self.client.force_authenticate(self.doctor)
        response = self.client.post("/api/v1/establishments/join-codes/redeem/", {"code": code}, format="json")
        self.assertEqual(response.status_code, 400)
        record = EstablishmentJoinCode.objects.get()
        self.assertIsNone(record.consumed_at)
        self.assertFalse(EstablishmentMembership.objects.exists())

    def test_establishment_can_terminate_active_membership_without_deleting_history(self):
        membership = EstablishmentMembership.objects.create(establishment=self.establishment, professional=self.profile, status="active")
        self.profile.active_establishment = self.establishment
        self.profile.save(update_fields=("active_establishment", "updated_at"))
        self.client.force_authenticate(self.admin)
        response = self.client.post(f"/api/v1/establishments/{self.establishment.id}/memberships/{membership.id}/terminate/", format="json")
        self.assertEqual(response.status_code, 200)
        membership.refresh_from_db()
        self.profile.refresh_from_db()
        self.assertEqual(membership.status, "terminated")
        self.assertIsNotNone(membership.left_at)
        self.assertIsNone(self.profile.active_establishment_id)
        self.assertTrue(EstablishmentMembership.objects.filter(pk=membership.pk).exists())
        self.assertTrue(AuditEvent.objects.filter(event_type="membership.terminated_by_establishment", establishment=self.establishment).exists())

    def test_clinical_guard_uses_active_membership_not_global_professional_verification(self):
        membership = EstablishmentMembership.objects.create(establishment=self.establishment, professional=self.profile, status="active")
        self.profile.active_establishment = self.establishment
        self.profile.save(update_fields=("active_establishment", "updated_at"))
        patient_user = User.objects.create_user(username="patient-join", password="patient-password")
        patient = PatientProfile.objects.create(user=patient_user)
        self.client.force_authenticate(self.doctor)
        # Une demande d’accès exige désormais le QR affiché par le patient (jeton à usage unique), jamais son identifiant.
        qr_token = create_patient_qr_token(patient=patient)
        response = self.client.post("/api/v1/patient/care/professional/access-grants/", {"qr_token": qr_token, "scope": ["preconsultation"]}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(AccessGrant.objects.get().establishment_id, self.establishment.id)
        membership.status = "terminated"
        membership.save(update_fields=("status",))
        self.assertEqual(self.client.get("/api/v1/patient/care/professional/access-grants/").status_code, 403)

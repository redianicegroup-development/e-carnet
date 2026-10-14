from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from django.utils import timezone
from django.test import override_settings
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.identity.models import AccountContext
from apps.professionals.models import ProfessionalProfile
from .models import Establishment, EstablishmentAdministrator, EstablishmentMembership

User = get_user_model()


@override_settings(DEBUG=True, EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class EstablishmentProfessionalFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def register(self, email, first_name="Test", last_name="User"):
        response = self.client.post(
            "/api/v1/identity/register/",
            {"email": email, "password": "a-long-local-password", "first_name": first_name, "last_name": last_name},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        return User.objects.get(email=email)

    def establishment(self, *, admin, code=""):
        return Establishment.objects.create(
            created_by=admin,
            name="Centre fictif",
            establishment_type="Centre",
            city="Abidjan",
            address="Adresse de test",
            phone="+22500000000",
            email="centre@example.test",
            responsible_name="Responsable Test",
            status="active",
            internal_code=code or None,
        )

    def test_public_creation_is_disabled_and_creates_nothing(self):
        user = self.register("requester@example.test")
        response = self.client.post(
            "/api/v1/establishments/create/",
            {"name": "Clinique fictive", "email": "clinique@example.test"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Establishment.objects.filter(email="clinique@example.test").exists())
        self.assertFalse(user.account_contexts.filter(role="establishment").exists())

    def test_join_code_creates_pending_then_named_admin_approves_without_global_verified(self):
        staff = User.objects.create_user(username="staff-flow", email="staff-flow@example.test", password="staff-password", is_staff=True)
        admin = User.objects.create_user(username="admin-flow", email="admin-flow@example.test", password="admin-password")
        establishment = self.establishment(admin=staff)
        EstablishmentAdministrator.objects.create(establishment=establishment, user=admin, assigned_by=staff)
        AccountContext.objects.create(user=admin, role="establishment", is_active=True)
        doctor = self.register("doctor-flow@example.test", "Docteur", "Test")
        self.client.patch("/api/v1/professionals/onboarding/", {"professional_title": "Médecin", "specialty": "Généraliste"}, format="json")
        self.client.force_authenticate(admin)
        code_response = self.client.post(f"/api/v1/establishments/{establishment.id}/join-codes/", format="json")
        self.assertEqual(code_response.status_code, 201)
        code = code_response.data["data"]["code"]
        self.client.force_authenticate(doctor)
        request = self.client.post("/api/v1/establishments/join-codes/redeem/", {"code": code, "agreement_accepted": True, "agreement_version": "2026-10-08-v1"}, format="json")
        self.assertEqual(request.status_code, 201)
        membership = EstablishmentMembership.objects.get()
        self.assertEqual(membership.status, "pending")
        self.client.force_authenticate(admin)
        approved = self.client.post(
            f"/api/v1/establishments/{establishment.id}/memberships/{membership.id}/decision/",
            {"decision": "approve"},
            format="json",
        )
        self.assertEqual(approved.status_code, 200)
        membership.refresh_from_db()
        self.assertEqual(membership.status, "active")

    def test_active_membership_is_institutional_validation(self):
        admin = self.register("institution-admin@example.test")
        establishment = self.establishment(admin=admin, code="LEGACY-NOT-USED")
        doctor = self.register("institution-doctor@example.test")
        self.client.patch("/api/v1/professionals/onboarding/", {"professional_title": "Médecin", "specialty": "Généraliste"}, format="json")
        profile = ProfessionalProfile.objects.get(user=doctor)
        profile.verification_status = "pending"
        profile.save(update_fields=("verification_status",))
        membership = EstablishmentMembership.objects.create(establishment=establishment, professional=profile, status="pending", agreement_version="2026-10-08-v1", agreement_accepted_at=timezone.now(), agreement_accepted_by=admin)
        EstablishmentAdministrator.objects.create(establishment=establishment, user=admin, assigned_by=admin)
        self.client.force_authenticate(admin)
        response = self.client.post(f"/api/v1/establishments/{establishment.id}/memberships/{membership.id}/decision/", {"decision": "approve"}, format="json")
        self.assertEqual(response.status_code, 200)
        membership.refresh_from_db()
        self.assertEqual(membership.status, "active")
        self.assertEqual(ProfessionalProfile.objects.get(pk=profile.pk).verification_status, "pending")

    def test_staff_creation_sends_email_without_returning_raw_token(self):
        staff = User.objects.create_user(username="staff-create", email="staff-create@example.test", password="staff-password", is_staff=True)
        self.client.force_authenticate(staff)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/v1/establishments/startup/establishments/",
                {
                "name": "Clinique privée",
                "establishment_type": "Clinique",
                "city": "Abidjan",
                "address": "Adresse",
                "phone": "+22500000000",
                "email": "contact@clinique.example.test",
                "responsible_name": "Amina Test",
                "responsible_email": "admin@clinique.example.test",
                "responsible_first_name": "Amina",
                "responsible_last_name": "Test",
            "verification_confirmed": True,
                },
                format="json",
            )
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("invitation_token", response.data["data"])
        self.assertNotIn("invitation_url", response.data["data"])
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("invitation", mail.outbox[0].subject.lower())
        self.assertIn("/etablissement/activation?token=", mail.outbox[0].body)

    @override_settings(DEBUG=False)
    def test_production_response_never_contains_invitation_secret(self):
        staff = User.objects.create_user(username="staff-production", email="staff-production@example.test", password="staff-password", is_staff=True)
        self.client.force_authenticate(staff)
        response = self.client.post(
            "/api/v1/establishments/startup/establishments/",
            {
                "name": "Clinique production test",
                "establishment_type": "Clinique",
                "city": "Abidjan",
                "address": "Adresse",
                "phone": "+22500000000",
                "email": "contact-production@clinique.example.test",
                "responsible_name": "Amina Production",
                "responsible_email": "admin-production@clinique.example.test",
                "responsible_first_name": "Amina",
                "responsible_last_name": "Production",
            "verification_confirmed": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("invitation_token", response.data["data"])
        self.assertNotIn("invitation_url", response.data["data"])

    def test_professional_leave_blocks_future_membership_and_keeps_audit(self):
        admin = self.register("root-leave@example.test")
        establishment = self.establishment(admin=admin, code="LEAVE-1")
        doctor = User.objects.create_user(username="doctor-leave", password="local-test-password")
        profile = ProfessionalProfile.objects.create(user=doctor, professional_title="Médecin", verification_status="verified", active_establishment=establishment)
        membership = EstablishmentMembership.objects.create(establishment=establishment, professional=profile, status="active")
        self.client.force_authenticate(doctor)
        response = self.client.post(f"/api/v1/establishments/{establishment.id}/memberships/leave/")
        self.assertEqual(response.status_code, 200)
        membership.refresh_from_db()
        profile.refresh_from_db()
        self.assertEqual(membership.status, "terminated")
        self.assertIsNotNone(membership.left_at)
        self.assertIsNone(profile.active_establishment_id)
        event = AuditEvent.objects.get(event_type="membership.terminated_by_professional", establishment=establishment)
        self.assertEqual(event.actor_id, doctor.id)

    def test_mfa_endpoints_are_unavailable_until_v3(self):
        self.register("doctor-mfa@example.test")
        self.client.patch("/api/v1/professionals/onboarding/", {"professional_title": "Médecin"}, format="json")
        setup = self.client.post("/api/v1/professionals/mfa/setup/", format="json")
        verification = self.client.post("/api/v1/professionals/mfa/verify/", {"code": "000000"}, format="json")
        self.assertEqual(setup.status_code, 404)
        self.assertEqual(verification.status_code, 404)

    def test_professional_cannot_read_another_establishment(self):
        root = self.register("root3@example.test")
        establishment = self.establishment(admin=root, code="ETAB-B1")
        self.client.post("/api/v1/identity/logout/")
        self.register("unrelated@example.test")
        response = self.client.get(f"/api/v1/establishments/{establishment.id}/")
        self.assertEqual(response.status_code, 404)

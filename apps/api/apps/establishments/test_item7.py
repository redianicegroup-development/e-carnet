from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from unittest import skipUnless

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection, connections
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.identity.models import AccountContext
from apps.professionals.models import ProfessionalProfile
from .models import Establishment, EstablishmentAdministrator, EstablishmentJoinCode, EstablishmentMembership

User = get_user_model()


class EstablishmentItem7Tests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="staff-item7", password="staff-password", is_staff=True)
        self.admin_a = User.objects.create_user(username="admin-a-item7", email="admin-a-item7@test", password="admin-password")
        self.admin_b = User.objects.create_user(username="admin-b-item7", email="admin-b-item7@test", password="admin-password")
        self.doctor = User.objects.create_user(username="doctor-item7", email="doctor-item7@test", password="doctor-password")
        self.profile = ProfessionalProfile.objects.create(user=self.doctor, professional_title="Médecin", verification_status="pending")
        self.site_a = Establishment.objects.create(name="Site A", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="a-item7@test", responsible_name="A", status="active")
        self.site_b = Establishment.objects.create(name="Site B", establishment_type="Clinique", city="Abidjan", address="B", phone="0", email="b-item7@test", responsible_name="B", status="active")
        EstablishmentAdministrator.objects.create(establishment=self.site_a, user=self.admin_a, assigned_by=self.staff)
        EstablishmentAdministrator.objects.create(establishment=self.site_b, user=self.admin_b, assigned_by=self.staff)
        AccountContext.objects.create(user=self.doctor, role="professional", is_active=True)

    def issue(self, admin, site):
        client = APIClient()
        client.force_authenticate(admin)
        response = client.post(f"/api/v1/establishments/{site.id}/join-codes/", format="json")
        self.assertEqual(response.status_code, 201)
        return response.data["data"]["code"]

    def redeem(self, code):
        client = APIClient()
        client.force_authenticate(self.doctor)
        return client.post("/api/v1/establishments/join-codes/redeem/", {"code": code, "agreement_accepted": True, "agreement_version": "2026-10-08-v1"}, format="json")

    def test_refusal_is_persisted_and_audited(self):
        code = self.issue(self.admin_a, self.site_a)
        self.assertEqual(self.redeem(code).status_code, 201)
        membership = EstablishmentMembership.objects.get(establishment=self.site_a, professional=self.profile)
        client = APIClient()
        client.force_authenticate(self.admin_a)
        response = client.post(f"/api/v1/establishments/{self.site_a.id}/memberships/{membership.id}/decision/", {"decision": "refuse"}, format="json")
        self.assertEqual(response.status_code, 200)
        membership.refresh_from_db()
        self.assertEqual(membership.status, "refused")
        self.assertTrue(AuditEvent.objects.filter(event_type="membership.refuse", establishment=self.site_a, metadata__membership_id=str(membership.id)).exists())

    def test_administrator_isolation_between_structures(self):
        client = APIClient()
        client.force_authenticate(self.admin_a)
        self.assertEqual(client.get(f"/api/v1/establishments/{self.site_b.id}/memberships/").status_code, 403)
        self.assertEqual(client.post(f"/api/v1/establishments/{self.site_b.id}/join-codes/", format="json").status_code, 403)
        code_b = self.issue(self.admin_b, self.site_b)
        self.assertEqual(client.get(f"/api/v1/establishments/{self.site_b.id}/").status_code, 404)
        self.assertNotEqual(EstablishmentJoinCode.objects.get().code_hash, code_b)

    def test_audit_keeps_creation_consumption_and_decision_without_secret(self):
        code = self.issue(self.admin_a, self.site_a)
        self.assertEqual(self.redeem(code).status_code, 201)
        membership = EstablishmentMembership.objects.get()
        client = APIClient()
        client.force_authenticate(self.admin_a)
        client.post(f"/api/v1/establishments/{self.site_a.id}/memberships/{membership.id}/decision/", {"decision": "approve"}, format="json")
        events = AuditEvent.objects.filter(establishment=self.site_a).order_by("created_at")
        types = list(events.values_list("event_type", flat=True))
        self.assertIn("establishment.join_code.created", types)
        self.assertIn("establishment.join_code.consumed", types)
        self.assertIn("membership.requested", types)
        self.assertIn("membership.approve", types)
        self.assertTrue(all(code not in (event.metadata or {}) for event in events))


class ConcurrentJoinCodeConsumptionTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.staff = User.objects.create_user(username="staff-concurrent", password="staff-password", is_staff=True)
        self.admin = User.objects.create_user(username="admin-concurrent", password="admin-password")
        self.doctor = User.objects.create_user(username="doctor-concurrent", password="doctor-password")
        ProfessionalProfile.objects.create(user=self.doctor, professional_title="Médecin", verification_status="verified")
        self.site = Establishment.objects.create(name="Site concurrent", establishment_type="Clinique", city="Abidjan", address="C", phone="0", email="concurrent@test", responsible_name="Admin", status="active")
        EstablishmentAdministrator.objects.create(establishment=self.site, user=self.admin, assigned_by=self.staff)
        AccountContext.objects.create(user=self.doctor, role="professional", is_active=True)
        admin_client = APIClient()
        admin_client.force_authenticate(self.admin)
        response = admin_client.post(f"/api/v1/establishments/{self.site.id}/join-codes/", format="json")
        self.assertEqual(response.status_code, 201)
        self.code = response.data["data"]["code"]

    @skipUnless(connection.vendor == "postgresql", "Le test inter-connexions nécessite PostgreSQL; SQLite in-memory isole les threads.")
    def test_two_concurrent_consumptions_have_at_most_one_success(self):
        def attempt():
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(self.doctor)
                response = client.post("/api/v1/establishments/join-codes/redeem/", {"code": self.code, "agreement_accepted": True, "agreement_version": "2026-10-08-v1"}, format="json")
                return response.status_code, response.data
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as executor:
            statuses = list(executor.map(lambda _: attempt(), range(2)))
        self.assertEqual([s for s, _ in statuses].count(201), 1, statuses)
        self.assertEqual(EstablishmentJoinCode.objects.filter(consumed_at__isnull=False).count(), 1)
        self.assertEqual(EstablishmentMembership.objects.filter(establishment=self.site).count(), 1)

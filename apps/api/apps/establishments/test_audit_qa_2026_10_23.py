"""Correctifs de l'audit QA du 23/10/2026 : une décision ne vaut que pour une demande en attente."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.models import AccountContext
from apps.professionals.models import ProfessionalProfile
from .models import Establishment, EstablishmentAdministrator, EstablishmentMembership

User = get_user_model()


class MembershipDecisionOnlyWhenPendingTests(TestCase):
    def setUp(self):
        staff = User.objects.create_user(username="staff-qa", password="staff-password", is_staff=True)
        self.admin = User.objects.create_user(username="admin-qa", email="admin-qa@test", password="admin-password")
        self.doctor = User.objects.create_user(username="doctor-qa", email="doctor-qa@test", password="doctor-password")
        self.profile = ProfessionalProfile.objects.create(user=self.doctor, professional_title="Médecin")
        self.site = Establishment.objects.create(name="Site QA", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="qa@test", responsible_name="A", status="active")
        EstablishmentAdministrator.objects.create(establishment=self.site, user=self.admin, assigned_by=staff)
        AccountContext.objects.create(user=self.doctor, role="professional", is_active=True)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def decide(self, membership, decision):
        return self.client.post(f"/api/v1/establishments/{self.site.id}/memberships/{membership.id}/decision/", {"decision": decision}, format="json")

    def membership(self, status):
        return EstablishmentMembership.objects.create(establishment=self.site, professional=self.profile, status=status, agreement_version="2026-10-08-v1", agreement_accepted_at=timezone.now())

    def test_pending_request_can_still_be_decided(self):
        membership = self.membership("pending")
        self.assertEqual(self.decide(membership, "approve").status_code, 200)
        membership.refresh_from_db()
        self.assertEqual(membership.status, "active")

    def test_a_membership_the_doctor_left_cannot_be_reactivated_by_the_administrator(self):
        membership = self.membership("terminated")
        self.assertEqual(self.decide(membership, "approve").status_code, 400)
        membership.refresh_from_db()
        self.assertEqual(membership.status, "terminated")

    def test_a_refused_request_stays_refused_and_an_active_one_is_not_re_decided(self):
        refused = self.membership("refused")
        self.assertEqual(self.decide(refused, "approve").status_code, 400)
        refused.refresh_from_db()
        self.assertEqual(refused.status, "refused")
        refused.delete()
        active = self.membership("active")
        self.assertEqual(self.decide(active, "refuse").status_code, 400)
        active.refresh_from_db()
        self.assertEqual(active.status, "active")

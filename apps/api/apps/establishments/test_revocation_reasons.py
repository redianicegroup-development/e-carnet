"""Révocation avec motif : un établissement retire un professionnel ou un administrateur de laboratoire en disant pourquoi.

Le motif est obligatoire, la personne le lit à sa prochaine connexion (`revocation_notices`), un push l'avertit sans le révéler,
et l'accès s'arrête aussitôt."""
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.identity.models import AccountContext
from apps.professionals.models import ProfessionalProfile
from .models import Establishment, EstablishmentAdministrator, EstablishmentMembership
from .revocations import REASON_MAX_LENGTH, clean_reason

User = get_user_model()
REASON = "Fin de la collaboration au 30 novembre"


class CleanReasonTests(TestCase):
    def test_reason_is_trimmed_and_bounded(self):
        self.assertEqual(clean_reason("  Fin   de   contrat  "), ("Fin de contrat", None))
        for bad in (None, 12, "", "   ", "ab"):
            reason, error = clean_reason(bad)
            self.assertIsNone(reason)
            self.assertTrue(error)
        self.assertTrue(clean_reason("x" * (REASON_MAX_LENGTH + 1))[1])
        self.assertEqual(clean_reason("x" * REASON_MAX_LENGTH)[1], None)


class MembershipRevocationTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="rev-staff", password="staff-password", is_staff=True)
        self.admin = User.objects.create_user(username="rev-admin", email="rev-admin@test", password="admin-password")
        self.doctor = User.objects.create_user(username="rev-doctor", email="rev-doctor@test", password="doctor-password", first_name="Awa", last_name="Kone")
        self.profile = ProfessionalProfile.objects.create(user=self.doctor, professional_title="Médecin", specialty="Généraliste")
        self.establishment = Establishment.objects.create(name="Clinique motif", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="motif@test", responsible_name="Admin", status="active")
        EstablishmentAdministrator.objects.create(establishment=self.establishment, user=self.admin, assigned_by=self.staff)
        for user, role in ((self.admin, "establishment"), (self.doctor, "professional")):
            AccountContext.objects.create(user=user, role=role, is_active=True)
        self.membership = EstablishmentMembership.objects.create(establishment=self.establishment, professional=self.profile, status="active")
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(self.admin)
        self.url = f"/api/v1/establishments/{self.establishment.id}/memberships/{self.membership.id}/terminate/"

    def test_a_reason_is_required(self):
        for body in ({}, {"reason": ""}, {"reason": "  "}, {"reason": "ab"}):
            response = self.admin_client.post(self.url, body, format="json")
            self.assertEqual(response.status_code, 400, body)
        self.membership.refresh_from_db()
        self.assertEqual(self.membership.status, "active")

    def test_the_reason_is_stored_and_the_professional_is_warned_without_the_reason(self):
        with mock.patch("apps.care.push.send_push_to_user") as push, self.captureOnCommitCallbacks(execute=True):
            response = self.admin_client.post(self.url, {"reason": REASON}, format="json")
        self.assertEqual(response.status_code, 200)
        self.membership.refresh_from_db()
        self.assertEqual((self.membership.status, self.membership.terminated_by_establishment, self.membership.termination_reason), ("terminated", True, REASON))
        self.assertIsNone(self.membership.termination_notice_seen_at)
        push.assert_called_once()
        args, kwargs = push.call_args
        self.assertEqual(args[0], self.doctor.id)
        self.assertNotIn(REASON, str(args) + str(kwargs), "le motif ne doit jamais apparaître sur un écran verrouillé")

    def test_the_professional_reads_the_reason_at_the_next_login_then_it_disappears(self):
        self.admin_client.post(self.url, {"reason": REASON}, format="json")
        doctor_client = APIClient()
        doctor_client.force_authenticate(self.doctor)
        notices = doctor_client.get("/api/v1/identity/me/").data["data"]["revocation_notices"]
        self.assertEqual(len(notices), 1)
        self.assertEqual((notices[0]["kind"], notices[0]["reason"], notices[0]["establishment_name"]), ("membership", REASON, "Clinique motif"))
        ack = doctor_client.post("/api/v1/establishments/revocation-notices/ack/", {"id": notices[0]["id"], "kind": "membership"}, format="json")
        self.assertEqual(ack.status_code, 200)
        self.assertEqual(doctor_client.get("/api/v1/identity/me/").data["data"]["revocation_notices"], [])

    def test_a_professional_who_leaves_alone_gets_no_notice(self):
        doctor_client = APIClient()
        doctor_client.force_authenticate(self.doctor)
        self.assertEqual(doctor_client.post(f"/api/v1/establishments/{self.establishment.id}/memberships/leave/", format="json").status_code, 200)
        self.assertEqual(doctor_client.get("/api/v1/identity/me/").data["data"]["revocation_notices"], [])

    def test_someone_else_cannot_acknowledge_the_notice(self):
        self.admin_client.post(self.url, {"reason": REASON}, format="json")
        stranger = User.objects.create_user(username="rev-stranger", password="x-password-long")
        client = APIClient()
        client.force_authenticate(stranger)
        client.post("/api/v1/establishments/revocation-notices/ack/", {"id": str(self.membership.id), "kind": "membership"}, format="json")
        self.membership.refresh_from_db()
        self.assertIsNone(self.membership.termination_notice_seen_at)


@override_settings(ECARNET_LAB_ENABLED=True)
class LaboratoryAdministratorRevocationTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="lab-rev-staff", password="staff-password", is_staff=True)
        self.boss = User.objects.create_user(username="lab-rev-boss", email="boss@lab.test", password="boss-password")
        self.clinic = Establishment.objects.create(name="Clinique labo", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="c@test", responsible_name="Boss", status="active")
        EstablishmentAdministrator.objects.create(establishment=self.clinic, user=self.boss, assigned_by=self.staff)
        self.client = APIClient()
        self.client.force_authenticate(self.boss)
        created = self.client.post(f"/api/v1/establishments/{self.clinic.id}/laboratories/", {"admin_email": "labo@example.test", "admin_first_name": "Awa", "admin_last_name": "Traore"}, format="json")
        self.assertEqual(created.status_code, 201)
        self.lab = Establishment.objects.get(parent=self.clinic)
        self.lab_admin = User.objects.get(email="labo@example.test")
        self.record = EstablishmentAdministrator.objects.get(establishment=self.lab, user=self.lab_admin)
        self.url = f"/api/v1/establishments/{self.clinic.id}/laboratories/{self.lab.id}/administrators/{self.record.id}/revoke/"

    def test_the_listing_carries_the_ids_and_the_names_for_the_profile_modal(self):
        item = self.client.get(f"/api/v1/establishments/{self.clinic.id}/laboratories/").data["data"][0]["administrators"][0]
        self.assertEqual((item["id"], item["first_name"], item["last_name"], item["email"]), (str(self.record.id), "Awa", "Traore", "labo@example.test"))

    def test_a_reason_is_required(self):
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 400)
        self.record.refresh_from_db()
        self.assertEqual(self.record.status, "active")

    def test_revocation_stops_access_stores_the_reason_and_warns_without_it(self):
        with mock.patch("apps.care.push.send_push_to_user") as push, self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(self.url, {"reason": REASON}, format="json")
        self.assertEqual(response.status_code, 200)
        self.record.refresh_from_db()
        self.assertEqual((self.record.status, self.record.end_reason, self.record.ended_by_id), ("revoked", REASON, self.boss.id))
        self.assertIsNotNone(self.record.ended_at)
        push.assert_called_once()
        self.assertNotIn(REASON, str(push.call_args))
        lab_client = APIClient()
        lab_client.force_authenticate(self.lab_admin)
        self.assertEqual(lab_client.get(f"/api/v1/establishments/{self.lab.id}/laboratories/").status_code, 403)
        notices = lab_client.get("/api/v1/identity/me/").data["data"]["revocation_notices"]
        self.assertEqual((len(notices), notices[0]["kind"], notices[0]["reason"], notices[0]["parent_name"]), (1, "laboratory", REASON, "Clinique labo"))
        self.assertEqual(lab_client.post("/api/v1/establishments/revocation-notices/ack/", {"all": True}, format="json").status_code, 200)
        self.assertEqual(lab_client.get("/api/v1/identity/me/").data["data"]["revocation_notices"], [])
        self.assertEqual(self.client.get(f"/api/v1/establishments/{self.clinic.id}/laboratories/").data["data"][0]["administrators"], [])

    def test_only_the_parent_administrator_can_revoke(self):
        stranger = User.objects.create_user(username="lab-rev-stranger", password="x-password-long")
        other_clinic = Establishment.objects.create(name="Autre clinique", establishment_type="Clinique", city="Bouaké", address="B", phone="1", email="o@test", responsible_name="O", status="active")
        EstablishmentAdministrator.objects.create(establishment=other_clinic, user=stranger, assigned_by=self.staff)
        outsider = APIClient()
        outsider.force_authenticate(stranger)
        self.assertEqual(outsider.post(self.url, {"reason": REASON}, format="json").status_code, 403)
        self.assertEqual(outsider.post(f"/api/v1/establishments/{other_clinic.id}/laboratories/{self.lab.id}/administrators/{self.record.id}/revoke/", {"reason": REASON}, format="json").status_code, 404)
        lab_client = APIClient()
        lab_client.force_authenticate(self.lab_admin)
        self.assertEqual(lab_client.post(f"/api/v1/establishments/{self.lab.id}/laboratories/{self.lab.id}/administrators/{self.record.id}/revoke/", {"reason": REASON}, format="json").status_code, 403)
        self.record.refresh_from_db()
        self.assertEqual(self.record.status, "active")

    def test_a_revoked_administrator_cannot_be_revoked_twice(self):
        self.client.post(self.url, {"reason": REASON}, format="json")
        self.assertEqual(self.client.post(self.url, {"reason": REASON}, format="json").status_code, 404)

"""Code médecin réaffiché 48 h à l'administrateur, puis effacé ; photo et logo dans les listes."""
import base64
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.models import AccountContext, AccountProfile
from apps.professionals.models import ProfessionalProfile
from .join_code_crypto import seal_code, unseal_code
from .models import Establishment, EstablishmentAdministrator, EstablishmentJoinCode, EstablishmentMembership

User = get_user_model()
AGREEMENT = {"agreement_accepted": True, "agreement_version": "2026-10-08-v1"}
PIXEL = "data:image/webp;base64," + base64.b64encode(b"RIFF....WEBPVP8 ").decode()


class JoinCodeDisplayTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(username="staff-show", password="staff-password", is_staff=True)
        self.admin = User.objects.create_user(username="admin-show", email="admin-show@test", password="admin-password")
        self.other_admin = User.objects.create_user(username="admin-other", email="admin-other@test", password="admin-password")
        self.doctor = User.objects.create_user(username="doctor-show", email="doctor-show@test", password="doctor-password", first_name="Awa", last_name="Kone")
        self.profile = ProfessionalProfile.objects.create(user=self.doctor, professional_title="Médecin")
        self.establishment = Establishment.objects.create(name="Clinique affichage", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="show@test", responsible_name="Admin", status="active", logo_url="https://images.example.test/logo.png")
        self.other = Establishment.objects.create(name="Autre clinique", establishment_type="Clinique", city="Bouaké", address="B", phone="1", email="other@test", responsible_name="Autre", status="active")
        EstablishmentAdministrator.objects.create(establishment=self.establishment, user=self.admin, assigned_by=self.staff)
        EstablishmentAdministrator.objects.create(establishment=self.other, user=self.other_admin, assigned_by=self.staff)
        for user, role in ((self.admin, "establishment"), (self.other_admin, "establishment"), (self.doctor, "professional")):
            AccountContext.objects.create(user=user, role=role, is_active=True)

    def url(self, suffix=""):
        return f"/api/v1/establishments/{self.establishment.id}/join-codes/{suffix}"

    def issue(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.url(), format="json")
        self.assertEqual(response.status_code, 201)
        return response.data["data"]["code"]

    def test_sealed_code_round_trips_and_is_not_readable_as_stored(self):
        sealed = seal_code("ECM-ABC123")
        self.assertNotIn("ECM-ABC123", sealed)
        self.assertEqual(unseal_code(sealed), "ECM-ABC123")
        self.assertEqual(unseal_code(""), "")
        self.assertEqual(unseal_code("not-a-valid-token"), "")

    def test_created_code_is_listed_again_with_its_expiry(self):
        code = self.issue()
        listed = self.client.get(self.url("active/"))
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed["Cache-Control"], "no-store")
        rows = listed.data["data"]
        self.assertEqual([row["code"] for row in rows], [code])
        self.assertNotIn(code, EstablishmentJoinCode.objects.get().code_encrypted)

    def test_used_code_disappears_and_its_secret_copy_is_erased(self):
        code = self.issue()
        self.client.force_authenticate(self.doctor)
        self.assertEqual(self.client.post("/api/v1/establishments/join-codes/redeem/", {"code": code, **AGREEMENT}, format="json").status_code, 201)
        self.assertEqual(EstablishmentJoinCode.objects.get().code_encrypted, "")
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(self.url("active/")).data["data"], [])

    def test_code_disappears_after_48_hours_and_is_erased(self):
        self.issue()
        record = EstablishmentJoinCode.objects.get()
        record.expires_at = timezone.now() - timedelta(seconds=1)
        record.save(update_fields=("expires_at",))
        self.assertEqual(self.client.get(self.url("active/")).data["data"], [])
        record.refresh_from_db()
        self.assertEqual(record.code_encrypted, "")

    def test_revoked_code_is_not_listed(self):
        self.issue()
        record = EstablishmentJoinCode.objects.get()
        record.revoked_at = timezone.now()
        record.save(update_fields=("revoked_at",))
        self.assertEqual(self.client.get(self.url("active/")).data["data"], [])

    def test_only_the_structure_administrator_can_read_its_codes(self):
        self.issue()
        for user in (self.other_admin, self.doctor):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(self.url("active/")).status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(self.url("active/")).status_code, (401, 403))

    def test_member_list_carries_the_doctor_photo(self):
        AccountProfile.objects.create(user=self.doctor, avatar_url="https://images.example.test/awa.png")
        membership = EstablishmentMembership.objects.create(establishment=self.establishment, professional=self.profile, status="active")
        self.client.force_authenticate(self.admin)
        rows = self.client.get(f"/api/v1/establishments/{self.establishment.id}/memberships/").data["data"]
        self.assertEqual(rows[0]["id"], str(membership.id))
        self.assertEqual(rows[0]["professional_avatar_url"], "https://images.example.test/awa.png")

    def test_stored_photo_is_served_only_to_the_structure_administrator(self):
        AccountProfile.objects.create(user=self.doctor, avatar_data=PIXEL)
        membership = EstablishmentMembership.objects.create(establishment=self.establishment, professional=self.profile, status="active")
        self.client.force_authenticate(self.admin)
        rows = self.client.get(f"/api/v1/establishments/{self.establishment.id}/memberships/").data["data"]
        self.assertIn(f"/memberships/{membership.id}/avatar/", rows[0]["professional_avatar_url"])
        route = f"/api/v1/establishments/{self.establishment.id}/memberships/{membership.id}/avatar/"
        self.assertEqual(self.client.get(route).status_code, 200)
        self.client.force_authenticate(self.other_admin)
        self.assertEqual(self.client.get(route).status_code, 404)
        self.client.force_authenticate(self.doctor)
        self.assertEqual(self.client.get(route).status_code, 404)

    def test_doctor_memberships_carry_the_establishment_logo(self):
        EstablishmentMembership.objects.create(establishment=self.establishment, professional=self.profile, status="pending")
        self.client.force_authenticate(self.doctor)
        data = self.client.get("/api/v1/professionals/me/").data["data"]
        self.assertEqual(data["memberships"][0]["establishment_logo"], "https://images.example.test/logo.png")

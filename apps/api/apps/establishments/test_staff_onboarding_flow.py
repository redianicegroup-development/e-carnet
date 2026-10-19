"""Parcours « équipe E‑Carnet → établissement » : le staff saisit le nom et l'e‑mail du responsable, l'établissement
active son accès puis complète lui‑même sa fiche dans son onboarding."""
from datetime import timedelta
from unittest import mock
from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.models import AccountContext

from .models import Establishment, EstablishmentAdminInvitation, EstablishmentAdministrator

User = get_user_model()
STAFF_URL = "/api/v1/establishments/startup/establishments/"
ACCEPT_URL = "/api/v1/establishments/invitations/accept/"
PREVIEW_URL = "/api/v1/establishments/invitations/preview/"
PASSWORD = "a-very-long-password-2026"
FICHE = {"establishment_type": "Clinique", "city": "Abidjan", "address": "Rue des Jardins", "phone": "+225 07 00 00 00 00", "email": "contact@clinique.test"}


def token_from_mail():
    url = next(part for part in mail.outbox[-1].body.split() if "activation?token=" in part)
    return parse_qs(urlparse(url).query)["token"][0]


@override_settings(DEBUG=True, EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class StaffOnboardingFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(username="staff@example.test", email="staff@example.test", password="staff-password", is_staff=True)
        self.minimal = {"name": "Clinique des Jardins", "responsible_email": "Responsable@Clinique.test", "verification_confirmed": True}

    def create(self, payload=None, expected=201):
        self.client.force_authenticate(self.staff)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(STAFF_URL, payload or self.minimal, format="json")
        self.assertEqual(response.status_code, expected, response.data)
        return response

    def activate(self, token=None, **extra):
        client = APIClient()
        return client.post(ACCEPT_URL, {"token": token or token_from_mail(), "password": PASSWORD, **extra}, format="json")

    # --- création par le staff
    def test_name_and_responsible_email_are_enough_and_everything_else_is_left_to_the_establishment(self):
        response = self.create()
        establishment = Establishment.objects.get()
        self.assertEqual(establishment.name, "Clinique des Jardins")
        self.assertEqual((establishment.city, establishment.address, establishment.phone, establishment.establishment_type), ("", "", "", ""))
        self.assertRegex(establishment.internal_code, r"^ETB-[A-HJ-NP-Z2-9]{6}$")
        self.assertIsNone(establishment.profile_completed_at)
        self.assertEqual(response.data["data"]["establishment"]["internal_code"], establishment.internal_code)
        self.assertEqual(response.data["data"]["email_delivery"], "sent")
        self.assertNotIn("manual_invitation_url", response.data["data"])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["responsable@clinique.test"])
        self.assertNotIn("token", str(response.data))

    def test_staff_must_confirm_the_offline_verification_and_give_a_valid_email(self):
        self.create({**self.minimal, "verification_confirmed": False}, expected=400)
        self.create({"name": "X", "responsible_email": "pas-un-email", "verification_confirmed": True}, expected=400)
        self.create({"name": "  ", "responsible_email": "a@b.test", "verification_confirmed": True}, expected=400)
        self.assertEqual(Establishment.objects.count(), 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_homonym_is_blocked_unless_the_team_explicitly_allows_it(self):
        self.create()
        response = self.create({**self.minimal, "name": "clinique   des jardins"}, expected=409)
        self.assertEqual(response.data["code"], "duplicate_name")
        self.assertIn(Establishment.objects.get().internal_code, response.data["message"])
        self.create({**self.minimal, "name": "clinique des jardins", "allow_duplicate": True})
        self.assertEqual(Establishment.objects.count(), 2)

    def test_mail_failure_does_not_break_the_request_and_is_visible_then_resendable(self):
        self.client.force_authenticate(self.staff)
        with mock.patch("apps.establishments.views.send_establishment_invitation", side_effect=OSError("smtp down")):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(STAFF_URL, self.minimal, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["data"]["email_delivery"], "failed")
        manual_url = response.data["data"]["manual_invitation_url"]
        raw_token = parse_qs(urlparse(manual_url).query)["token"][0]
        invitation = EstablishmentAdminInvitation.objects.get()
        self.assertEqual(EstablishmentAdminInvitation.digest(raw_token), invitation.token_hash)
        listing = self.client.get(STAFF_URL).data["data"]["items"]
        self.assertEqual(listing[0]["invitation"]["state"], "failed")
        self.assertNotIn("manual_invitation_url", str(listing), "le lien brut ne doit pas apparaître dans la liste admin")
        with self.captureOnCommitCallbacks(execute=True):
            resent = self.client.post(f"/api/v1/establishments/startup/{listing[0]['id']}/administrator-invitation/", {}, format="json")
        self.assertEqual(resent.status_code, 200, resent.data)
        self.assertEqual(resent.data["data"]["email_delivery"], "sent")
        self.assertNotIn("manual_invitation_url", resent.data["data"])
        self.assertEqual(self.client.get(STAFF_URL).data["data"]["items"][0]["invitation"]["state"], "sent")
        self.assertEqual(Establishment.objects.count(), 1, "le renvoi ne doit pas créer de doublon")

    def test_only_staff_can_list_create_resend_or_revoke(self):
        outsider = User.objects.create_user(username="x@example.test", email="x@example.test", password="x-password")
        self.client.force_authenticate(outsider)
        self.assertEqual(self.client.get(STAFF_URL).status_code, 403)
        self.assertEqual(self.client.post(STAFF_URL, self.minimal, format="json").status_code, 403)

    # --- suivi côté équipe
    def test_listing_follows_the_establishment_from_invitation_to_ready(self):
        self.create()
        item = self.client.get(STAFF_URL).data["data"]["items"][0]
        self.assertEqual((item["stage"], item["invitation"]["state"], item["administrator"]), ("awaiting_activation", "sent", None))
        self.assertEqual(self.activate(first_name="Amina", last_name="Koné").status_code, 200)
        item = self.client.get(STAFF_URL).data["data"]["items"][0]
        self.assertEqual((item["stage"], item["invitation"]["state"]), ("awaiting_profile", "consumed"))
        admin = APIClient()
        admin.force_authenticate(User.objects.get(email="responsable@clinique.test"))
        self.assertEqual(admin.patch(f"/api/v1/establishments/{item['id']}/profile/", FICHE, format="json").status_code, 200)
        self.assertEqual(self.client.get(STAFF_URL).data["data"]["items"][0]["stage"], "ready")

    def test_revoke_makes_the_link_unusable_and_expired_links_are_reported(self):
        self.create()
        token = token_from_mail()
        establishment = Establishment.objects.get()
        revoke = f"/api/v1/establishments/startup/{establishment.id}/administrator-invitation/revoke/"
        self.assertEqual(self.client.post(revoke).data["data"]["revoked"], 1)
        self.assertEqual(self.client.post(revoke).status_code, 409)
        self.assertEqual(self.activate(token).status_code, 400)
        self.assertEqual(self.client.get(STAFF_URL).data["data"]["items"][0]["invitation"]["state"], "revoked")
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(f"/api/v1/establishments/startup/{establishment.id}/administrator-invitation/", {}, format="json")
        EstablishmentAdminInvitation.objects.filter(revoked_at__isnull=True).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.client.get(STAFF_URL).data["data"]["items"][0]["invitation"]["state"], "expired")

    def test_replacing_a_live_administrator_needs_explicit_confirmation(self):
        self.create()
        self.assertEqual(self.activate(first_name="Amina", last_name="Koné").status_code, 200)
        establishment = Establishment.objects.get()
        url = f"/api/v1/establishments/startup/{establishment.id}/administrator-invitation/"
        self.assertEqual(self.client.post(url, {}, format="json").data["code"], "already_active")
        self.assertEqual(self.client.post(url, {"email": "autre@clinique.test"}, format="json").data["code"], "administrator_exists")
        self.assertEqual(self.client.post(url, {"email": "autre@clinique.test", "confirm_replace": True}, format="json").status_code, 200)

    # --- activation par l'établissement
    def test_activation_creates_the_account_and_leaves_the_onboarding_to_complete(self):
        self.create()
        self.assertEqual(self.client.get(PREVIEW_URL, {"token": token_from_mail()}).data["data"]["needs_names"], True)
        response = self.activate(first_name="Amina", last_name="Koné")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual((response.data["data"]["account_created"], response.data["data"]["profile_required"]), (True, True))
        user = User.objects.get(email="responsable@clinique.test")
        self.assertTrue(user.check_password(PASSWORD))
        self.assertEqual(Establishment.objects.get().responsible_name, "Amina Koné")
        self.assertFalse(AccountContext.objects.get(user=user, role="establishment").onboarding_completed)

    def test_names_are_required_when_the_team_did_not_provide_them(self):
        self.create()
        self.assertEqual(self.activate().status_code, 400)
        self.assertFalse(User.objects.filter(email="responsable@clinique.test").exists())

    def test_invitation_link_never_overwrites_an_existing_account(self):
        victim = User.objects.create_user(username="responsable@clinique.test", email="responsable@clinique.test", password="Original-password-2026")
        self.create()
        token = token_from_mail()
        preview = self.client.get(PREVIEW_URL, {"token": token}).data["data"]
        self.assertTrue(preview["account_exists"])
        response = self.activate(token, first_name="Pirate", last_name="Pirate")
        self.assertEqual((response.status_code, response.data["code"]), (409, "account_exists"))
        victim.refresh_from_db()
        self.assertTrue(victim.check_password("Original-password-2026"))
        self.assertEqual(victim.first_name, "")
        self.assertEqual(EstablishmentAdministrator.objects.count(), 0)
        self.assertTrue(EstablishmentAdminInvitation.objects.get().is_usable, "le lien reste utilisable pour le vrai propriétaire")

    def test_existing_account_can_accept_once_logged_in_without_changing_its_password(self):
        owner = User.objects.create_user(username="responsable@clinique.test", email="responsable@clinique.test", password="Original-password-2026", first_name="Awa")
        self.create()
        token = token_from_mail()
        client = APIClient()
        client.force_authenticate(owner)
        response = client.post(ACCEPT_URL, {"token": token}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data["data"]["account_created"])
        owner.refresh_from_db()
        self.assertTrue(owner.check_password("Original-password-2026"))
        self.assertEqual(owner.first_name, "Awa")
        self.assertEqual(EstablishmentAdministrator.objects.filter(user=owner, status="active").count(), 1)

    def test_logged_in_stranger_cannot_use_someone_elses_invitation(self):
        User.objects.create_user(username="responsable@clinique.test", email="responsable@clinique.test", password="Original-password-2026")
        stranger = User.objects.create_user(username="intrus@example.test", email="intrus@example.test", password="Intrus-password-2026")
        self.create()
        client = APIClient()
        client.force_authenticate(stranger)
        self.assertEqual(client.post(ACCEPT_URL, {"token": token_from_mail()}, format="json").status_code, 409)

    # --- fiche de l'établissement
    def admin_client(self):
        self.create()
        self.activate(first_name="Amina", last_name="Koné")
        client = APIClient()
        client.force_authenticate(User.objects.get(email="responsable@clinique.test"))
        return client, Establishment.objects.get()

    def test_profile_completion_unlocks_catalog_and_join_codes_and_ends_onboarding(self):
        client, establishment = self.admin_client()
        url = f"/api/v1/establishments/{establishment.id}/profile/"
        codes = f"/api/v1/establishments/{establishment.id}/join-codes/"
        self.assertEqual(client.post(codes).data["code"], "profile_incomplete")
        self.assertEqual(client.get("/api/v1/establishments/catalog/").data["data"], [])
        partial = client.patch(url, {"city": "Abidjan"}, format="json")
        self.assertEqual((partial.status_code, partial.data["data"]["profile_complete"]), (200, False))
        self.assertEqual(sorted(partial.data["data"]["missing_fields"]), ["address", "email", "establishment_type", "phone"])
        done = client.patch(url, FICHE, format="json")
        self.assertEqual((done.status_code, done.data["data"]["profile_complete"]), (200, True), done.data)
        establishment.refresh_from_db()
        self.assertIsNotNone(establishment.profile_completed_at)
        self.assertTrue(AccountContext.objects.get(user__email="responsable@clinique.test", role="establishment").onboarding_completed)
        self.assertEqual(client.post(codes).status_code, 201)
        self.assertEqual([item["name"] for item in client.get("/api/v1/establishments/catalog/").data["data"]], ["Clinique des Jardins"])

    def test_verified_fields_are_locked_and_bad_values_are_rejected(self):
        client, establishment = self.admin_client()
        url = f"/api/v1/establishments/{establishment.id}/profile/"
        self.assertEqual(client.patch(url, {"name": "Autre nom"}, format="json").status_code, 400)
        self.assertEqual(client.patch(url, {"responsible_name": "Quelqu'un d'autre"}, format="json").status_code, 400)
        self.assertEqual(client.patch(url, {"name": establishment.name, **FICHE}, format="json").status_code, 200)
        self.assertEqual(client.patch(url, {"phone": "abc"}, format="json").status_code, 400)
        self.assertEqual(client.patch(url, {"city": "   "}, format="json").status_code, 400)
        establishment.refresh_from_db()
        self.assertEqual(establishment.name, "Clinique des Jardins")

    def test_only_the_active_administrator_can_read_or_edit_the_profile(self):
        _, establishment = self.admin_client()
        outsider = APIClient()
        outsider.force_authenticate(User.objects.create_user(username="o@example.test", email="o@example.test", password="o-password"))
        url = f"/api/v1/establishments/{establishment.id}/profile/"
        self.assertEqual(outsider.get(url).status_code, 403)
        self.assertEqual(outsider.patch(url, FICHE, format="json").status_code, 403)
        self.assertEqual(APIClient().get(url).status_code, 403)

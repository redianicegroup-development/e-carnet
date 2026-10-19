"""Parcours « équipe E‑Carnet → établissement » : le staff saisit le nom et l'e‑mail du responsable, le serveur crée son compte
avec un mot de passe temporaire à usage unique (révélé une seule fois au staff), le responsable se connecte, doit le remplacer,
puis complète lui‑même la fiche de son établissement."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.identity.models import AccountContext, AccountProfile

from .models import Establishment, EstablishmentAdminInvitation, EstablishmentAdministrator

User = get_user_model()
STAFF_URL = "/api/v1/establishments/startup/establishments/"
LOGIN_URL = "/api/v1/identity/login/"
ME_URL = "/api/v1/identity/me/"
PASSWORD_URL = "/api/v1/identity/me/password/"
ACCEPT_URL = "/api/v1/establishments/invitations/accept/"
EMAIL = "responsable@clinique.test"
NEW_PASSWORD = "a-very-long-password-2026"
FICHE = {"establishment_type": "Clinique", "city": "Abidjan", "address": "Rue des Jardins", "phone": "+225 07 00 00 00 00", "email": "contact@clinique.test"}


@override_settings(DEBUG=True, EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class StaffOnboardingFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(username="staff@example.test", email="staff@example.test", password="staff-password", is_staff=True)
        self.minimal = {"name": "Clinique des Jardins", "responsible_email": "Responsable@Clinique.test", "verification_confirmed": True}

    def create(self, payload=None, expected=201):
        self.client.force_authenticate(self.staff)
        response = self.client.post(STAFF_URL, payload or self.minimal, format="json")
        self.assertEqual(response.status_code, expected, response.data)
        return response

    def login(self, password, email=EMAIL):
        client = APIClient()
        return client, client.post(LOGIN_URL, {"email": email, "password": password}, format="json")

    def activate(self, temporary_password, first_name="Amina", last_name="Koné", new_password=NEW_PASSWORD):
        """Ce que fait le responsable : se connecter avec le mot de passe temporaire, puis choisir le sien."""
        client, login = self.login(temporary_password)
        self.assertEqual(login.status_code, 200, login.data)
        changed = client.post(PASSWORD_URL, {"current_password": temporary_password, "new_password": new_password, "first_name": first_name, "last_name": last_name}, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        return client

    def create_and_activate(self):
        temporary = self.create().data["data"]["temporary_password"]
        return self.activate(temporary), Establishment.objects.get()

    # --- création par le staff
    def test_name_and_responsible_email_are_enough_and_the_server_creates_the_account(self):
        response = self.create()
        data = response.data["data"]
        establishment = Establishment.objects.get()
        self.assertEqual(establishment.name, "Clinique des Jardins")
        self.assertEqual((establishment.city, establishment.address, establishment.phone, establishment.establishment_type), ("", "", "", ""))
        self.assertRegex(establishment.internal_code, r"^ETB-[A-HJ-NP-Z2-9]{6}$")
        self.assertIsNone(establishment.profile_completed_at)
        self.assertEqual(data["establishment"]["internal_code"], establishment.internal_code)
        # Le serveur a mémorisé l'e‑mail (en minuscules) et ouvert le compte avec le mot de passe temporaire révélé au staff.
        self.assertEqual(data["email"], EMAIL)
        self.assertTrue(data["account_created"] and data["must_change_password"])
        self.assertTrue(data["login_url"].endswith("/connexion"))
        user = User.objects.get(email=EMAIL)
        self.assertTrue(user.check_password(data["temporary_password"]))
        self.assertTrue(AccountProfile.objects.get(user=user).must_change_password)
        self.assertEqual(EstablishmentAdministrator.objects.get().user, user)
        context = AccountContext.objects.get(user=user, role="establishment")
        self.assertTrue(context.is_active)
        self.assertFalse(context.onboarding_completed)
        self.assertEqual(len(mail.outbox), 0, "aucun courriel n'est nécessaire : l'ouverture de l'accès ne dépend plus du SMTP")

    def test_the_temporary_password_is_a_secret_shown_once_and_never_stored_or_listed(self):
        response = self.create()
        secret = response.data["data"]["temporary_password"]
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertGreaterEqual(len(secret), 16)
        self.assertNotIn(secret, User.objects.get(email=EMAIL).password, "seul un hachage est conservé")
        self.assertNotIn(secret, str(self.client.get(STAFF_URL).data), "la liste du staff ne le révèle jamais")
        self.assertNotIn(secret, str(list(AuditEvent.objects.values_list("metadata", flat=True))))
        again = self.client.post(f"/api/v1/establishments/startup/{Establishment.objects.get().id}/administrator-invitation/", {}, format="json")
        self.assertNotEqual(again.data["data"]["temporary_password"], secret, "chaque émission est un nouveau mot de passe")

    def test_staff_must_confirm_the_offline_verification_and_give_a_valid_email(self):
        self.create({**self.minimal, "verification_confirmed": False}, expected=400)
        self.create({"name": "X", "responsible_email": "pas-un-email", "verification_confirmed": True}, expected=400)
        self.create({"name": "  ", "responsible_email": "a@b.test", "verification_confirmed": True}, expected=400)
        self.assertEqual(Establishment.objects.count(), 0)
        self.assertFalse(User.objects.filter(email="a@b.test").exists())

    def test_homonym_is_blocked_unless_the_team_explicitly_allows_it(self):
        self.create()
        response = self.create({**self.minimal, "name": "clinique   des jardins", "responsible_email": "autre@clinique.test"}, expected=409)
        self.assertEqual(response.data["code"], "duplicate_name")
        self.assertIn(Establishment.objects.get().internal_code, response.data["message"])
        self.create({**self.minimal, "name": "clinique des jardins", "responsible_email": "autre@clinique.test", "allow_duplicate": True})
        self.assertEqual(Establishment.objects.count(), 2)

    def test_only_staff_can_list_create_resend_or_revoke(self):
        outsider = User.objects.create_user(username="x@example.test", email="x@example.test", password="x-password")
        self.client.force_authenticate(outsider)
        self.assertEqual(self.client.get(STAFF_URL).status_code, 403)
        self.assertEqual(self.client.post(STAFF_URL, self.minimal, format="json").status_code, 403)
        establishment = Establishment.objects.create(name="Autre", status="active")
        self.assertEqual(self.client.post(f"/api/v1/establishments/startup/{establishment.id}/administrator-invitation/", {}, format="json").status_code, 403)
        self.assertEqual(self.client.post(f"/api/v1/establishments/startup/{establishment.id}/administrator-invitation/revoke/", {}, format="json").status_code, 403)

    # --- e‑mail déjà connu du serveur
    def test_an_existing_account_is_never_touched_without_explicit_confirmation(self):
        victim = User.objects.create_user(username=EMAIL, email=EMAIL, password="Original-password-2026")
        response = self.create(expected=409)
        self.assertEqual(response.data["code"], "account_exists")
        victim.refresh_from_db()
        self.assertTrue(victim.check_password("Original-password-2026"))
        self.assertEqual((Establishment.objects.count(), EstablishmentAdministrator.objects.count()), (0, 0), "un conflit ne laisse aucune structure orpheline")

    def test_staff_can_link_an_existing_account_which_keeps_its_own_password(self):
        owner = User.objects.create_user(username=EMAIL, email=EMAIL, password="Original-password-2026", first_name="Awa", last_name="Koné")
        data = self.create({**self.minimal, "use_existing_account": True}).data["data"]
        self.assertFalse(data["account_created"] or data["must_change_password"])
        self.assertNotIn("temporary_password", data)
        owner.refresh_from_db()
        self.assertTrue(owner.check_password("Original-password-2026"))
        self.assertFalse(AccountProfile.objects.filter(user=owner, must_change_password=True).exists())
        self.assertEqual(EstablishmentAdministrator.objects.filter(user=owner, status="active").count(), 1)
        self.assertEqual(Establishment.objects.get().responsible_name, "Awa Koné")

    # --- connexion avec le mot de passe temporaire
    def test_temporary_password_only_opens_the_password_change(self):
        temporary = self.create().data["data"]["temporary_password"]
        client, login = self.login(temporary)
        self.assertEqual(login.status_code, 200, login.data)
        self.assertTrue(login.data["data"]["must_change_password"])
        self.assertTrue(client.get(ME_URL).data["data"]["must_change_password"], "le front lit le drapeau ici")
        for path in ("/api/v1/establishments/", f"/api/v1/establishments/{Establishment.objects.get().id}/profile/", "/api/v1/identity/contexts/select/"):
            blocked = client.get(path) if not path.endswith("select/") else client.post(path, {"role": "patient"}, format="json")
            self.assertEqual(blocked.status_code, 403, path)
            self.assertEqual(blocked.json()["code"], "password_change_required", path)
        self.assertEqual(client.post("/api/v1/identity/logout/").status_code, 200, "se déconnecter reste possible")

    def test_forced_change_replaces_the_temporary_password_which_then_stops_working(self):
        temporary = self.create().data["data"]["temporary_password"]
        client, _ = self.login(temporary)
        establishment = Establishment.objects.get()
        wrong = client.post(PASSWORD_URL, {"current_password": "pas-le-bon-mot-de-passe", "new_password": NEW_PASSWORD, "first_name": "A", "last_name": "B"}, format="json")
        self.assertEqual(wrong.status_code, 400)
        same = client.post(PASSWORD_URL, {"current_password": temporary, "new_password": temporary, "first_name": "A", "last_name": "B"}, format="json")
        self.assertEqual(same.status_code, 400)
        short = client.post(PASSWORD_URL, {"current_password": temporary, "new_password": "court", "first_name": "A", "last_name": "B"}, format="json")
        self.assertEqual(short.status_code, 400)
        no_names = client.post(PASSWORD_URL, {"current_password": temporary, "new_password": NEW_PASSWORD}, format="json")
        self.assertEqual((no_names.status_code, no_names.data["code"]), (400, "names_required"), "le staff n'a pas donné de nom : il est demandé ici")
        self.assertTrue(AccountProfile.objects.get(user__email=EMAIL).must_change_password, "aucun essai raté ne lève l'obligation")
        done = client.post(PASSWORD_URL, {"current_password": temporary, "new_password": NEW_PASSWORD, "first_name": "Amina", "last_name": "Koné"}, format="json")
        self.assertEqual(done.status_code, 200, done.data)
        self.assertFalse(done.data["data"]["must_change_password"])
        self.assertEqual(client.get(f"/api/v1/establishments/{establishment.id}/profile/").status_code, 200, "la session reste ouverte et l'API est rendue")
        establishment.refresh_from_db()
        self.assertEqual(establishment.responsible_name, "Amina Koné")
        self.assertEqual(self.login(temporary)[1].status_code, 400, "usage unique : le mot de passe temporaire ne fonctionne plus")
        self.assertEqual(self.login(NEW_PASSWORD)[1].status_code, 200)
        self.assertTrue(AuditEvent.objects.filter(event_type="account.password_changed", actor__email=EMAIL).exists())

    def test_names_given_by_the_team_are_kept_and_need_not_be_asked_again(self):
        temporary = self.create({**self.minimal, "responsible_first_name": "Amina", "responsible_last_name": "Koné"}).data["data"]["temporary_password"]
        self.assertEqual(Establishment.objects.get().responsible_name, "Amina Koné")
        client, _ = self.login(temporary)
        done = client.post(PASSWORD_URL, {"current_password": temporary, "new_password": NEW_PASSWORD}, format="json")
        self.assertEqual(done.status_code, 200, done.data)

    def test_an_expired_temporary_password_is_refused_like_any_wrong_password(self):
        temporary = self.create().data["data"]["temporary_password"]
        AccountProfile.objects.filter(user__email=EMAIL).update(temporary_password_expires_at=timezone.now() - timedelta(seconds=1))
        refused = self.login(temporary)[1]
        self.assertEqual((refused.status_code, refused.data["message"]), (400, "Email ou mot de passe incorrect."))
        listing = self.client.get(STAFF_URL).data["data"]["items"][0]
        self.assertEqual(listing["access"]["state"], "expired")
        reissued = self.client.post(f"/api/v1/establishments/startup/{listing['id']}/administrator-invitation/", {}, format="json")
        self.assertEqual(reissued.status_code, 200, reissued.data)
        self.assertEqual(self.login(reissued.data["data"]["temporary_password"])[1].status_code, 200)

    def test_a_regular_account_is_never_blocked(self):
        User.objects.create_user(username="patient@example.test", email="patient@example.test", password="patient-password-2026")
        client, login = self.login("patient-password-2026", "patient@example.test")
        self.assertEqual(login.status_code, 200)
        self.assertFalse(login.data["data"]["must_change_password"])
        self.assertEqual(client.get("/api/v1/establishments/").status_code, 200)

    # --- suivi côté équipe
    def test_listing_follows_the_establishment_from_temporary_password_to_ready(self):
        temporary = self.create().data["data"]["temporary_password"]
        item = self.client.get(STAFF_URL).data["data"]["items"][0]
        self.assertEqual((item["stage"], item["access"]["state"], item["access"]["email"]), ("awaiting_activation", "temporary_password", EMAIL))
        self.assertIsNotNone(item["access"]["expires_at"])
        admin = self.activate(temporary)
        item = self.client.get(STAFF_URL).data["data"]["items"][0]
        self.assertEqual((item["stage"], item["access"]["state"]), ("awaiting_profile", "activated"))
        self.assertEqual(item["administrator"]["name"], "Amina Koné")
        self.assertEqual(admin.patch(f"/api/v1/establishments/{item['id']}/profile/", FICHE, format="json").status_code, 200)
        self.assertEqual(self.client.get(STAFF_URL).data["data"]["items"][0]["stage"], "ready")

    def test_resend_gives_a_new_temporary_password_and_cancels_the_previous_one(self):
        first = self.create().data["data"]["temporary_password"]
        establishment = Establishment.objects.get()
        resent = self.client.post(f"/api/v1/establishments/startup/{establishment.id}/administrator-invitation/", {}, format="json")
        self.assertEqual(resent.status_code, 200, resent.data)
        self.assertEqual(resent["Cache-Control"], "no-store")
        second = resent.data["data"]["temporary_password"]
        self.assertNotEqual(first, second)
        self.assertEqual(self.login(first)[1].status_code, 400)
        self.assertEqual(self.login(second)[1].status_code, 200)
        self.assertEqual((Establishment.objects.count(), User.objects.filter(email=EMAIL).count(), EstablishmentAdministrator.objects.count()), (1, 1, 1), "aucun doublon")

    def test_revoke_makes_the_temporary_password_unusable(self):
        temporary = self.create().data["data"]["temporary_password"]
        establishment = Establishment.objects.get()
        revoke = f"/api/v1/establishments/startup/{establishment.id}/administrator-invitation/revoke/"
        self.assertEqual(self.client.post(revoke).data["data"]["revoked"], 1)
        self.assertEqual(self.client.post(revoke).status_code, 409)
        self.assertEqual(self.login(temporary)[1].status_code, 400)
        item = self.client.get(STAFF_URL).data["data"]["items"][0]
        self.assertEqual((item["administrator"], item["access"]["state"], item["access"]["email"]), (None, "revoked", EMAIL))
        reopened = self.client.post(f"/api/v1/establishments/startup/{establishment.id}/administrator-invitation/", {}, format="json")
        self.assertEqual(reopened.status_code, 200, reopened.data)
        self.assertEqual(self.login(reopened.data["data"]["temporary_password"])[1].status_code, 200)

    def test_an_activated_administrator_cannot_be_reset_or_revoked_by_the_team(self):
        self.create_and_activate()
        establishment = Establishment.objects.get()
        base = f"/api/v1/establishments/startup/{establishment.id}/administrator-invitation/"
        self.assertEqual(self.client.post(base, {}, format="json").data["code"], "already_active")
        self.assertEqual(self.client.post(f"{base}revoke/").status_code, 409)
        self.assertEqual(self.login(NEW_PASSWORD)[1].status_code, 200, "le mot de passe choisi par le responsable est intact")

    def test_replacing_a_live_administrator_needs_explicit_confirmation(self):
        self.create_and_activate()
        establishment = Establishment.objects.get()
        url = f"/api/v1/establishments/startup/{establishment.id}/administrator-invitation/"
        self.assertEqual(self.client.post(url, {"email": "autre@clinique.test"}, format="json").data["code"], "administrator_exists")
        replaced = self.client.post(url, {"email": "autre@clinique.test", "confirm_replace": True}, format="json")
        self.assertEqual(replaced.status_code, 200, replaced.data)
        self.assertTrue(replaced.data["data"]["must_change_password"])
        self.assertEqual(EstablishmentAdministrator.objects.filter(establishment=establishment, status="active").get().user.email, "autre@clinique.test")
        self.assertEqual(EstablishmentAdministrator.objects.filter(establishment=establishment, status="ended", user__email=EMAIL).count(), 1, "l'historique est conservé")

    # --- fiche de l'établissement
    def test_profile_completion_unlocks_catalog_and_join_codes_and_ends_onboarding(self):
        client, establishment = self.create_and_activate()
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
        self.assertTrue(AccountContext.objects.get(user__email=EMAIL, role="establishment").onboarding_completed)
        self.assertEqual(client.post(codes).status_code, 201)
        self.assertEqual([item["name"] for item in client.get("/api/v1/establishments/catalog/").data["data"]], ["Clinique des Jardins"])

    def test_verified_fields_are_locked_and_bad_values_are_rejected(self):
        client, establishment = self.create_and_activate()
        url = f"/api/v1/establishments/{establishment.id}/profile/"
        self.assertEqual(client.patch(url, {"name": "Autre nom"}, format="json").status_code, 400)
        self.assertEqual(client.patch(url, {"responsible_name": "Quelqu'un d'autre"}, format="json").status_code, 400)
        self.assertEqual(client.patch(url, {"name": establishment.name, **FICHE}, format="json").status_code, 200)
        self.assertEqual(client.patch(url, {"phone": "abc"}, format="json").status_code, 400)
        self.assertEqual(client.patch(url, {"city": "   "}, format="json").status_code, 400)
        establishment.refresh_from_db()
        self.assertEqual(establishment.name, "Clinique des Jardins")

    def test_only_the_active_administrator_can_read_or_edit_the_profile(self):
        _, establishment = self.create_and_activate()
        outsider = APIClient()
        outsider.force_authenticate(User.objects.create_user(username="o@example.test", email="o@example.test", password="o-password"))
        url = f"/api/v1/establishments/{establishment.id}/profile/"
        self.assertEqual(outsider.get(url).status_code, 403)
        self.assertEqual(outsider.patch(url, FICHE, format="json").status_code, 403)
        self.assertEqual(APIClient().get(url).status_code, 403)

    # --- anciens liens d'invitation encore en circulation
    def test_legacy_invitation_links_issued_before_this_change_still_work(self):
        establishment = Establishment.objects.create(name="Ancienne structure", status="active")
        EstablishmentAdminInvitation.objects.create(
            establishment=establishment, email="ancien@clinique.test", first_name="Awa", last_name="Koné",
            token_hash=EstablishmentAdminInvitation.digest("ancien-jeton"), expires_at=timezone.now() + timedelta(hours=1), created_by=self.staff,
        )
        accepted = APIClient().post(ACCEPT_URL, {"token": "ancien-jeton", "password": NEW_PASSWORD}, format="json")
        self.assertEqual(accepted.status_code, 200, accepted.data)
        self.assertTrue(User.objects.get(email="ancien@clinique.test").check_password(NEW_PASSWORD))

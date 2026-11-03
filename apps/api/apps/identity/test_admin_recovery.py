from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from .models import AccountProfile, ContactMessage
from .test_recovery import ANSWER, ANSWER_URL, OLD_PASSWORD, REAL_CACHE, make_account

User = get_user_model()
URL = "/api/v1/identity/admin/recovery/"


@override_settings(CACHES=REAL_CACHE)
class AdminRecoveryConsoleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.root = User.objects.create_superuser(username="root", email="root@example.test", password="local-test-password")
        self.admin = APIClient()
        self.admin.force_authenticate(self.root)
        self.public = APIClient()

    def attempt(self, email, answer):
        return self.public.post(ANSWER_URL, {"email": email, "answer": answer}, format="json")

    def test_only_a_superuser_can_read_the_recovery_console(self):
        self.assertIn(APIClient().get(URL).status_code, (401, 403))
        regular = User.objects.create_user(username="regular", email="regular@example.test", password="local-test-password")
        client = APIClient()
        client.force_authenticate(regular)
        self.assertEqual(client.get(URL).status_code, 403)
        self.assertEqual(self.admin.get(URL).status_code, 200)

    def test_failed_verified_and_locked_attempts_are_visible_with_the_account(self):
        user = make_account("awa@example.test")
        for _ in range(5):
            self.attempt(user.email, "Mauvaise réponse")
        data = self.admin.get(URL).data["data"]
        self.assertEqual(data["summary"]["failed_24h"], 5)
        self.assertEqual(data["summary"]["locked_now"], 1)
        self.assertEqual(data["locked_accounts"][0]["email"], "awa@example.test")
        self.assertEqual(data["locked_accounts"][0]["failures"], 5)
        labels = {event["label"] for event in data["events"]}
        self.assertIn("Réponse secrète incorrecte", labels)
        self.assertIn("Récupération bloquée (trop d’échecs)", labels)
        self.assertTrue(all(event["email"] == "awa@example.test" for event in data["events"]))

    def test_an_accepted_answer_and_a_reset_are_visible(self):
        user = make_account("awa@example.test")
        self.assertEqual(self.attempt(user.email, ANSWER).status_code, 200)
        data = self.admin.get(URL).data["data"]
        self.assertEqual(data["summary"]["verified_24h"], 1)
        self.assertEqual(data["events"][0]["label"], "Réponse secrète acceptée")

    def test_the_console_never_exposes_secrets(self):
        user = make_account("awa@example.test")
        self.attempt(user.email, "Réponse très secrète")
        AuditEvent.objects.create(event_type="account.password_reset_by_recovery", actor=user, actor_role="account", metadata={"action": "password_reset", "status": "success"})
        body = str(self.admin.get(URL).data)
        self.assertNotIn("très secrète", body)
        self.assertNotIn("password", body.replace("password_reset_by_recovery", ""))
        self.assertNotIn("recovery_answer_hash", body)

    def test_team_requests_from_the_recovery_form_are_listed_with_their_status(self):
        ContactMessage.objects.create(first_name="Awa", last_name="Kouassi", contact_kind="phone", contact_value="0700000000", subject="problem", message="[Récupération de compte] Je ne me souviens plus de ma réponse.")
        ContactMessage.objects.create(first_name="Autre", last_name="Visiteur", contact_kind="email", contact_value="autre@example.test", subject="question", message="Une simple question.")
        data = self.admin.get(URL).data["data"]
        self.assertEqual(len(data["help_requests"]), 1)
        item = data["help_requests"][0]
        self.assertEqual(item["message"], "Je ne me souviens plus de ma réponse.")
        self.assertEqual(data["summary"]["help_open"], 1)
        updated = self.admin.patch(f"/api/v1/identity/admin/contact-messages/{item['id']}/", {"status": "resolved"}, format="json")
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(self.admin.get(URL).data["data"]["summary"]["help_open"], 0)
        self.assertEqual(self.admin.patch(f"/api/v1/identity/admin/contact-messages/{item['id']}/", {"status": "bogus"}, format="json").status_code, 400)


@override_settings(CACHES=REAL_CACHE)
class AdminRecoveryAssistTests(TestCase):
    """L'équipe aide sans jamais lire un secret : retrouver le compte, lever un blocage, remettre un mot de passe temporaire."""

    def setUp(self):
        cache.clear()
        self.root = User.objects.create_superuser(username="root", email="root@example.test", password="local-test-password")
        self.admin = APIClient()
        self.admin.force_authenticate(self.root)
        self.user = make_account("awa@example.test", first_name="Awa", last_name="Kouassi")

    def lookup(self, email="awa@example.test"):
        return self.admin.get("/api/v1/identity/admin/recovery/account/", {"email": email})

    def unlock_url(self, user=None):
        return f"/api/v1/identity/admin/recovery/accounts/{(user or self.user).pk}/unlock/"

    def temp_url(self, user=None):
        return f"/api/v1/identity/admin/recovery/accounts/{(user or self.user).pk}/temporary-password/"

    def lock(self):
        for _ in range(5):
            APIClient().post(ANSWER_URL, {"email": self.user.email, "answer": "Mauvaise réponse"}, format="json")

    def test_only_a_superuser_can_use_the_assist_endpoints(self):
        regular = APIClient()
        regular.force_authenticate(User.objects.create_user(username="r", email="r@example.test", password="local-test-password"))
        for client in (APIClient(), regular):
            self.assertIn(client.get("/api/v1/identity/admin/recovery/account/", {"email": self.user.email}).status_code, (401, 403))
            self.assertIn(client.post(self.unlock_url(), {}, format="json").status_code, (401, 403))
            self.assertIn(client.post(self.temp_url(), {"identity_checked": True}, format="json").status_code, (401, 403))

    def test_lookup_gives_the_verification_points_but_never_the_answer(self):
        self.lock()
        response = self.lookup("  AWA@example.test ")
        self.assertEqual(response.status_code, 200)
        account = response.data["data"]
        self.assertEqual(account["id"], self.user.pk)
        self.assertEqual(account["name"], "Awa Kouassi")
        self.assertEqual(account["recovery_question"], "Quel était le nom de votre première école ?")
        self.assertTrue(account["has_recovery_question"])
        self.assertEqual(account["failures"], 5)
        self.assertIsNotNone(account["locked_until"])
        self.assertFalse(account["protected"])
        body = str(response.data)
        self.assertNotIn("recovery_answer_hash", body)
        self.assertNotIn("pbkdf2", body.lower())
        self.assertNotIn("argon2", body.lower())
        self.assertNotIn(ANSWER, body)

    def test_lookup_validates_the_address_and_reports_unknown_accounts(self):
        self.assertEqual(self.lookup("pas-une-adresse").status_code, 400)
        self.assertEqual(self.lookup("inconnu@example.test").status_code, 404)

    def test_unlocking_clears_the_block_and_is_traced_with_the_helped_account(self):
        self.lock()
        self.assertEqual(self.admin.get(URL).data["data"]["summary"]["locked_now"], 1)
        response = self.admin.post(self.unlock_url(), {}, format="json")
        self.assertEqual(response.status_code, 200)
        profile = AccountProfile.objects.get(user=self.user)
        self.assertEqual(profile.recovery_failures, 0)
        self.assertIsNone(profile.recovery_locked_until)
        data = self.admin.get(URL).data["data"]
        self.assertEqual(data["summary"]["locked_now"], 0)
        first = data["events"][0]
        self.assertEqual(first["label"], "Blocage levé par l’équipe")
        self.assertTrue(first["by_team"])
        self.assertEqual(first["email"], "awa@example.test")  # la personne aidée, pas l'administrateur
        self.assertEqual(AuditEvent.objects.get(event_type="account.recovery_unlocked_by_admin").actor, self.root)
        # la personne peut maintenant retenter sa réponse
        self.assertEqual(APIClient().post(ANSWER_URL, {"email": self.user.email, "answer": ANSWER}, format="json").status_code, 200)

    def test_a_temporary_password_needs_the_identity_check(self):
        for body in ({}, {"identity_checked": False}, {"identity_checked": "true"}):
            self.assertEqual(self.admin.post(self.temp_url(), body, format="json").status_code, 400)
        self.assertTrue(User.objects.get(pk=self.user.pk).check_password(OLD_PASSWORD))
        self.assertFalse(AuditEvent.objects.filter(event_type="account.temporary_password_issued_by_admin").exists())

    def test_a_temporary_password_works_once_forces_a_change_and_is_never_stored_or_traced(self):
        self.lock()
        help_request = ContactMessage.objects.create(first_name="Awa", last_name="Kouassi", contact_kind="email", contact_value=self.user.email, subject="problem", message="[Récupération de compte] J'ai oublié ma réponse.")
        mail.outbox.clear()
        response = self.admin.post(self.temp_url(), {"identity_checked": True, "help_request_id": str(help_request.id)}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        password = response.data["data"]["temporary_password"]
        self.assertRegex(password, r"^[A-HJ-NP-Za-km-z2-9]{4}(-[A-HJ-NP-Za-km-z2-9]{4}){3}$")
        self.assertIsNotNone(response.data["data"]["expires_at"])
        # connexion avec le mot de passe temporaire ; l'ancien ne marche plus ; le changement est imposé
        self.assertEqual(APIClient().post("/api/v1/identity/login/", {"email": self.user.email, "password": OLD_PASSWORD}, format="json").status_code, 400)
        client = APIClient()
        self.assertEqual(client.post("/api/v1/identity/login/", {"email": self.user.email, "password": password}, format="json").status_code, 200)
        self.assertTrue(client.get("/api/v1/identity/me/").data["data"]["must_change_password"])
        # blocage levé, demande clôturée
        profile = AccountProfile.objects.get(user=self.user)
        self.assertEqual(profile.recovery_failures, 0)
        self.assertIsNone(profile.recovery_locked_until)
        help_request.refresh_from_db()
        self.assertEqual(help_request.status, "resolved")
        # le titulaire est prévenu, sans le mot de passe
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.user.email])
        self.assertNotIn(password, mail.outbox[0].body)
        # trace : l'administrateur agit, le compte aidé est identifié, aucun secret
        event = AuditEvent.objects.get(event_type="account.temporary_password_issued_by_admin")
        self.assertEqual(event.actor, self.root)
        self.assertEqual(event.metadata, {"action": "temporary_password_issued", "resource_id": str(self.user.pk)})
        console = str(self.admin.get(URL).data)
        self.assertNotIn(password, console)
        self.assertIn("Mot de passe temporaire remis par l’équipe", console)
        # pas relu : une seconde lecture du compte ne le redonne pas
        self.assertNotIn(password, str(self.lookup().data))

    def test_team_accounts_and_disabled_accounts_are_out_of_reach(self):
        staff = User.objects.create_user(username="staff", email="staff@example.test", password="local-test-password", is_staff=True)
        for target in (staff, self.root):
            self.assertEqual(self.admin.post(self.unlock_url(target), {}, format="json").status_code, 403)
            self.assertEqual(self.admin.post(self.temp_url(target), {"identity_checked": True}, format="json").status_code, 403)
        self.assertTrue(self.lookup("staff@example.test").data["data"]["protected"])
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        self.assertEqual(self.admin.post(self.temp_url(), {"identity_checked": True}, format="json").status_code, 409)
        self.assertEqual(self.admin.post(self.unlock_url(), {}, format="json").status_code, 409)

    def test_a_deleted_or_unknown_account_id_is_not_found(self):
        self.assertEqual(self.admin.post("/api/v1/identity/admin/recovery/accounts/999999/unlock/", {}, format="json").status_code, 404)
        gone = User.objects.create_user(username="deleted-x", email="", password="local-test-password")
        self.assertEqual(self.admin.post(self.temp_url(gone), {"identity_checked": True}, format="json").status_code, 404)

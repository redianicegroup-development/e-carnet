from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from .models import AccountProfile, ContactMessage
from .test_recovery import ANSWER, ANSWER_URL, REAL_CACHE, make_account

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

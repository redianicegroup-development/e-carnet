"""SEC-04 et SEC-05 : inactivité des comptes sensibles, fermeture de toutes les sessions, écritures idempotentes."""
import time
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings
from rest_framework.test import APIClient

from apps.patients.models import ClinicalDeclaration
from .models import AccountContext

User = get_user_model()
PASSWORD = "a-long-local-password-1"
REAL_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "session-security-tests"}}
LATER = lambda seconds: mock.patch("apps.identity.middleware.time.time", return_value=time.time() + seconds)  # noqa: E731


def make_user(name, role=None):
    user = User.objects.create_user(username=f"{name}@example.test", email=f"{name}@example.test", password=PASSWORD)
    if role:
        AccountContext.objects.create(user=user, role=role, is_active=True)
    return user


@override_settings(ECARNET_PRIVILEGED_IDLE_SECONDS=1800)
class PrivilegedIdleTimeoutTests(TestCase):
    def test_a_professional_is_signed_out_after_thirty_minutes_without_activity(self):
        browser = Client()
        browser.force_login(make_user("pro", "professional"))
        self.assertEqual(browser.get("/api/v1/identity/me/").status_code, 200)
        with LATER(31 * 60):
            idle = browser.get("/api/v1/identity/me/")
        self.assertEqual(idle.status_code, 401)
        self.assertEqual(idle.json()["code"], "session_idle")
        self.assertIn(browser.get("/api/v1/identity/me/").status_code, (401, 403))  # la session est bien fermée

    def test_activity_inside_the_window_keeps_the_session_open(self):
        browser = Client()
        browser.force_login(make_user("pro-active", "establishment"))
        browser.get("/api/v1/identity/me/")
        with LATER(20 * 60):
            self.assertEqual(browser.get("/api/v1/identity/me/").status_code, 200)

    def test_a_patient_is_not_subject_to_the_short_limit(self):
        browser = Client()
        browser.force_login(make_user("patient", "patient"))
        browser.get("/api/v1/identity/me/")
        with LATER(3 * 60 * 60):
            self.assertEqual(browser.get("/api/v1/identity/me/").status_code, 200)

    def test_staff_accounts_are_subject_to_the_limit(self):
        staff = make_user("staff")
        staff.is_staff = True
        staff.save(update_fields=("is_staff",))
        browser = Client()
        browser.force_login(staff)
        browser.get("/api/v1/identity/me/")
        with LATER(31 * 60):
            self.assertEqual(browser.get("/api/v1/identity/me/").status_code, 401)

    @override_settings(ECARNET_PRIVILEGED_IDLE_SECONDS=0)
    def test_the_limit_can_be_disabled(self):
        browser = Client()
        browser.force_login(make_user("pro-off", "professional"))
        browser.get("/api/v1/identity/me/")
        with LATER(5 * 60 * 60):
            self.assertEqual(browser.get("/api/v1/identity/me/").status_code, 200)


class SessionPolicyTests(TestCase):
    def test_sessions_are_sliding_and_last_seven_days_by_default(self):
        from django.conf import settings
        self.assertTrue(settings.SESSION_SAVE_EVERY_REQUEST)
        self.assertLessEqual(settings.SESSION_COOKIE_AGE, 7 * 24 * 60 * 60)


class LogoutAllTests(TestCase):
    def test_logout_all_closes_every_session_of_the_account_and_only_that_account(self):
        owner, other = make_user("owner", "patient"), make_user("other", "patient")
        phone, laptop, stranger = Client(), Client(), Client()
        phone.force_login(owner)
        laptop.force_login(owner)
        stranger.force_login(other)
        response = phone.post("/api/v1/identity/logout-all/", content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["closed"], 2)
        self.assertIn(laptop.get("/api/v1/identity/me/").status_code, (401, 403))
        self.assertIn(phone.get("/api/v1/identity/me/").status_code, (401, 403))
        self.assertEqual(stranger.get("/api/v1/identity/me/").status_code, 200)

    def test_logout_all_requires_a_session(self):
        self.assertIn(Client().post("/api/v1/identity/logout-all/", content_type="application/json").status_code, (401, 403))


@override_settings(CACHES=REAL_CACHE)
class IdempotentWritesTests(TestCase):
    KEY = "k-0123456789abcdef-aaaa"

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.user = User.objects.create_user(username="idem-patient", password=PASSWORD)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.body = {"kind": "allergy", "label": "Pénicilline", "details": "Déclaration fictive de test"}

    def post(self, key=None, body=None):
        extra = {"HTTP_IDEMPOTENCY_KEY": key} if key else {}
        return self.client.post("/api/v1/patient/declarations/", body or self.body, format="json", **extra)

    def test_the_same_key_replays_the_first_answer_instead_of_executing_twice(self):
        first = self.post(self.KEY)
        second = self.post(self.KEY)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second["Idempotent-Replayed"], "true")
        self.assertEqual(second.json()["data"]["id"], first.json()["data"]["id"])
        self.assertEqual(ClinicalDeclaration.objects.filter(label="Pénicilline").count(), 1)

    def test_without_a_key_nothing_changes(self):
        self.assertEqual(self.post().status_code, 201)
        self.assertEqual(self.post().status_code, 409)  # comportement d'origine : déclaration déjà existante

    def test_a_failed_attempt_is_not_stored_so_the_corrected_request_can_use_the_same_key(self):
        self.assertEqual(self.post(self.KEY, {"kind": "blood_group", "label": "Z+", "details": ""}).status_code, 400)
        self.assertEqual(self.post(self.KEY).status_code, 201)

    def test_a_malformed_key_is_refused(self):
        self.assertEqual(self.post("court").status_code, 400)

    def test_a_key_reused_for_another_content_type_is_refused(self):
        self.post(self.KEY)
        reused = self.client.post("/api/v1/patient/declarations/", "texte", content_type="text/plain", HTTP_IDEMPOTENCY_KEY=self.KEY)
        self.assertEqual(reused.status_code, 422)

    def test_the_same_key_is_scoped_to_the_path(self):
        self.post(self.KEY)
        other = self.client.patch("/api/v1/patient/profile/", {"gender": "female"}, format="json", HTTP_IDEMPOTENCY_KEY=self.KEY)
        self.assertEqual(other.status_code, 200)
        self.assertNotIn("Idempotent-Replayed", other)

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from .models import AccountProfile
from .recovery import GENERIC_FAILURE, PRESET_QUESTIONS, _lock_duration, normalize_answer

User = get_user_model()
OLD_PASSWORD = "ancien-mot-de-passe-1"
NEW_PASSWORD = "nouveau-mot-de-passe-9"
QUESTION = "Quel était le nom de votre première école ?"
ANSWER = "École Sainte-Marie"
REAL_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "recovery-tests"}}
QUESTION_URL = "/api/v1/identity/recovery/question/"
RESET_URL = "/api/v1/identity/recovery/reset/"


def make_account(email="awa@example.test", *, question=QUESTION, answer=ANSWER, configured=True, **extra):
    user = User.objects.create_user(username=email, email=email, password=OLD_PASSWORD, **extra)
    values = {"recovery_question": question, "recovery_answer_hash": make_password(normalize_answer(answer))} if configured else {}
    AccountProfile.objects.update_or_create(user=user, defaults=values)
    return user


class RecoveryFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def reset(self, email="awa@example.test", answer=ANSWER, password=NEW_PASSWORD):
        return self.client.post(RESET_URL, {"email": email, "answer": answer, "new_password": password}, format="json")

    def can_log_in(self, password, email="awa@example.test"):
        return APIClient().post("/api/v1/identity/login/", {"email": email, "password": password}, format="json").status_code == 200

    # ---- question : aucune différence visible entre un vrai compte et le reste ----
    def test_a_recoverable_account_gets_its_own_question(self):
        make_account(question="Le prénom de mon premier chien ?")
        response = self.client.post(QUESTION_URL, {"email": "AWA@example.test "}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], {"question": "Le prénom de mon premier chien ?"})

    def test_an_unknown_address_gets_a_stable_decoy_with_the_same_shape(self):
        make_account()
        real = self.client.post(QUESTION_URL, {"email": "awa@example.test"}, format="json")
        first = self.client.post(QUESTION_URL, {"email": "personne@example.test"}, format="json")
        second = self.client.post(QUESTION_URL, {"email": "personne@example.test"}, format="json")
        self.assertEqual((first.status_code, real.status_code), (200, 200))
        self.assertEqual(set(first.data), set(real.data))
        self.assertEqual(set(first.data["data"]), set(real.data["data"]))
        self.assertIn(first.data["data"]["question"], PRESET_QUESTIONS)
        self.assertEqual(first.data["data"], second.data["data"])

    def test_accounts_that_cannot_recover_look_exactly_like_unknown_ones(self):
        private = "Une question que personne d’autre ne connaît ?"
        make_account("sans-question@example.test", configured=False)
        make_account("equipe@example.test", question=private, is_staff=True)
        make_account("admin@example.test", question=private, is_superuser=True)
        make_account("inactif@example.test", question=private, is_active=False)
        for email in ("sans-question@example.test", "equipe@example.test", "admin@example.test", "inactif@example.test"):
            question = self.client.post(QUESTION_URL, {"email": email}, format="json").data["data"]["question"]
            self.assertIn(question, PRESET_QUESTIONS, email)
            self.assertNotEqual(question, private)

    # ---- réinitialisation ----
    def test_the_right_answer_sets_a_new_password_whatever_the_case_and_spacing(self):
        user = make_account()
        response = self.reset(answer="  école   SAINTE-marie ")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["data"]["reset"])
        self.assertTrue(self.can_log_in(NEW_PASSWORD))
        self.assertFalse(self.can_log_in(OLD_PASSWORD))
        # alerte au titulaire, sans jamais écrire le mot de passe ni la réponse
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["awa@example.test"])
        self.assertNotIn(NEW_PASSWORD, mail.outbox[0].body)
        event = AuditEvent.objects.get(event_type="account.password_reset_by_recovery")
        self.assertEqual(event.actor_id, user.id)
        self.assertNotIn(NEW_PASSWORD, str(event.metadata))
        self.assertNotIn("Sainte", str(event.metadata))
        self.assertNotIn(NEW_PASSWORD, str(response.data))

    def test_a_wrong_answer_gets_the_generic_failure_and_is_counted(self):
        user = make_account()
        response = self.reset(answer="Collège Saint-Joseph")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["message"], GENERIC_FAILURE)
        self.assertEqual(AccountProfile.objects.get(user=user).recovery_failures, 1)
        self.assertTrue(self.can_log_in(OLD_PASSWORD))
        self.assertEqual(len(mail.outbox), 0)

    def test_an_unknown_address_fails_exactly_like_a_wrong_answer(self):
        make_account()
        wrong = self.reset(answer="Collège Saint-Joseph")
        unknown = self.reset(email="personne@example.test")
        self.assertEqual((unknown.status_code, dict(unknown.data)), (wrong.status_code, dict(wrong.data)))

    def test_the_answer_proves_nothing_to_someone_who_sends_a_weak_new_password(self):
        user = make_account()
        # contrôle du mot de passe indépendant de la réponse : il ne sert pas à savoir si la réponse était la bonne
        for answer in (ANSWER, "Mauvaise réponse"):
            short = self.reset(answer=answer, password="court")
            numeric = self.reset(answer=answer, password="123456789012")
            self.assertEqual(short.status_code, 400)
            self.assertEqual(numeric.status_code, 400)
            self.assertIn("new_password", short.data)
            self.assertIn("new_password", numeric.data)
        self.assertEqual(AccountProfile.objects.get(user=user).recovery_failures, 0)
        self.assertTrue(self.can_log_in(OLD_PASSWORD))

    def test_a_reset_closes_the_other_sessions(self):
        make_account()
        elsewhere = APIClient()
        self.assertEqual(elsewhere.post("/api/v1/identity/login/", {"email": "awa@example.test", "password": OLD_PASSWORD}, format="json").status_code, 200)
        self.assertEqual(elsewhere.get("/api/v1/identity/me/").status_code, 200)
        self.assertEqual(self.reset().status_code, 200)
        self.assertIn(elsewhere.get("/api/v1/identity/me/").status_code, (401, 403))

    def test_team_and_inactive_accounts_cannot_be_reset_by_a_question(self):
        for email, extra in (("equipe@example.test", {"is_staff": True}), ("admin@example.test", {"is_superuser": True}), ("inactif@example.test", {"is_active": False})):
            make_account(email, **extra)
            self.assertEqual(self.reset(email=email).status_code, 400, email)
        self.assertEqual(len(mail.outbox), 0)
        self.assertFalse(AuditEvent.objects.filter(event_type="account.password_reset_by_recovery").exists())

    def test_the_question_saved_at_onboarding_works_for_the_reset(self):
        user = User.objects.create_user(username="nouveau@example.test", email="nouveau@example.test", password=OLD_PASSWORD)
        AccountProfile.objects.create(user=user)
        owner = APIClient()
        owner.force_authenticate(user)
        saved = owner.patch("/api/v1/identity/me/recovery/", {"question": QUESTION, "answer": "Mon  Surnom"}, format="json")
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(self.reset(email="nouveau@example.test", answer="mon surnom").status_code, 200)
        self.assertTrue(self.can_log_in(NEW_PASSWORD, email="nouveau@example.test"))

    # ---- verrouillage durable ----
    def test_five_wrong_answers_lock_the_account_and_even_the_right_answer_then_fails_the_same_way(self):
        user = make_account()
        for _ in range(5):
            self.assertEqual(self.reset(answer="Mauvaise réponse").status_code, 400)
        profile = AccountProfile.objects.get(user=user)
        self.assertEqual(profile.recovery_failures, 5)
        self.assertGreater(profile.recovery_locked_until, timezone.now() + timedelta(minutes=14))
        self.assertTrue(AuditEvent.objects.filter(event_type="account.recovery_locked", actor=user).exists())
        locked = self.reset(answer=ANSWER)
        self.assertEqual((locked.status_code, locked.data["message"]), (400, GENERIC_FAILURE))
        self.assertEqual(AccountProfile.objects.get(user=user).recovery_failures, 5)  # un compte verrouillé ne compte plus les essais
        self.assertTrue(self.can_log_in(OLD_PASSWORD))
        # le verrou levé, la bonne réponse fonctionne et remet le compteur à zéro
        AccountProfile.objects.filter(user=user).update(recovery_locked_until=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.reset(answer=ANSWER).status_code, 200)
        profile.refresh_from_db()
        self.assertEqual((profile.recovery_failures, profile.recovery_locked_until), (0, None))

    def test_the_lock_grows_with_repeated_failures_up_to_a_day(self):
        self.assertEqual(_lock_duration(5), timedelta(minutes=15))
        self.assertEqual(_lock_duration(10), timedelta(minutes=30))
        self.assertEqual(_lock_duration(15), timedelta(hours=1))
        self.assertEqual(_lock_duration(500), timedelta(hours=24))

    def test_answers_are_compared_without_case_or_extra_spaces(self):
        self.assertEqual(normalize_answer("  École   Sainte-Marie "), "école sainte-marie")


@override_settings(CACHES=REAL_CACHE)
class RecoveryThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_requests_are_limited_per_address_even_from_many_ips_and_unknown_addresses_are_limited_too(self):
        make_account()
        statuses = {"known": [], "unknown": []}
        for index in range(10):
            ip = f"10.1.0.{index + 1}"
            statuses["known"].append(self.client.post(QUESTION_URL, {"email": "awa@example.test"}, format="json", REMOTE_ADDR=ip).status_code)
            statuses["unknown"].append(self.client.post(QUESTION_URL, {"email": "personne@example.test"}, format="json", REMOTE_ADDR=ip).status_code)
        # même comportement qu'il y ait un compte ou non
        self.assertEqual(statuses["known"], statuses["unknown"])
        self.assertIn(429, statuses["known"])
        self.assertEqual(statuses["known"][0], 200)

    def test_requests_are_limited_per_ip(self):
        statuses = [self.client.post(QUESTION_URL, {"email": f"u{i}@example.test"}, format="json").status_code for i in range(14)]
        self.assertEqual(statuses[0], 200)
        self.assertEqual(statuses[-1], 429)

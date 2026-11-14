from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import AccountProfile
from .temporary_password import generate_temporary_password, issue_temporary_password

User = get_user_model()
PASSWORD_URL = "/api/v1/identity/me/password/"
OLD = "an-old-long-password-1"
NEW = "a-brand-new-password-2"


class PasswordChangeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="a@example.test", email="a@example.test", password=OLD, first_name="Awa", last_name="Koné")
        self.client = APIClient()
        self.client.post("/api/v1/identity/login/", {"email": "a@example.test", "password": OLD}, format="json")

    def test_anonymous_cannot_change_a_password(self):
        self.assertEqual(APIClient().post(PASSWORD_URL, {"current_password": OLD, "new_password": NEW}, format="json").status_code, 403)

    def test_voluntary_change_needs_the_current_password_and_keeps_the_session(self):
        self.assertEqual(self.client.post(PASSWORD_URL, {"current_password": "not-the-password", "new_password": NEW}, format="json").status_code, 400)
        done = self.client.post(PASSWORD_URL, {"current_password": OLD, "new_password": NEW}, format="json")
        self.assertEqual(done.status_code, 200, done.data)
        self.assertEqual(self.client.get("/api/v1/identity/me/").status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW))

    def test_account_without_usable_password_cannot_use_this_endpoint(self):
        self.user.set_unusable_password()
        self.user.save(update_fields=["password"])
        self.client.force_login(self.user)
        self.assertEqual(self.client.post(PASSWORD_URL, {"current_password": OLD, "new_password": NEW}, format="json").status_code, 409)

    def test_generated_temporary_passwords_are_random_readable_and_valid(self):
        samples = {generate_temporary_password(self.user) for _ in range(20)}
        self.assertEqual(len(samples), 20)
        for password in samples:
            self.assertRegex(password, r"^[A-HJ-NP-Za-km-z2-9]{4}(-[A-HJ-NP-Za-km-z2-9]{4}){3}$")
            self.assertTrue(any(c.isupper() for c in password) and any(c.islower() for c in password) and any(c.isdigit() for c in password))

    def test_issuing_a_temporary_password_flags_the_account_and_sets_an_expiry(self):
        password, expires_at = issue_temporary_password(self.user)
        profile = AccountProfile.objects.get(user=self.user)
        self.assertTrue(profile.must_change_password)
        self.assertEqual(profile.temporary_password_expires_at, expires_at)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(password))
        self.assertFalse(self.user.check_password(OLD))


class FirstLoginWithoutRetypingTheTemporaryPasswordTests(TestCase):
    """Après la connexion avec le mot de passe temporaire, l'écran « nouveau mot de passe » ne demande que le nouveau (et sa confirmation côté écran)."""

    def setUp(self):
        self.user = User.objects.create_user(username="lab@example.test", email="lab@example.test", first_name="Awa", last_name="Koné")
        self.temporary, _ = issue_temporary_password(self.user)

    def login(self, password=None):
        client = APIClient()
        response = client.post("/api/v1/identity/login/", {"email": "lab@example.test", "password": password or self.temporary}, format="json")
        return client, response

    def test_the_new_password_alone_is_enough_right_after_the_temporary_login(self):
        client, login = self.login()
        self.assertEqual(login.status_code, 200)
        done = client.post(PASSWORD_URL, {"new_password": NEW}, format="json")
        self.assertEqual(done.status_code, 200, done.data)
        self.assertFalse(done.data["data"]["must_change_password"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW))
        self.assertEqual(self.login(NEW)[1].status_code, 200)
        self.assertEqual(self.login()[1].status_code, 400)  # usage unique

    def test_the_temporary_password_cannot_be_kept_as_the_new_one(self):
        client, _ = self.login()
        refused = client.post(PASSWORD_URL, {"new_password": self.temporary}, format="json")
        self.assertEqual(refused.status_code, 400)
        self.assertIn("différent du mot de passe temporaire", refused.data["message"])
        self.assertTrue(AccountProfile.objects.get(user=self.user).must_change_password)

    def test_a_wrong_current_password_is_still_refused_when_one_is_supplied(self):
        client, _ = self.login()
        refused = client.post(PASSWORD_URL, {"current_password": "not-the-password", "new_password": NEW}, format="json")
        self.assertEqual((refused.status_code, refused.data["code"]), (400, "current_password_incorrect"))

    def test_the_exemption_expires_after_fifteen_minutes(self):
        client, _ = self.login()
        session = client.session
        session["temporary_login_at"] = timezone.now().timestamp() - 16 * 60
        session.save()
        refused = client.post(PASSWORD_URL, {"new_password": NEW}, format="json")
        self.assertEqual((refused.status_code, refused.data["code"]), (400, "current_password_required"))
        self.assertEqual(client.post(PASSWORD_URL, {"current_password": self.temporary, "new_password": NEW}, format="json").status_code, 200)

    def test_a_session_not_opened_with_the_temporary_password_still_needs_it(self):
        client = APIClient()
        client.force_login(self.user)  # ex. connexion par un fournisseur externe : pas de dispense
        refused = client.post(PASSWORD_URL, {"new_password": NEW}, format="json")
        self.assertEqual((refused.status_code, refused.data["code"]), (400, "current_password_required"))

    def test_an_ordinary_account_always_needs_its_current_password(self):
        other = User.objects.create_user(username="o@example.test", email="o@example.test", password=OLD, first_name="O", last_name="K")
        client = APIClient()
        client.post("/api/v1/identity/login/", {"email": "o@example.test", "password": OLD}, format="json")
        refused = client.post(PASSWORD_URL, {"new_password": NEW}, format="json")
        self.assertEqual((refused.status_code, refused.data["code"]), (400, "current_password_required"))
        self.assertTrue(other.check_password(OLD))

    def test_the_session_marker_is_dropped_once_the_password_is_chosen(self):
        client, _ = self.login()
        client.post(PASSWORD_URL, {"new_password": NEW}, format="json")
        self.assertNotIn("temporary_login_at", client.session)

    def test_the_login_response_says_which_structure_granted_the_access(self):
        from apps.establishments.models import Establishment, EstablishmentAdministrator
        boss = User.objects.create_user(username="boss", password="local-test-password")
        clinic = Establishment.objects.create(name="Clinique Ccf", status="active", created_by=boss)
        lab = Establishment.objects.create(name="Laboratoire Clinique Ccf", status="active", created_by=boss, is_laboratory=True, parent=clinic)
        EstablishmentAdministrator.objects.create(establishment=lab, user=self.user, assigned_by=boss, status="active")
        _, login = self.login()
        self.assertEqual(login.data["data"]["first_access"], {"kind": "laboratory", "establishment_name": "Laboratoire Clinique Ccf", "parent_name": "Clinique Ccf"})
        EstablishmentAdministrator.objects.filter(user=self.user).update(establishment=clinic)
        self.assertEqual(self.login()[1].data["data"]["first_access"], {"kind": "establishment", "establishment_name": "Clinique Ccf", "parent_name": ""})

    def test_no_first_access_notice_once_the_password_is_chosen(self):
        client, _ = self.login()
        client.post(PASSWORD_URL, {"new_password": NEW}, format="json")
        self.assertIsNone(self.login(NEW)[1].data["data"]["first_access"])

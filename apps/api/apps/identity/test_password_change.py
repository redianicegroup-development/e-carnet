from django.contrib.auth import get_user_model
from django.test import TestCase
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

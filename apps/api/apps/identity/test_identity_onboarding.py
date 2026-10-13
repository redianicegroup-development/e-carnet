import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from .models import AccountContext

User = get_user_model()


class IdentityOnboardingTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_creates_one_account_and_patient_context(self):
        response = self.client.post("/api/v1/identity/register/", {"email": "awa@example.test", "password": "a-long-local-password", "first_name": "Awa", "last_name": "Koné"}, format="json")
        self.assertEqual(response.status_code, 201)
        account_id = response.data["data"]["id"]
        self.assertEqual(str(uuid.UUID(account_id)), account_id)
        user = User.objects.get(email="awa@example.test")
        self.assertEqual(AccountContext.objects.filter(user=user, role="patient").count(), 1)
        current = self.client.get("/api/v1/identity/me/")
        self.assertEqual(current.status_code, 200)
        self.assertEqual(current.data["data"]["id"], account_id)

    def test_me_exposes_date_joined_for_the_welcome_greeting(self):
        self.client.post("/api/v1/identity/register/", {"email": "bienvenue@example.test", "password": "a-long-local-password", "first_name": "Awa", "last_name": "Koné"}, format="json")
        current = self.client.get("/api/v1/identity/me/")
        self.assertEqual(current.status_code, 200)
        joined = current.data["data"]["date_joined"]
        self.assertTrue(joined)
        self.assertEqual(joined[:10], User.objects.get(email="bienvenue@example.test").date_joined.date().isoformat())

    def test_login_email_is_case_insensitive_for_existing_accounts(self):
        User.objects.create_user(
            username="Foo@Example.com",
            email="Foo@Example.com",
            password="a-long-local-password",
        )
        response = self.client.post(
            "/api/v1/identity/login/",
            {"email": "Foo@Example.com", "password": "a-long-local-password"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["email"].casefold(), "foo@example.com")

    def test_duplicate_email_and_invalid_login_are_rejected(self):
        self.client.post("/api/v1/identity/register/", {"email": "dup@example.test", "password": "a-long-local-password", "first_name": "A", "last_name": "B"}, format="json")
        duplicate = self.client.post("/api/v1/identity/register/", {"email": "DUP@example.test", "password": "a-long-local-password", "first_name": "A", "last_name": "B"}, format="json")
        self.assertEqual(duplicate.status_code, 400)
        self.client.post("/api/v1/identity/logout/")
        invalid = self.client.post("/api/v1/identity/login/", {"email": "dup@example.test", "password": "wrong-password"}, format="json")
        self.assertEqual(invalid.status_code, 400)

    def test_patient_onboarding_completes_profile(self):
        self.client.post("/api/v1/identity/register/", {"email": "patient@example.test", "password": "a-long-local-password", "first_name": "A", "last_name": "B"}, format="json")
        response = self.client.patch("/api/v1/identity/onboarding/patient/", {"phone": "+22500000000", "coverage_provider": "Couverture fictive", "birth_date": "", "coverage_expiry": ""}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["data"]["patient_profile"]["completed"])
        self.assertTrue(response.data["data"]["contexts"][0]["onboarding_completed"])


class RecoverySetupTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="recovery@example.test",
            email="recovery@example.test",
            password="a-long-local-password",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_recovery_answer_is_hashed_and_never_returned(self):
        from django.contrib.auth.hashers import check_password
        from .models import AccountProfile

        response = self.client.patch(
            "/api/v1/identity/me/recovery/",
            {"question": "Quel était votre ancien pseudonyme ?", "answer": "  Mon   surnom  "},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], {"configured": True})
        profile = AccountProfile.objects.get(user=self.user)
        self.assertNotEqual(profile.recovery_answer_hash, "Mon surnom")
        self.assertTrue(check_password("mon surnom", profile.recovery_answer_hash))
        account = self.client.get("/api/v1/identity/me/")
        self.assertTrue(account.data["data"]["recovery_configured"])
        self.assertNotIn("recovery_question", account.data["data"])
        self.assertNotIn("recovery_answer_hash", account.data["data"])

    def test_recovery_setup_requires_a_question_and_answer(self):
        response = self.client.patch(
            "/api/v1/identity/me/recovery/",
            {"question": " ", "answer": " "},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_recovery_setup_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.patch(
            "/api/v1/identity/me/recovery/",
            {"question": "Quel était votre ancien pseudonyme ?", "answer": "réponse"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)


class IdentityProfileAndOAuthTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="identity@example.test", email="identity@example.test", password="a-long-local-password", first_name="Awa", last_name="Kone")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_identity_profile_can_update_avatar_and_names(self):
        response = self.client.patch("/api/v1/identity/me/profile/", {"first_name": "Awa", "last_name": "Koné", "avatar_url": "https://cdn.example.test/avatar.png"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["avatar_url"], "https://cdn.example.test/avatar.png")
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Awa")

    def test_uploaded_webp_avatar_is_saved_and_returned_in_profile(self):
        import base64
        from .models import AccountProfile
        image = b"RIFF" + (4).to_bytes(4, "little") + b"WEBP"
        encoded = "data:image/webp;base64," + base64.b64encode(image).decode("ascii")
        response = self.client.patch("/api/v1/identity/me/profile/", {"avatar_data": encoded, "avatar_url": ""}, format="json")
        self.assertEqual(response.status_code, 200)
        avatar_path = response.data["data"]["avatar_url"]
        self.assertTrue(avatar_path.startswith("/api/v1/identity/me/avatar/?v="))
        profile = AccountProfile.objects.get(user=self.user)
        self.assertEqual(profile.avatar_data, encoded)
        self.assertEqual(profile.avatar_url, "")
        image_response = self.client.get("/api/v1/identity/me/avatar/")
        self.assertEqual(image_response.status_code, 200)
        self.assertEqual(image_response["Content-Type"], "image/webp")
        self.assertEqual(image_response.content, image)

    def test_uploaded_avatar_rejects_non_webp_data(self):
        response = self.client.patch("/api/v1/identity/me/profile/", {"avatar_data": "data:image/svg+xml;base64,PHN2Zz4="}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_oauth_identity_can_be_unlinked_when_password_exists(self):
        from .models import AuthIdentity
        AuthIdentity.objects.create(user=self.user, provider="google", provider_user_id="google-1", email=self.user.email)
        response = self.client.delete("/api/v1/identity/oauth/identities/google/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(AuthIdentity.objects.filter(user=self.user).exists())

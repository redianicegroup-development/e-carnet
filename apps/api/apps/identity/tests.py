import json
import os
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client, TestCase, override_settings
from rest_framework.test import APIClient
from unittest.mock import patch
from apps.establishments.models import Establishment, EstablishmentMembership
from apps.professionals.models import ProfessionalProfile
from .models import ThemePreference
from .theme import DEFAULT_THEME
from .oauth_views import callback_url, safe_next_path

User = get_user_model()


class ThemePreferenceTests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(username="patient-a", password="fake-local-password")
        self.user_b = User.objects.create_user(username="patient-b", password="fake-local-password")
        self.client = APIClient()

    def test_new_account_gets_miel_bricolage_default(self):
        self.client.force_authenticate(self.user_a)
        response = self.client.get("/api/v1/identity/me/theme/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], DEFAULT_THEME)
        self.assertEqual(response.data["account_id"], str(self.user_a.pk))
        self.assertEqual(ThemePreference.objects.get(user=self.user_a).theme, DEFAULT_THEME)

    def test_theme_is_private_to_each_account(self):
        custom = {"font_pair": "mooli-manrope", "text_scale": "large", "palette": ["#FFF1F5", "#FFD2DF", "#F28AA8", "#B94D6D", "#3A1E2A"]}
        self.client.force_authenticate(self.user_a)
        response = self.client.patch("/api/v1/identity/me/theme/", custom, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["account_id"], str(self.user_a.pk))
        self.assertEqual(ThemePreference.objects.get(user=self.user_a).theme, custom)
        another_device = APIClient()
        another_device.force_authenticate(self.user_a)
        response_from_another_device = another_device.get("/api/v1/identity/me/theme/")
        self.assertEqual(response_from_another_device.data["data"], custom)
        self.assertEqual(response_from_another_device.data["account_id"], str(self.user_a.pk))
        self.client.force_authenticate(self.user_b)
        response_b = self.client.get("/api/v1/identity/me/theme/")
        self.assertEqual(response_b.data["data"], DEFAULT_THEME)
        self.assertEqual(response_b.data["account_id"], str(self.user_b.pk))
        self.assertNotEqual(response_b.data["data"], custom)

    def test_invalid_font_pair_text_scale_or_palette_is_rejected(self):
        self.client.force_authenticate(self.user_a)
        invalid = {"font_pair": "url(javascript:alert(1))", "text_scale": "giant", "palette": ["red"] * 5}
        response = self.client.patch("/api/v1/identity/me/theme/", invalid, format="json")
        self.assertEqual(response.status_code, 400)

    def test_legacy_preference_is_upgraded_without_losing_its_valid_palette(self):
        old_palette = ["#FFF1F5", "#FFD2DF", "#F28AA8", "#B94D6D", "#3A1E2A"]
        ThemePreference.objects.create(user=self.user_a, theme={"font": "Mooli", "palette": old_palette})
        self.client.force_authenticate(self.user_a)
        response = self.client.get("/api/v1/identity/me/theme/")
        expected = {"font_pair": "mooli-manrope", "text_scale": "normal", "palette": old_palette}
        self.assertEqual(response.data["data"], expected)
        self.assertEqual(ThemePreference.objects.get(user=self.user_a).theme, expected)

    def test_anonymous_user_gets_default_theme_but_cannot_write(self):
        response = self.client.get("/api/v1/identity/me/theme/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], DEFAULT_THEME)
        self.assertIsNone(response.data["account_id"])
        self.assertFalse(ThemePreference.objects.exists())
        self.assertEqual(self.client.patch("/api/v1/identity/me/theme/", DEFAULT_THEME, format="json").status_code, 403)

    def test_session_write_requires_csrf_token(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user_a)
        payload = {"font_pair": "fredoka-quicksand", "text_scale": "very-large", "palette": ["#FFF7E6", "#FFE3B3", "#FFC857", "#4BAA8B", "#1E3A34"]}
        url = "/api/v1/identity/me/theme/"
        denied = client.patch(url, data=json.dumps(payload), content_type="application/json", HTTP_ORIGIN="http://localhost:3000")
        self.assertEqual(denied.status_code, 403)

        client.get("/api/v1/csrf/")
        token = client.cookies["csrftoken"].value
        accepted = client.patch(url, data=json.dumps(payload), content_type="application/json", HTTP_ORIGIN="http://localhost:3000", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(ThemePreference.objects.get(user=self.user_a).theme, payload)


class OAuthRedirectTests(TestCase):
    @override_settings(WEB_ORIGIN="https://frontend.example.test")
    def test_oauth_callback_uses_same_origin_web_proxy(self):
        self.assertEqual(callback_url(None, "google"), "https://frontend.example.test/api/v1/identity/oauth/google/callback/")

    @patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "test-client", "GOOGLE_CLIENT_SECRET": "test-secret"})
    def test_login_intent_does_not_start_provider_link_for_authenticated_user(self):
        user = User.objects.create_user(username="already-signed-in", email="already@example.test")
        client = APIClient()
        client.force_authenticate(user)
        response = client.get("/api/v1/identity/oauth/google/start/?intent=login")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(client.session.get("oauth_link_user_id"), "")

    @patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "test-client", "GOOGLE_CLIENT_SECRET": "test-secret"})
    def test_provider_start_keeps_explicit_link_context_by_default(self):
        user = User.objects.create_user(username="link-account", email="link@example.test")
        client = APIClient()
        client.force_authenticate(user)
        response = client.get("/api/v1/identity/oauth/google/start/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(client.session.get("oauth_link_user_id"), str(user.pk))

    def test_next_path_accepts_only_safe_relative_paths(self):
        self.assertEqual(safe_next_path("/onboarding/identite", "/patient"), "/onboarding/identite")
        self.assertEqual(safe_next_path("https://example.test", "/patient"), "/patient")
        self.assertEqual(safe_next_path("//example.test", "/patient"), "/patient")
        self.assertEqual(safe_next_path("/\\example.test", "/patient"), "/patient")

    @patch("apps.identity.oauth_views.http_json", side_effect=RuntimeError("provider unavailable"))
    def test_callback_logs_provider_failure_without_logging_oauth_code(self, _http_json):
        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "test-client", "GOOGLE_CLIENT_SECRET": "test-secret"}):
            self._assert_callback_logs_provider_failure()

    def _assert_callback_logs_provider_failure(self):
        session = self.client.session
        session["oauth_state_google"] = "valid-state"
        session.save()

        with self.assertLogs("apps.identity.oauth_views", level="ERROR") as captured:
            response = self.client.get(
                "/api/v1/identity/oauth/google/callback/",
                {"state": "valid-state", "code": "temporary-oauth-code"},
            )

        self.assertEqual(response.status_code, 302)
        self.assertIn("token_exchange", captured.output[0])
        self.assertIn("provider=google", captured.output[0])
        self.assertNotIn("temporary-oauth-code", "\n".join(captured.output))

    @patch("apps.identity.oauth_views.AuthIdentity.objects.filter", side_effect=RuntimeError("database unavailable"))
    @patch("apps.identity.oauth_views.external_profile", return_value={"id": "google-user", "email": "user@example.test", "name": "Test User", "avatar": ""})
    @patch("apps.identity.oauth_views.http_json", return_value={"access_token": "temporary-access-token"})
    def test_callback_logs_account_phase_failure_and_returns_server_error(self, _http_json, _external_profile, _identity_filter):
        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "test-client", "GOOGLE_CLIENT_SECRET": "test-secret"}):
            session = self.client.session
            session["oauth_state_google"] = "valid-state"
            session.save()
            self.client.raise_request_exception = False

            with self.assertLogs("apps.identity.oauth_views", level="ERROR") as captured:
                response = self.client.get(
                    "/api/v1/identity/oauth/google/callback/",
                    {"state": "valid-state", "code": "temporary-oauth-code"},
                )

        self.assertEqual(response.status_code, 500)
        log_output = "\n".join(captured.output)
        self.assertIn("identity_lookup", log_output)
        self.assertIn("database unavailable", log_output)
        self.assertNotIn("temporary-oauth-code", log_output)
        self.assertNotIn("temporary-access-token", log_output)

    @patch("apps.identity.oauth_views.external_profile", return_value={"id": "new-google-user", "email": "user@example.test", "name": "Test User", "avatar": ""})
    @patch("apps.identity.oauth_views.http_json", return_value={"access_token": "temporary-access-token"})
    def test_linking_second_identity_for_provider_returns_conflict(self, _http_json, _external_profile):
        from .models import AuthIdentity

        user = User.objects.create_user(username="oauth-link-user", email="user@example.test")
        AuthIdentity.objects.create(user=user, provider="google", provider_user_id="existing-google-user")
        self.client.force_login(user)
        session = self.client.session
        session["oauth_state_google"] = "valid-state"
        session["oauth_link_user_id"] = str(user.pk)
        session.save()

        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "test-client", "GOOGLE_CLIENT_SECRET": "test-secret"}):
            response = self.client.get(
                "/api/v1/identity/oauth/google/callback/",
                {"state": "valid-state", "code": "temporary-oauth-code"},
            )

        self.assertEqual(response.status_code, 302)
        self.assertIn("status=conflict", response["Location"])
        self.assertEqual(AuthIdentity.objects.filter(user=user, provider="google").count(), 1)

    @override_settings(WEB_ORIGIN="https://frontend.example.test")
    @patch("apps.identity.oauth_views.external_profile", return_value={"id": "new-google-user", "email": "new-user@example.test", "name": "New User", "first_name": "New", "last_name": "User", "avatar": "https://images.example.test/google-avatar.png"})
    @patch("apps.identity.oauth_views.http_json", return_value={"access_token": "temporary-access-token"})
    def test_new_oauth_account_redirects_directly_to_onboarding(self, _http_json, _external_profile):
        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "test-client", "GOOGLE_CLIENT_SECRET": "test-secret"}):
            session = self.client.session
            session["oauth_state_google"] = "valid-state"
            session.save()

            response = self.client.get(
                "/api/v1/identity/oauth/google/callback/",
                {"state": "valid-state", "code": "temporary-oauth-code"},
            )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "https://frontend.example.test/onboarding/identite")
        from .models import AccountProfile
        created_user = User.objects.get(email="new-user@example.test")
        self.assertEqual((created_user.first_name, created_user.last_name), ("New", "User"))
        self.assertEqual(AccountProfile.objects.get(user=created_user).avatar_url, "https://images.example.test/google-avatar.png")

    @override_settings(WEB_ORIGIN="https://frontend.example.test")
    @patch("apps.identity.oauth_views.external_profile", return_value={"id": "existing-google-user", "email": "existing-user@example.test", "name": "Existing User", "avatar": ""})
    @patch("apps.identity.oauth_views.http_json", return_value={"access_token": "temporary-access-token"})
    def test_existing_oauth_account_redirects_to_active_space(self, _http_json, _external_profile):
        from .models import AccountContext, AccountProfile, AuthIdentity

        user = User.objects.create_user(username="oauth-existing-user", email="existing-user@example.test")
        AccountContext.objects.create(user=user, role="professional", is_active=True, onboarding_completed=True)
        # Depuis la 1.9, un compte sans méthode de récupération est d'abord dirigé vers /onboarding/securite : ici elle est configurée.
        AccountProfile.objects.update_or_create(user=user, defaults={"recovery_question": "Question de test ?", "recovery_answer_hash": "hash-de-test"})
        AuthIdentity.objects.create(user=user, provider="google", provider_user_id="existing-google-user")
        session = self.client.session
        session["oauth_state_google"] = "valid-state"
        session.save()

        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "test-client", "GOOGLE_CLIENT_SECRET": "test-secret"}):
            response = self.client.get(
                "/api/v1/identity/oauth/google/callback/",
                {"state": "valid-state", "code": "temporary-oauth-code"},
            )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "https://frontend.example.test/professionnel")


    @override_settings(WEB_ORIGIN="https://frontend.example.test")
    @patch("apps.identity.oauth_views.external_profile", return_value={"id": "existing-google-user-2", "email": "existing-user-2@example.test", "name": "Existing User", "avatar": ""})
    @patch("apps.identity.oauth_views.http_json", return_value={"access_token": "temporary-access-token"})
    def test_existing_oauth_account_without_recovery_goes_to_security_step(self, _http_json, _external_profile):
        from .models import AccountContext, AuthIdentity

        user = User.objects.create_user(username="oauth-existing-user-2", email="existing-user-2@example.test")
        AccountContext.objects.create(user=user, role="professional", is_active=True, onboarding_completed=True)
        AuthIdentity.objects.create(user=user, provider="google", provider_user_id="existing-google-user-2")
        session = self.client.session
        session["oauth_state_google"] = "valid-state"
        session.save()

        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "test-client", "GOOGLE_CLIENT_SECRET": "test-secret"}):
            response = self.client.get(
                "/api/v1/identity/oauth/google/callback/",
                {"state": "valid-state", "code": "temporary-oauth-code"},
            )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "https://frontend.example.test/onboarding/securite")


class DemoSeedCommandTests(TestCase):
    @override_settings(DEBUG=False)
    @patch.dict(os.environ, {"ECARNET_ENVIRONMENT": "local", "ECARNET_ENABLE_DEMO_SEED": "1", "ECARNET_DEMO_PASSWORD": "Local-Demo-Password-123!"})
    def test_seed_is_refused_when_debug_is_off(self):
        with self.assertRaises(CommandError):
            call_command("seed_demo_data")

    @override_settings(DEBUG=True)
    @patch.dict(os.environ, {"ECARNET_ENVIRONMENT": "local", "ECARNET_ENABLE_DEMO_SEED": "1", "ECARNET_DEMO_PASSWORD": "Local-Demo-Password-123!"})
    def test_seed_is_idempotent_and_creates_only_synthetic_scenarios(self):
        call_command("seed_demo_data", verbosity=0)
        call_command("seed_demo_data", verbosity=0)

        patient = User.objects.get(email="demo-patient@example.test")
        root = User.objects.get(email="demo-root@example.test")
        doctor = User.objects.get(email="demo-doctor@example.test")
        pending_doctor = User.objects.get(email="demo-doctor-pending@example.test")
        self.assertTrue(patient.check_password("Local-Demo-Password-123!"))
        self.assertTrue(patient.account_contexts.filter(role="patient", is_active=True).exists())
        self.assertTrue(doctor.professional_profile.verification_status == "verified")
        self.assertEqual(Establishment.objects.filter(internal_code="DEMO-ETAB-001").count(), 1)
        self.assertEqual(EstablishmentMembership.objects.filter(professional=doctor.professional_profile, status="active").count(), 1)
        self.assertEqual(EstablishmentMembership.objects.filter(professional=pending_doctor.professional_profile, status="pending").count(), 1)
        self.assertEqual(root.created_establishments.get(internal_code="DEMO-ETAB-001").status, "active")
        pending_root = User.objects.get(email="demo-org-pending@example.test")
        self.assertEqual(Establishment.objects.filter(created_by=pending_root, status="pending").count(), 1)

    @override_settings(DEBUG=True)
    @patch.dict(os.environ, {"ECARNET_ENVIRONMENT": "local", "ECARNET_ENABLE_DEMO_SEED": "0", "ECARNET_DEMO_PASSWORD": "Local-Demo-Password-123!"})
    def test_seed_requires_explicit_opt_in(self):
        with self.assertRaises(CommandError):
            call_command("seed_demo_data")

    @override_settings(DEBUG=True)
    @patch.dict(os.environ, {"ECARNET_ENVIRONMENT": "staging", "ECARNET_ENABLE_DEMO_SEED": "1", "ECARNET_DEMO_PASSWORD": "Local-Demo-Password-123!"})
    def test_seed_is_refused_outside_local_environment(self):
        with self.assertRaises(CommandError):
            call_command("seed_demo_data")

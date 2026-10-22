"""Liaison Google des comptes établissement : même adresse, adresse confirmée par Google, retour sur les paramètres."""
import os
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from .models import AccountContext, AuthIdentity

User = get_user_model()
ENV = {"GOOGLE_CLIENT_ID": "test-client", "GOOGLE_CLIENT_SECRET": "test-secret"}


def google_profile(email, verified=True, sub="google-sub-1"):
    return {"id": sub, "email": email, "email_verified": verified, "name": "Clinique Test", "first_name": "", "last_name": "", "avatar": ""}


@override_settings(WEB_ORIGIN="https://frontend.example.test")
@patch("apps.identity.oauth_views.http_json", return_value={"access_token": "temporary-access-token"})
class EstablishmentGoogleLinkTests(TestCase):
    def make_account(self, role="establishment", email="clinique@gmail.com", extra_roles=()):
        user = User.objects.create_user(username=email, email=email, password="fake-local-password")
        AccountContext.objects.create(user=user, role=role, is_active=True, onboarding_completed=True)
        for other in extra_roles:
            AccountContext.objects.create(user=user, role=other, is_active=False)
        return user

    def callback(self, user, next_path="/etablissement"):
        self.client.force_login(user)
        session = self.client.session
        session["oauth_state_google"] = "valid-state"
        session["oauth_link_user_id"] = str(user.pk)
        session["oauth_next"] = next_path
        session.save()
        with patch.dict(os.environ, ENV):
            return self.client.get("/api/v1/identity/oauth/google/callback/", {"state": "valid-state", "code": "temporary-oauth-code"})

    def test_same_verified_address_links_and_returns_to_the_requested_page(self, _http):
        user = self.make_account()
        with patch("apps.identity.oauth_views.external_profile", return_value=google_profile("Clinique@Gmail.com")):
            response = self.callback(user)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "https://frontend.example.test/etablissement")
        self.assertTrue(AuthIdentity.objects.filter(user=user, provider="google").exists())

    def test_other_google_address_is_refused_and_journaled(self, _http):
        user = self.make_account()
        with patch("apps.identity.oauth_views.external_profile", return_value=google_profile("autre@gmail.com")):
            response = self.callback(user)
        self.assertEqual(response.status_code, 302)
        self.assertIn("/etablissement/parametres", response["Location"])
        self.assertIn("status=email_mismatch", response["Location"])
        self.assertFalse(AuthIdentity.objects.filter(user=user).exists())
        event = AuditEvent.objects.get(event_type="oauth.link_refused")
        self.assertEqual(event.metadata["status"], "email_mismatch")
        self.assertNotIn("autre@gmail.com", str(event.metadata))

    def test_unverified_google_address_is_refused(self, _http):
        user = self.make_account()
        with patch("apps.identity.oauth_views.external_profile", return_value=google_profile("clinique@gmail.com", verified=False)):
            response = self.callback(user)
        self.assertIn("status=email_unverified", response["Location"])
        self.assertFalse(AuthIdentity.objects.filter(user=user).exists())

    def test_patient_accounts_keep_the_free_linking_behaviour(self, _http):
        user = self.make_account(role="patient", email="patient@example.test")
        with patch("apps.identity.oauth_views.external_profile", return_value=google_profile("someone-else@gmail.com", verified=False)):
            response = self.callback(user, next_path="/patient/parametres")
        self.assertEqual(response["Location"], "https://frontend.example.test/patient/parametres")
        self.assertTrue(AuthIdentity.objects.filter(user=user, provider="google").exists())

    def test_account_with_a_patient_context_is_not_constrained(self, _http):
        user = self.make_account(extra_roles=("patient",))
        with patch("apps.identity.oauth_views.external_profile", return_value=google_profile("someone-else@gmail.com")):
            response = self.callback(user)
        self.assertTrue(AuthIdentity.objects.filter(user=user, provider="google").exists())
        self.assertEqual(response.status_code, 302)

    def test_link_without_next_lands_on_the_role_settings(self, _http):
        user = self.make_account()
        with patch("apps.identity.oauth_views.external_profile", return_value=google_profile("clinique@gmail.com")):
            response = self.callback(user, next_path="")
        self.assertEqual(response["Location"], "https://frontend.example.test/etablissement/parametres")


class OAuthProviderAvailabilityTests(TestCase):
    def test_reports_configuration_without_exposing_secrets(self):
        with patch.dict(os.environ, {**ENV, "FACEBOOK_CLIENT_ID": "", "FACEBOOK_CLIENT_SECRET": "", "APPLE_CLIENT_ID": "", "APPLE_CLIENT_SECRET": ""}):
            response = APIClient().get("/api/v1/identity/oauth/providers/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"], {"google": True, "facebook": False, "apple": False})
        self.assertNotIn("test-secret", response.content.decode())

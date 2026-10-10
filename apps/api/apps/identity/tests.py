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
from .oauth_views import safe_next_path

User = get_user_model()


class ThemePreferenceTests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(username="patient-a", password="fake-local-password")
        self.user_b = User.objects.create_user(username="patient-b", password="fake-local-password")
        self.client = APIClient()

    def test_new_account_gets_lagon_unbounded_default(self):
        self.client.force_authenticate(self.user_a)
        response = self.client.get("/api/v1/identity/me/theme/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], DEFAULT_THEME)
        self.assertEqual(ThemePreference.objects.get(user=self.user_a).theme, DEFAULT_THEME)

    def test_theme_is_private_to_each_account(self):
        custom = {"font": "Sora", "palette": ["#E9F7F2", "#BFE8D6", "#63C6A7", "#2F7E6A", "#1F2E2C"]}
        self.client.force_authenticate(self.user_a)
        response = self.client.patch("/api/v1/identity/me/theme/", custom, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(ThemePreference.objects.get(user=self.user_a).theme, custom)
        self.client.force_authenticate(self.user_b)
        response_b = self.client.get("/api/v1/identity/me/theme/")
        self.assertEqual(response_b.data["data"], DEFAULT_THEME)
        self.assertNotEqual(response_b.data["data"], custom)

    def test_invalid_font_or_palette_is_rejected(self):
        self.client.force_authenticate(self.user_a)
        invalid = {"font": "url(javascript:alert(1))", "palette": ["red"] * 5}
        response = self.client.patch("/api/v1/identity/me/theme/", invalid, format="json")
        self.assertEqual(response.status_code, 400)

    def test_anonymous_user_gets_default_theme_but_cannot_write(self):
        response = self.client.get("/api/v1/identity/me/theme/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], DEFAULT_THEME)
        self.assertFalse(ThemePreference.objects.exists())
        self.assertEqual(self.client.patch("/api/v1/identity/me/theme/", DEFAULT_THEME, format="json").status_code, 403)

    def test_session_write_requires_csrf_token(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user_a)
        payload = {"font": "Sora", "palette": ["#E9F7F2", "#BFE8D6", "#63C6A7", "#2F7E6A", "#1F2E2C"]}
        url = "/api/v1/identity/me/theme/"
        denied = client.patch(url, data=json.dumps(payload), content_type="application/json", HTTP_ORIGIN="http://localhost:3000")
        self.assertEqual(denied.status_code, 403)

        client.get("/api/v1/csrf/")
        token = client.cookies["csrftoken"].value
        accepted = client.patch(url, data=json.dumps(payload), content_type="application/json", HTTP_ORIGIN="http://localhost:3000", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(ThemePreference.objects.get(user=self.user_a).theme, payload)


class OAuthRedirectTests(TestCase):
    def test_next_path_accepts_only_safe_relative_paths(self):
        self.assertEqual(safe_next_path("/onboarding/identite", "/patient"), "/onboarding/identite")
        self.assertEqual(safe_next_path("https://example.test", "/patient"), "/patient")
        self.assertEqual(safe_next_path("//example.test", "/patient"), "/patient")
        self.assertEqual(safe_next_path("/\\example.test", "/patient"), "/patient")


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

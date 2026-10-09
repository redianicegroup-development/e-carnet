import os
import subprocess
import sys
from pathlib import Path

from django.test import TestCase


class HealthTests(TestCase):
    def test_legacy_health_is_public_and_contains_no_sensitive_data(self):
        response = self.client.get("/api/v1/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_liveness_is_public_and_does_not_depend_on_the_database(self):
        response = self.client.get("/api/v1/health/live/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_readiness_checks_database_without_returning_database_details(self):
        response = self.client.get("/api/v1/health/ready/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ready"})
        self.assertNotIn("database", response.json())


class ProductionSettingsTests(TestCase):
    def test_non_debug_settings_refuse_a_missing_secret_key(self):
        environment = os.environ.copy()
        environment.pop("DJANGO_SECRET_KEY", None)
        environment["DJANGO_DEBUG"] = "false"
        api_directory = Path(__file__).resolve().parents[1]

        result = subprocess.run(
            [sys.executable, "-c", "import config.settings"],
            cwd=api_directory,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY must be set", result.stderr)

    def settings_output(self, extra, expression):
        environment = {key: value for key, value in os.environ.items() if not key.startswith("DJANGO_") and key not in ("DRF_NUM_PROXIES", "SESSION_COOKIE_SAMESITE", "CSRF_COOKIE_SAMESITE")}
        environment.update(extra)
        api_directory = Path(__file__).resolve().parents[1]
        return subprocess.run([sys.executable, "-c", f"import config.settings as s; print({expression})"], cwd=api_directory, env=environment, capture_output=True, text=True, check=False)

    def test_debug_is_off_by_default_so_a_missing_variable_cannot_expose_the_app(self):
        missing_everything = self.settings_output({}, "s.DEBUG")
        self.assertNotEqual(missing_everything.returncode, 0)  # pas de clé, pas de debug : refus net
        self.assertIn("DJANGO_SECRET_KEY must be set", missing_everything.stderr)
        with_key = self.settings_output({"DJANGO_SECRET_KEY": "x" * 60}, "s.DEBUG")
        self.assertEqual(with_key.stdout.strip(), "False")

    def test_debug_can_still_be_enabled_explicitly_for_local_development(self):
        result = self.settings_output({"DJANGO_DEBUG": "true"}, "(s.DEBUG, s.SECURE_SSL_REDIRECT if hasattr(s, 'SECURE_SSL_REDIRECT') else False)")
        self.assertEqual(result.stdout.strip(), "(True, False)")

    def test_production_defaults_enforce_https_hsts_secure_cookies_and_proxy_trust(self):
        expression = "(s.SECURE_SSL_REDIRECT, s.SECURE_HSTS_SECONDS > 0, s.SESSION_COOKIE_SECURE, s.CSRF_COOKIE_SECURE, s.SESSION_COOKIE_SAMESITE, s.CSRF_COOKIE_SAMESITE, s.REST_FRAMEWORK['NUM_PROXIES'], s.SECURE_PROXY_SSL_HEADER[0], s.CACHES['default']['BACKEND'].rsplit('.', 1)[-1])"
        result = self.settings_output({"DJANGO_SECRET_KEY": "x" * 60}, expression)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "(True, True, True, True, 'None', 'None', 1, 'HTTP_X_FORWARDED_PROTO', 'DatabaseCache')")

    def test_health_probes_are_exempt_from_the_https_redirect(self):
        result = self.settings_output({"DJANGO_SECRET_KEY": "x" * 60}, "s.SECURE_REDIRECT_EXEMPT")
        self.assertIn("api/v1/health", result.stdout)

    def test_admin_path_is_configurable(self):
        result = self.settings_output({"DJANGO_SECRET_KEY": "x" * 60, "DJANGO_ADMIN_PATH": "/console-secrete"}, "s.ADMIN_URL")
        self.assertEqual(result.stdout.strip(), "console-secrete/")

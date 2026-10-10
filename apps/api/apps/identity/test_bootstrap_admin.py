import os
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command, CommandError
from django.test import TestCase, override_settings


EMAIL = "initial-admin@example.test"
PASSWORD = "K8#rQ2!vM7@pX4$sL9&zT6"


@override_settings(AUTH_PASSWORD_VALIDATORS=[])
class BootstrapAdminCommandTests(TestCase):
    def test_startup_mode_skips_when_admin_is_not_configured(self):
        output = StringIO()
        with patch.dict(os.environ, {}, clear=True):
            call_command("bootstrap_admin", "--if-configured", stdout=output)
        self.assertIn("aucun bootstrap", output.getvalue())
        self.assertFalse(get_user_model().objects.exists())

    def test_requires_both_environment_variables(self):
        with patch.dict(os.environ, {}, clear=True), self.assertRaises(CommandError):
            call_command("bootstrap_admin")
        self.assertFalse(get_user_model().objects.exists())

    def test_rejects_password_shorter_than_twenty_characters(self):
        with patch.dict(os.environ, {"DJANGO_ADMIN_EMAIL": EMAIL, "DJANGO_ADMIN_PASSWORD": "Short-pass-123!"}), self.assertRaises(CommandError):
            call_command("bootstrap_admin")
        self.assertFalse(get_user_model().objects.exists())

    def test_creates_superuser_using_email_as_login(self):
        with patch.dict(os.environ, {"DJANGO_ADMIN_EMAIL": EMAIL, "DJANGO_ADMIN_PASSWORD": PASSWORD}):
            call_command("bootstrap_admin")
        user = get_user_model().objects.get(email=EMAIL)
        self.assertEqual(user.username, EMAIL)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.check_password(PASSWORD))

    def test_never_promotes_existing_regular_account(self):
        User = get_user_model()
        User.objects.create_user(username=EMAIL, email=EMAIL, password="user-password")
        with patch.dict(os.environ, {"DJANGO_ADMIN_EMAIL": EMAIL, "DJANGO_ADMIN_PASSWORD": PASSWORD}), self.assertRaises(CommandError):
            call_command("bootstrap_admin")
        self.assertFalse(User.objects.get(email=EMAIL).is_superuser)

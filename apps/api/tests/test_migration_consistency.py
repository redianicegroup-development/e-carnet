from django.core.management import call_command
from django.test import TestCase


class MigrationConsistencyTests(TestCase):
    def test_models_have_no_undetected_migrations(self):
        """Keep migration drift inside the ordinary Django test suite."""
        call_command("makemigrations", check=True, dry_run=True, verbosity=0)

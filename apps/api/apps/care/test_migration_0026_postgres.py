from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

from apps.care.models import PreconsultationTemplate
from apps.establishments.models import Establishment


CARE_0025 = ("care", "0025_followupplan_objective")
CARE_0027 = ("care", "0027_appointment_workflow")


class Care0026PostgreSQLMigrationTests(TransactionTestCase):
    """Exercise the data update and constraint DDL that share care.0026's transaction."""

    def setUp(self):
        super().setUp()
        if connection.vendor != "postgresql":
            self.skipTest("C8 requires PostgreSQL transactional DDL")

    def _fixture_teardown(self):
        # audit.0003 deliberately forbids TRUNCATE. This test restores migrations and removes
        # its own rows in finally, so the generic database-wide flush is neither needed nor safe.
        pass

    def test_legacy_templates_survive_0026_constraints_and_rollback(self):
        executor = MigrationExecutor(connection)
        latest_targets = executor.loader.graph.leaf_nodes()
        try:
            executor.migrate([CARE_0025])
            legacy_apps = MigrationExecutor(connection).loader.project_state([CARE_0025]).apps
            LegacyTemplate = legacy_apps.get_model("care", "PreconsultationTemplate")

            first_site = Establishment.objects.create(name="C8 legacy site one", status="active")
            second_site = Establishment.objects.create(name="C8 legacy site two", status="active")
            legacy_rows = [
                LegacyTemplate.objects.create(establishment_id=first_site.pk, name="Ancien actif A", fields=[], active=True),
                LegacyTemplate.objects.create(establishment_id=first_site.pk, name="Ancien actif B", fields=[], active=True),
                LegacyTemplate.objects.create(establishment_id=first_site.pk, name="Ancien inactif", fields=[], active=False),
                LegacyTemplate.objects.create(establishment_id=second_site.pk, name="Actif autre site", fields=[], active=True),
            ]
            self.assertEqual(LegacyTemplate.objects.filter(active=True).count(), 3)
            self.assertEqual(
                LegacyTemplate.objects.filter(establishment_id=first_site.pk, active=True).count(), 2
            )
            self.assertEqual(len({row.establishment_id for row in legacy_rows if row.active}), 2)

            executor = MigrationExecutor(connection)
            executor.migrate([CARE_0027])
            current_apps = MigrationExecutor(connection).loader.project_state([CARE_0027]).apps
            CurrentTemplate = current_apps.get_model("care", "PreconsultationTemplate")
            migrated_rows = list(CurrentTemplate.objects.order_by("name").values_list("name", "active", "status"))
            self.assertEqual(len(migrated_rows), 4)
            self.assertTrue(all(not active and status == "draft" for _, active, status in migrated_rows))

            with connection.cursor() as cursor:
                db_constraints = connection.introspection.get_constraints(cursor, CurrentTemplate._meta.db_table)
            self.assertTrue(db_constraints["unique_active_preconsult_template"].get("unique"))
            self.assertTrue(db_constraints["preconsultation_template_approval_ck"].get("check"))

            executor = MigrationExecutor(connection)
            executor.migrate([CARE_0025])
            rolled_back_apps = MigrationExecutor(connection).loader.project_state([CARE_0025]).apps
            RolledBackTemplate = rolled_back_apps.get_model("care", "PreconsultationTemplate")
            self.assertNotIn("status", {field.name for field in RolledBackTemplate._meta.local_fields})
            self.assertEqual(RolledBackTemplate.objects.filter(active=False).count(), 4)
        finally:
            MigrationExecutor(connection).migrate(latest_targets)
            PreconsultationTemplate.objects.filter(
                establishment__name__in=("C8 legacy site one", "C8 legacy site two")
            ).delete()
            Establishment.objects.filter(
                name__in=("C8 legacy site one", "C8 legacy site two")
            ).delete()

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.audit.services import record_event

User = get_user_model()
JOURNAL = "/api/v1/identity/admin/audit/"
EXPORT = "/api/v1/identity/admin/audit/export/"


@override_settings(ECARNET_OPERATIONS_ADMIN_EMAILS=("ops@example.test",))
class AdminAuditJournalTests(TestCase):
    """ADM-07 : journal consultable, filtré, exportable, immuable et sans donnée sensible."""

    def setUp(self):
        self.ops = User.objects.create_superuser(username="ops@example.test", email="ops@example.test", password="Test-password-2026!")
        self.client = APIClient(); self.client.force_authenticate(self.ops)
        record_event(event_type="establishment_record.opened", actor=self.ops, actor_role="establishment_admin", metadata={"action": "opened", "reason_code": "soins_en_cours", "reason_note": "texte libre à ne pas exposer"})
        record_event(event_type="patient.carnet.exported", actor=self.ops, actor_role="patient", metadata={"action": "exported"})
        record_event(event_type="membership.approved", actor=self.ops, actor_role="professional", metadata={"status": "active"})

    def test_access_is_reserved_to_the_operations_team(self):
        self.assertEqual(APIClient().get(JOURNAL).status_code, 403)
        other = User.objects.create_user(username="simple@example.test", email="simple@example.test", password="Test-password-2026!")
        client = APIClient(); client.force_authenticate(other)
        self.assertEqual(client.get(JOURNAL).status_code, 403)
        self.assertEqual(client.get(EXPORT).status_code, 403)

    def test_journal_lists_events_most_recent_first_without_sensitive_data(self):
        response = self.client.get(JOURNAL)
        self.assertEqual(response.status_code, 200)
        events = response.data["data"]["events"]
        self.assertEqual(len(events), 3)
        self.assertEqual(events[0]["event_type"], "membership.approved")
        self.assertTrue(response.data["data"]["immutable"])
        first = events[-1]
        self.assertEqual(first["actor"], "o***@example.test")
        self.assertNotIn("reason_note", first["metadata"])
        self.assertFalse([key for key in first["metadata"] if key.endswith("_id")])
        self.assertNotIn("patient", first)
        self.assertNotIn("ops@example.test", str(response.data))

    def test_filters_by_type_role_and_period(self):
        self.assertEqual([e["event_type"] for e in self.client.get(JOURNAL + "?type=patient.").data["data"]["events"]], ["patient.carnet.exported"])
        self.assertEqual(len(self.client.get(JOURNAL + "?role=professional").data["data"]["events"]), 1)
        self.assertEqual(len(self.client.get(JOURNAL + "?from=2999-01-01").data["data"]["events"]), 0)
        self.assertEqual(self.client.get(JOURNAL + "?from=2026-10-02&to=2026-10-01").status_code, 400)
        self.assertEqual(self.client.get(JOURNAL + "?type=DROP%20TABLE").status_code, 400)

    def test_pagination_gives_a_cursor_until_the_end(self):
        page = self.client.get(JOURNAL + "?limit=2").data["data"]
        self.assertEqual(len(page["events"]), 2)
        self.assertIsNotNone(page["next_before"])
        rest = self.client.get(JOURNAL, {"limit": 2, "before": page["next_before"]}).data["data"]
        self.assertEqual(len(rest["events"]), 1)
        self.assertIsNone(rest["next_before"])

    def test_export_is_a_csv_and_is_itself_audited(self):
        response = self.client.get(EXPORT + "?type=membership.")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response["Content-Type"])
        self.assertIn("no-store", response["Cache-Control"])
        body = response.content.decode("utf-8-sig")
        self.assertIn("membership.approved", body)
        self.assertNotIn("patient.carnet.exported", body)
        self.assertTrue(AuditEvent.objects.filter(event_type="admin.audit.exported").exists())

    def test_audit_events_cannot_be_changed_or_deleted(self):
        event = AuditEvent.objects.first()
        with self.assertRaises(TypeError):
            event.delete()
        with self.assertRaises(TypeError):
            AuditEvent.objects.all().update(actor_role="x")
        with self.assertRaises(TypeError):
            AuditEvent.objects.all().delete()

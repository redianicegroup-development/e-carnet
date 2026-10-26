import unittest

from django.db import DatabaseError, connection, transaction
from django.test import TestCase
from .models import AuditEvent
from .services import record_event


class AuditMetadataWhitelistTests(TestCase):
    def test_foundation_identifiers_are_kept_but_free_text_is_discarded(self):
        event = record_event(
            event_type="establishment_record.opened",
            actor=None,
            actor_role="system",
            metadata={
                "reason_category": "autre",
                "opening_id": "opening-123",
                "delegation_id": "delegation-123",
                "referral_id": "referral-123",
                "counterparty_establishment_id": "establishment-123",
                "reason_note": "Texte libre sensible qui ne doit jamais être copié",
            },
        )

        self.assertEqual(event.metadata["reason_category"], "autre")
        self.assertEqual(event.metadata["opening_id"], "opening-123")
        self.assertNotIn("reason_note", event.metadata)
        self.assertEqual(AuditEvent.objects.get(pk=event.pk).metadata, event.metadata)


@unittest.skipUnless(connection.vendor == "postgresql", "Le déclencheur TRUNCATE exige PostgreSQL.")
class AuditAppendOnlyTests(TestCase):
    def test_truncate_is_rejected_by_the_database(self):
        with self.assertRaises(DatabaseError):
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("TRUNCATE audit_auditevent")

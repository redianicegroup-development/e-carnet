import unittest

from django.db import DatabaseError, connection, transaction
from django.test import TestCase


@unittest.skipUnless(connection.vendor == "postgresql", "Le déclencheur TRUNCATE exige PostgreSQL.")
class AuditAppendOnlyTests(TestCase):
    def test_truncate_is_rejected_by_the_database(self):
        with self.assertRaises(DatabaseError):
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("TRUNCATE audit_auditevent")

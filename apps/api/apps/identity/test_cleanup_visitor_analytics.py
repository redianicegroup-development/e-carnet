from datetime import timedelta
import uuid

from django.core.management import call_command, CommandError
from django.test import TestCase
from django.utils import timezone

from .models import AnonymousVisitor


class CleanupVisitorAnalyticsTests(TestCase):
    def test_removes_old_visitors_and_keeps_recent_ones(self):
        now = timezone.now()
        old = AnonymousVisitor.objects.create(visitor_id=uuid.uuid4(), last_seen=now - timedelta(days=91))
        recent = AnonymousVisitor.objects.create(visitor_id=uuid.uuid4(), last_seen=now - timedelta(days=30))
        call_command("cleanup_visitor_analytics", retention_days=90)
        self.assertFalse(AnonymousVisitor.objects.filter(pk=old.pk).exists())
        self.assertTrue(AnonymousVisitor.objects.filter(pk=recent.pk).exists())

    def test_rejects_zero_retention(self):
        with self.assertRaises(CommandError):
            call_command("cleanup_visitor_analytics", retention_days=0)

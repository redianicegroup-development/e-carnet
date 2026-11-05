from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.identity.models import MonitoringWebhookEvent


class Command(BaseCommand):
    help = "Supprime les identifiants de webhook de monitoring plus vieux que deux tolérances."

    def add_arguments(self, parser):
        parser.add_argument("--tolerance-seconds", type=int, default=None)

    def handle(self, *args, **options):
        tolerance = options["tolerance_seconds"]
        if tolerance is None:
            tolerance = getattr(settings, "ECARNET_MONITOR_WEBHOOK_TOLERANCE_SECONDS", 300)
        if tolerance < 1:
            raise CommandError("La tolérance doit être d’au moins une seconde.")
        cutoff = timezone.now() - timedelta(seconds=2 * tolerance)
        deleted_count, _ = MonitoringWebhookEvent.objects.filter(received_at__lt=cutoff).delete()
        self.stdout.write(f"Événements de webhook supprimés après {2 * tolerance} secondes : {deleted_count}.")

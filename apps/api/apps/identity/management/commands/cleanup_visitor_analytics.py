from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.identity.models import AnonymousVisitor


class Command(BaseCommand):
    help = "Supprime les agrégats de visiteurs anonymes inactifs au-delà de la durée choisie."

    def add_arguments(self, parser):
        parser.add_argument("--retention-days", type=int, default=90)

    def handle(self, *args, **options):
        retention_days = options["retention_days"]
        if retention_days < 1:
            raise CommandError("La durée de conservation doit être d’au moins un jour.")
        cutoff = timezone.now() - timedelta(days=retention_days)
        deleted_count, _ = AnonymousVisitor.objects.filter(last_seen__lt=cutoff).delete()
        self.stdout.write(f"Agrégats visiteurs supprimés après {retention_days} jours : {deleted_count}.")

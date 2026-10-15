from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from django.utils import timezone

from apps.care.models import PatientAccessQrToken


class Command(BaseCommand):
    help = "Supprime les QR d’accès patient expirés ou déjà utilisés depuis plus de la durée choisie (1 jour par défaut)."

    def add_arguments(self, parser):
        parser.add_argument("--retention-hours", type=int, default=24)

    def handle(self, *args, **options):
        retention_hours = options["retention_hours"]
        if retention_hours < 1:
            raise CommandError("La durée de conservation doit être d’au moins une heure.")
        cutoff = timezone.now() - timedelta(hours=retention_hours)
        # Un jeton n’a plus d’utilité dès qu’il est expiré ou consommé ; on garde un court délai pour le diagnostic.
        deleted_count, _ = PatientAccessQrToken.objects.filter(Q(expires_at__lt=cutoff) | Q(consumed_at__lt=cutoff)).delete()
        self.stdout.write(f"QR d’accès supprimés après {retention_hours} h : {deleted_count}.")

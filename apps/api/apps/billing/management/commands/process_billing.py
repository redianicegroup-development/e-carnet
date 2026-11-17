from django.core.management.base import BaseCommand

from apps.billing.services import process_all


class Command(BaseCommand):
    help = "Facturation : renouvellements, états En retard / Impayée / Suspendue et réactivations. À planifier une fois par jour."

    def handle(self, *args, **options):
        summary = process_all()
        self.stdout.write(f"Renouvellements émis : {summary['renewals']} ; souscriptions annulées : {summary['cancelled']} ; abonnements recalculés : {summary['refreshed']}.")

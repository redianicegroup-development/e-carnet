from django.core.management.base import BaseCommand

from apps.identity.account_state import LOGIN_EVENT_RETENTION_DAYS, delete_old_login_events


class Command(BaseCommand):
    help = f"Supprime les lignes du journal des connexions de plus de {LOGIN_EVENT_RETENTION_DAYS} jours. À planifier chaque jour."

    def handle(self, *args, **options):
        deleted = delete_old_login_events()
        self.stdout.write(f"{deleted} ligne(s) du journal des connexions supprimée(s).")

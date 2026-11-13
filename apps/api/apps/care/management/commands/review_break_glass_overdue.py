from django.core.management.base import BaseCommand

from apps.care.break_glass import escalate_overdue_reviews


class Command(BaseCommand):
    help = "ACS-13 : signale les accès d'urgence (bris de glace) dont la revue n'a pas eu lieu sous 72 h (incident de sécurité + administrateurs). Rejouable : un accès n'est signalé qu'une fois."

    def handle(self, *args, **options):
        flagged = escalate_overdue_reviews()
        self.stdout.write(f"{flagged} accès d’urgence nouvellement signalé(s) pour revue en retard.")

from datetime import timedelta
from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.utils import timezone
from apps.establishments.models import EstablishmentAdministrator, EstablishmentRecordOpening, EstablishmentRecordOpeningClosure

class Command(BaseCommand):
    help = "Liste les ouvertures de dossiers non clôturées depuis N jours et rappelle leurs administrateurs actifs."
    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=7)
        parser.add_argument("--dry-run", action="store_true")
    def handle(self, *args, **options):
        days = options["days"]
        if days < 1:
            raise ValueError("--days doit être supérieur ou égal à 1.")
        cutoff = timezone.now() - timedelta(days=days)
        openings = EstablishmentRecordOpening.objects.filter(opened_at__lte=cutoff).exclude(pk__in=EstablishmentRecordOpeningClosure.objects.values("opening_id")).select_related("establishment")
        self.stdout.write(f"{openings.count()} ouverture(s) ouverte(s) depuis au moins {days} jour(s).")
        for opening in openings.iterator():
            admins = EstablishmentAdministrator.objects.filter(establishment=opening.establishment, status="active", establishment__status="active").select_related("user")
            for assignment in admins:
                email = assignment.user.email
                if email:
                    self.stdout.write(f"{opening.id} · {opening.establishment.name} · {email}")
                    if not options["dry_run"]:
                        send_mail("Rappel : dossier établissement toujours ouvert", f"Une ouverture de dossier motivée reste ouverte depuis {opening.opened_at:%d/%m/%Y %H:%M} dans {opening.establishment.name}. Veuillez vérifier si elle doit être clôturée.", None, [email], fail_silently=True)

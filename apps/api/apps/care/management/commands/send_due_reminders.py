"""Envoie les rappels de prise de médicament arrivés à échéance.

À planifier toutes les 5 minutes (cron cPanel sur Hodi, ou service planifié) :

    python manage.py send_due_reminders

Rejouable sans risque : chaque créneau n'est traité qu'une fois (``MedicationReminderDispatch``), et la commande
n'écrit jamais dans ``MedicationIntake`` (l'observance ne dépend que de ce que le patient confirme).
"""
import logging
from datetime import date, datetime, time, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.care.models import MedicationIntake, MedicationReminder, MedicationReminderDispatch
from apps.care.notifications import notify_patient

logger = logging.getLogger(__name__)


def parse_hhmm(value):
    """« 08:30 » -> time(8, 30) ; None si le format est invalide (les horaires sont saisis librement côté patient)."""
    try:
        hour, minute = str(value).split(":")
        parsed = time(int(hour), int(minute))
    except (ValueError, TypeError):
        return None
    return parsed


class Command(BaseCommand):
    help = "Envoie les rappels de prise dus (idempotent ; à planifier toutes les 5 minutes)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Compte les rappels dus sans rien écrire ni envoyer.")
        parser.add_argument("--now", help="Instant de référence ISO 8601 avec fuseau (tests, rejeu d'un créneau).")

    def handle(self, *args, **options):
        tz = ZoneInfo(settings.ECARNET_REMINDER_TIMEZONE)
        now = timezone.now()
        if options.get("now"):
            parsed = parse_datetime(options["now"])
            if parsed is None or timezone.is_naive(parsed):
                raise CommandError("--now doit être un instant ISO 8601 avec fuseau, ex. 2026-10-28T08:00:00+00:00")
            now = parsed
        dry_run = options["dry_run"]

        catchup = timedelta(minutes=settings.ECARNET_REMINDER_CATCHUP_MINUTES)
        window_start, window_end = now - catchup, now + timedelta(minutes=1)
        local_dates = {window_start.astimezone(tz).date(), window_end.astimezone(tz).date()}

        reminders = (
            MedicationReminder.objects.filter(active=True, patient__user__isnull=False)
            .exclude(stock_remaining=0)
            .select_related("patient")
        )
        sent = skipped = failed = 0
        for reminder in reminders.iterator(chunk_size=500):
            for local_date in sorted(local_dates):
                if reminder.starts_on > local_date or (reminder.ends_on and reminder.ends_on < local_date):
                    continue
                for raw in reminder.times or []:
                    at = parse_hhmm(raw)
                    if at is None:
                        continue
                    slot = datetime.combine(local_date, at, tzinfo=tz).astimezone(dt_timezone.utc)
                    if not (window_start <= slot <= window_end):
                        continue
                    if dry_run:
                        sent += 1
                        continue
                    try:
                        if self._dispatch_slot(reminder, slot):
                            sent += 1
                        else:
                            skipped += 1
                    except Exception:  # noqa: BLE001 - une ligne en défaut ne doit pas bloquer le lot
                        failed += 1
                        logger.exception("rappel: échec rappel=%s", reminder.pk)

        if not dry_run:
            MedicationReminderDispatch.objects.filter(scheduled_for__lt=now - timedelta(days=14)).delete()
        # Aucune donnée de santé dans les journaux : uniquement des compteurs.
        self.stdout.write(f"rappels: {sent} {'dus' if dry_run else 'envoyés'}, {skipped} déjà traités, {failed} en échec")

    @staticmethod
    def _dispatch_slot(reminder, slot):
        """Crée la notification du créneau. Renvoie False si le créneau est déjà traité ou déjà confirmé."""
        with transaction.atomic():
            _, created = MedicationReminderDispatch.objects.get_or_create(reminder=reminder, scheduled_for=slot)
            if not created:
                return False
            if MedicationIntake.objects.filter(reminder=reminder, scheduled_for=slot).exists():
                return False  # le patient a déjà confirmé ce créneau
            label = f"{reminder.name} — {reminder.dosage}" if reminder.dosage else reminder.name
            notify_patient(
                reminder.patient,
                "medication.reminder",
                "Rappel de prise",
                label,
                metadata={"reminder_id": str(reminder.pk), "scheduled_for": slot.isoformat()},
            )
        return True

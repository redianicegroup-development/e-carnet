"""Envoie les résumés périodiques et non médicaux des accès du patient."""
from collections import defaultdict
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.care.notifications import notify_patient
from apps.patients.models import PatientAccessSummaryPreference


class Command(BaseCommand):
    help = "Envoie les résumés d'accès activés par les patients."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        now = timezone.now()
        sent = skipped = 0
        preferences = PatientAccessSummaryPreference.objects.filter(
            frequency__in=("weekly", "monthly"),
        ).select_related("patient")
        for preference in preferences.iterator(chunk_size=500):
            period = timedelta(days=7 if preference.frequency == "weekly" else 30)
            if preference.last_sent_at and now < preference.last_sent_at + period:
                skipped += 1
                continue
            if options["dry_run"]:
                sent += 1
                continue
            with transaction.atomic():
                locked = PatientAccessSummaryPreference.objects.select_for_update().get(pk=preference.pk)
                if locked.frequency not in ("weekly", "monthly"):
                    skipped += 1
                    continue
                period = timedelta(days=7 if locked.frequency == "weekly" else 30)
                if locked.last_sent_at and now < locked.last_sent_at + period:
                    skipped += 1
                    continue
                period_start = now - period
                summary = build_access_summary(locked.patient_id, period_start, now)
                if summary:
                    body = "Votre résumé périodique des accès est disponible dans Mon E‑Carnet."
                else:
                    body = "Aucun accès n’a été enregistré sur cette période."
                notify_patient(
                    locked.patient,
                    kind="patient.access_summary",
                    title="Résumé de vos accès",
                    body=body,
                    metadata={
                        "frequency": locked.frequency,
                        "period_start": period_start.isoformat(),
                        "period_end": now.isoformat(),
                        "accesses_by_structure_type": summary,
                    },
                )
                locked.last_sent_at = now
                locked.save(update_fields=("last_sent_at", "updated_at"))
                sent += 1

        self.stdout.write(f"résumés d’accès: {sent} {'dus' if options['dry_run'] else 'envoyés'}, {skipped} déjà à jour")


def build_access_summary(patient_id, period_start, period_end):
    """Agrège uniquement les lectures auditées et le type de structure, jamais un nom de tiers."""
    events = AuditEvent.objects.filter(
        patient_id=patient_id,
        event_type="clinical_data.read",
        created_at__gte=period_start,
        created_at__lt=period_end,
        establishment__isnull=False,
    ).select_related("establishment").order_by("created_at")
    grouped = defaultdict(list)
    for event in events:
        structure_type = event.establishment.establishment_type or "Structure"
        grouped[structure_type].append(event.created_at)
    return [
        {
            "structure_type": structure_type,
            "count": len(dates),
            "first_access_at": dates[0].isoformat(),
            "last_access_at": dates[-1].isoformat(),
        }
        for structure_type, dates in sorted(grouped.items())
    ]

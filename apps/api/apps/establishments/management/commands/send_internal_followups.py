"""Relances internes ETA-14, à exécuter avec le même cron que les autres commandes planifiées."""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.establishments.models import (
    EstablishmentAdminInvitation,
    EstablishmentAdministrator,
    EstablishmentMembership,
    EstablishmentNotification,
)


class Command(BaseCommand):
    help = "Crée les relances internes des invitations expirées et rattachements en attente."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=7)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        days = options["days"]
        if days < 1:
            raise ValueError("--days doit être supérieur ou égal à 1.")
        cutoff = timezone.now() - timedelta(days=days)
        dry_run = options["dry_run"]
        created = 0

        invitations = EstablishmentAdminInvitation.objects.filter(
            expires_at__lte=cutoff,
            consumed_at__isnull=True,
            revoked_at__isnull=True,
            establishment__status="active",
        ).select_related("establishment")
        for invitation in invitations.iterator(chunk_size=500):
            created += self._notify_admins(
                invitation.establishment,
                event_key=f"eta14:invitation-expired:{invitation.pk}",
                title="Invitation administrateur à vérifier",
                body="Une invitation administrateur expirée doit être vérifiée dans votre structure.",
                metadata={"event": "invitation_expired"},
                dry_run=dry_run,
            )

        memberships = EstablishmentMembership.objects.filter(
            requested_at__lte=cutoff,
            status="pending",
            establishment__status="active",
        ).select_related("establishment")
        for membership in memberships.iterator(chunk_size=500):
            created += self._notify_admins(
                membership.establishment,
                event_key=f"eta14:membership-pending:{membership.pk}",
                title="Rattachement professionnel en attente",
                body="Un rattachement professionnel est en attente de décision dans votre structure.",
                metadata={"event": "membership_pending"},
                dry_run=dry_run,
            )

        self.stdout.write(f"relances internes: {created} {'à créer' if dry_run else 'créées'}")

    @staticmethod
    def _notify_admins(establishment, *, event_key, title, body, metadata, dry_run):
        admins = EstablishmentAdministrator.objects.filter(
            establishment=establishment,
            status="active",
            user__is_active=True,
        ).values_list("user_id", flat=True)
        if dry_run:
            return admins.count()
        created = 0
        for user_id in admins:
            with transaction.atomic():
                _, was_created = EstablishmentNotification.objects.get_or_create(
                    recipient_id=user_id,
                    event_key=event_key,
                    defaults={
                        "establishment": establishment,
                        "kind": "internal.followup",
                        "title": title,
                        "body": body,
                        "metadata": metadata,
                    },
                )
                created += int(was_created)
        return created

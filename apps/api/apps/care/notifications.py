from datetime import timedelta

from django.db import transaction
from django.utils import timezone


def notify_patient(
    patient,
    kind,
    title,
    body,
    metadata=None,
    coalesce_key=None,
    window=timedelta(minutes=30),
):
    """Crée une notification patient ou regroupe un événement récent non lu.

    Pour une clé de coalescence, la première notification porte ``count=1``.
    Les suivantes, pour le même patient et le même type, incrémentent ce compteur
    sans repousser ``created_at`` : la fenêtre reste calculée depuis le premier
    événement du groupe. La clé interne est stockée dans une colonne dédiée et
    n'est donc pas exposée dans les métadonnées de l'API.
    """
    from apps.patients.models import PatientProfile
    from .models import PatientNotification

    payload = dict(metadata or {})
    if coalesce_key is None:
        notification = PatientNotification.objects.create(
            patient=patient,
            kind=kind,
            title=title,
            body=body,
            metadata=payload,
        )
        _push_after_commit(patient, notification)
        return notification

    now = timezone.now()
    with transaction.atomic():
        # Sérialise les créations simultanées pour ce patient sous PostgreSQL.
        PatientProfile.objects.select_for_update().get(pk=patient.pk)
        existing = (
            PatientNotification.objects.select_for_update()
            .filter(
                patient=patient,
                kind=kind,
                coalesce_key=str(coalesce_key),
                read_at__isnull=True,
                created_at__gte=now - window,
            )
            .order_by("-created_at")
            .first()
        )
        if existing:
            existing.metadata = dict(existing.metadata or {})
            existing.metadata["count"] = int(existing.metadata.get("count", 1)) + 1
            existing.save(update_fields=("metadata",))
            return existing

        payload["count"] = 1
        notification = PatientNotification.objects.create(
            patient=patient,
            kind=kind,
            title=title,
            body=body,
            metadata=payload,
            coalesce_key=str(coalesce_key),
        )
        # Pas de push sur un événement regroupé (``existing`` plus haut) : un seul coup de sonnette par groupe.
        _push_after_commit(patient, notification)
        return notification


def _push_after_commit(patient, notification):
    """Prévient les appareils abonnés une fois la transaction validée. Ne lève jamais d'exception.

    Un patient sans compte (``user`` vide) n'a personne à prévenir.
    """
    user_id = getattr(patient, "user_id", None)
    if not user_id:
        return
    from .push import push_enabled, send_push_to_user

    if not push_enabled():
        return
    transaction.on_commit(
        lambda: send_push_to_user(
            user_id,
            kind=notification.kind,
            title=notification.title,
            body=notification.body,
            url="/patient",
            data={"notification_id": str(notification.pk)},
        )
    )

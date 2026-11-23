"""Boîte de notifications des espaces professionnel, établissement et laboratoire.

L'espace patient a sa boîte (`PatientNotification`, rattachée au carnet). Les autres espaces n'en avaient pas : un professionnel n'apprenait
pas qu'un établissement avait accepté ou refusé son rattachement tant qu'il ne rouvrait pas la bonne page. Ici, on réutilise
`EstablishmentNotification` (destinataire = compte, clé d'événement unique par destinataire → pas de doublon si l'action est rejouée) et on
expose la même forme d'API que la boîte patient (`inbox`, `pulse`, lecture, effacement), pour que la cloche de l'interface serve les quatre
espaces sans seconde implémentation. Un push (s'il est activé) réveille l'appareil ; il ne contient jamais de nom ni de motif.
"""
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Max, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.throttles import WriteScopedThrottle

from .models import EstablishmentAdministrator, EstablishmentNotification

INBOX_SIZE = 30


def notify_user(user, establishment, *, kind, title, body, event_key, push_url="/", push_body="", push=True):
    """Dépose une notification dans la boîte de `user` (une seule fois par `event_key`), puis un push après validation de la transaction.

    Ne lève jamais : une notification manquée ne doit pas faire échouer l'action métier qui la déclenche (décision de rattachement…)."""
    try:
        with transaction.atomic():  # point de sauvegarde : une erreur ici ne casse pas la transaction de l'action métier
            item, created = EstablishmentNotification.objects.get_or_create(
                recipient=user,
                event_key=event_key[:255],
                defaults={"establishment": establishment, "kind": kind[:64], "title": title[:180], "body": body[:500]},
            )
    except Exception:  # noqa: BLE001 - voir docstring
        return None
    if created and push:
        from apps.care.push import send_push_to_user

        user_id = user.pk
        transaction.on_commit(lambda: send_push_to_user(user_id, kind=kind, title=title[:180], body=push_body or "Ouvrez Mon E‑Carnet pour la consulter.", url=push_url, data={}))
    return item


def active_administrator_users(establishment):
    """Les comptes des administrateurs actifs d'une structure (établissement ou laboratoire)."""
    return [record.user for record in EstablishmentAdministrator.objects.filter(establishment=establishment, status="active").select_related("user")]


def notify_establishment_admins(establishment, *, exclude=None, **fields):
    """Notifie chaque administrateur actif de l'établissement (sauf `exclude`). `fields` : kind, title, body, event_key, push_url, push_body, push."""
    for user in active_administrator_users(establishment):
        if exclude is not None and user.pk == exclude.pk:
            continue
        notify_user(user, establishment, **fields)


def notify_laboratory_admins(parent, *, exclude=None, **fields):
    """Notifie les administrateurs actifs du ou des laboratoires internes rattachés à `parent` (sauf `exclude`)."""
    for laboratory in parent.laboratories.filter(is_laboratory=True):
        notify_establishment_admins(laboratory, exclude=exclude, **fields)


def notify_staff(*, kind, title, body, event_key, push_url="/admin", push_body="Ouvrez la console pour la traiter."):
    """Notifie l'équipe (super-administrateurs actifs). Sans structure : le titre et le texte ne portent aucun nom ni contenu de santé ; le push non plus."""
    for user in get_user_model().objects.filter(is_superuser=True, is_active=True):
        notify_user(user, None, kind=kind, title=title, body=body, event_key=event_key, push_url=push_url, push_body=push_body)


def _serialize(item):
    return {"id": str(item.id), "kind": item.kind, "title": item.title, "body": item.body, "read_at": item.read_at, "created_at": item.created_at}


def _mine(request):
    return EstablishmentNotification.objects.filter(recipient=request.user)


def _no_store(response):
    response["Cache-Control"] = "private, no-store"
    return response


class RoleNotificationInboxView(APIView):
    """Les 30 plus récentes, avec le total et le nombre de non lues (même forme que la boîte patient)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        mine = _mine(request)
        counts = mine.aggregate(total=Count("id"), unread=Count("id", filter=Q(read_at__isnull=True)))
        items = [_serialize(item) for item in mine.order_by("-created_at")[:INBOX_SIZE]]
        return _no_store(Response({"success": True, "data": {"items": items, "unread_count": counts["unread"], "total_count": counts["total"]}}))


class RoleNotificationPulseView(APIView):
    """Pouls de la cloche : une requête agrégée de quelques octets, interrogée toutes les quelques secondes."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        counts = _mine(request).aggregate(total=Count("id"), unread=Count("id", filter=Q(read_at__isnull=True)), latest=Max("created_at"))
        return _no_store(Response({"success": True, "data": {"unread_count": counts["unread"], "total_count": counts["total"], "latest_at": counts["latest"]}}))


class RoleNotificationReadView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "notification_changes"

    def patch(self, request, pk):
        item = _mine(request).filter(pk=pk).first()
        if not item:
            return Response({"success": False, "message": "Notification introuvable."}, status=404)
        if item.read_at is None:
            item.read_at = timezone.now()
            item.save(update_fields=("read_at",))
        return Response({"success": True, "data": _serialize(item)})


class RoleNotificationDetailView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "notification_changes"

    def delete(self, request, pk):
        deleted, _ = _mine(request).filter(pk=pk).delete()
        if not deleted:
            return Response({"success": False, "message": "Notification introuvable."}, status=404)
        return Response({"success": True, "data": {"deleted": 1}})


class RoleNotificationBulkView(APIView):
    """`read-all` (tout marquer comme lu) ou `clear` (tout effacer)."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "notification_changes"

    def post(self, request, action):
        mine = _mine(request)
        if action == "read-all":
            return Response({"success": True, "data": {"updated": mine.filter(read_at__isnull=True).update(read_at=timezone.now())}})
        if action == "clear":
            deleted, _ = mine.delete()
            return Response({"success": True, "data": {"deleted": deleted}})
        return Response({"success": False, "message": "Action inconnue."}, status=404)  # pragma: no cover — les routes n'exposent que ces deux actions

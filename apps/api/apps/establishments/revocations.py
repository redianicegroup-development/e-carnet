"""Révocation avec motif : ce que voit la personne retirée, et la notification qui l'avertit.

Un établissement peut retirer un professionnel (rattachement) ou un administrateur de laboratoire. Le motif est obligatoire. La personne
le lit à sa prochaine connexion (`revocation_notices` dans la réponse du compte) ; un push l'avertit tout de suite, SANS le motif :
un écran verrouillé ne doit rien révéler. Le motif n'entre jamais dans le journal d'audit (texte libre).
"""
from django.db import transaction
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import EstablishmentAdministrator, EstablishmentMembership

REASON_MIN_LENGTH = 3
REASON_MAX_LENGTH = 500
REASON_REQUIRED_MESSAGE = "Indiquez le motif de la révocation (3 caractères au moins) : la personne le verra à sa prochaine connexion."
REASON_TOO_LONG_MESSAGE = f"Le motif est limité à {REASON_MAX_LENGTH} caractères."
PUSH_TITLE = "Mon E‑Carnet"
PUSH_BODY = "Un établissement a modifié votre rattachement. Ouvrez l’application pour en voir le motif."
MAX_NOTICES = 5


def clean_reason(raw):
    """Motif nettoyé (espaces normalisés) ou message d'erreur : `(motif, None)` ou `(None, message)`."""
    if not isinstance(raw, str):
        return None, REASON_REQUIRED_MESSAGE
    reason = " ".join(raw.split())
    if len(reason) < REASON_MIN_LENGTH:
        return None, REASON_REQUIRED_MESSAGE
    if len(reason) > REASON_MAX_LENGTH:
        return None, REASON_TOO_LONG_MESSAGE
    return reason, None


def notify_revoked(user_id, kind, url="/"):
    """Push « votre rattachement a changé », après validation de la transaction. Ne lève jamais d'exception ; jamais le motif."""
    from apps.care.push import send_push_to_user

    transaction.on_commit(lambda: send_push_to_user(user_id, kind=kind, title=PUSH_TITLE, body=PUSH_BODY, url=url, data={}))


def pending_revocation_notices(user):
    """Motifs de révocation que la personne n'a pas encore lus (rattachement terminé par l'établissement, accès de laboratoire retiré)."""
    if not getattr(user, "is_authenticated", False):
        return []
    notices = []
    memberships = (
        EstablishmentMembership.objects.filter(professional__user=user, terminated_by_establishment=True, termination_notice_seen_at__isnull=True)
        .exclude(termination_reason="")
        .select_related("establishment")
        .order_by("-left_at")[:MAX_NOTICES]
    )
    for item in memberships:
        notices.append({"id": str(item.id), "kind": "membership", "establishment_name": item.establishment.name, "parent_name": "", "reason": item.termination_reason, "revoked_at": item.left_at})
    administrators = (
        EstablishmentAdministrator.objects.filter(user=user, status="revoked", end_notice_seen_at__isnull=True)
        .exclude(end_reason="")
        .select_related("establishment__parent")
        .order_by("-ended_at")[:MAX_NOTICES]
    )
    for item in administrators:
        parent = item.establishment.parent
        notices.append({"id": str(item.id), "kind": "laboratory", "establishment_name": item.establishment.name, "parent_name": parent.name if parent else "", "reason": item.end_reason, "revoked_at": item.ended_at})
    notices.sort(key=lambda notice: notice["revoked_at"] or timezone.now(), reverse=True)
    return notices[:MAX_NOTICES]


class RevocationNoticeAckView(APIView):
    """La personne a lu le motif : on ne le lui remontre plus. `{"id", "kind"}` pour un motif, `{"all": true}` pour tous."""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        now = timezone.now()
        acknowledge_all = request.data.get("all") is True
        notice_id = str(request.data.get("id", "")).strip()
        kind = request.data.get("kind")
        if not acknowledge_all and (not notice_id or kind not in ("membership", "laboratory")):
            return Response({"success": False, "message": "Avis introuvable."}, status=400)
        done = 0
        if acknowledge_all or kind == "membership":
            query = EstablishmentMembership.objects.filter(professional__user=request.user, terminated_by_establishment=True, termination_notice_seen_at__isnull=True)
            if not acknowledge_all:
                query = query.filter(pk=notice_id)
            done += query.update(termination_notice_seen_at=now)
        if acknowledge_all or kind == "laboratory":
            query = EstablishmentAdministrator.objects.filter(user=request.user, status="revoked", end_notice_seen_at__isnull=True)
            if not acknowledge_all:
                query = query.filter(pk=notice_id)
            done += query.update(end_notice_seen_at=now)
        return Response({"success": True, "data": {"acknowledged": done}})

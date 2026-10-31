"""Journal d'audit consultable par l'équipe d'exploitation (ADM-07).

Lecture seule : les événements sont immuables (voir apps.audit.models). Chaque réponse est filtrée :
- aucun identifiant de patient, de consultation ni de dossier : seulement « concerne un patient : oui / non » ;
- seules les clés de métadonnées autorisées par l'audit (ALLOWED_METADATA_KEYS) sont rendues, sans les identifiants (clés en _id) et uniquement si ce sont des valeurs simples ;
- l'e-mail de l'acteur est masqué (a***@domaine).
L'export CSV est limité, neutralise les formules et est lui-même journalisé.
"""
import csv
import io
import re
from datetime import date, datetime, time, timedelta

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditEvent
from apps.audit.services import ALLOWED_METADATA_KEYS, record_event
from .admin_views import IsOperationsAdmin

PAGE_SIZE_DEFAULT = 50
PAGE_SIZE_MAX = 100
EXPORT_MAX_ROWS = 5000
_TYPE = re.compile(r"^[a-z0-9_.]{1,80}$")
_ROLE = re.compile(r"^[a-z_]{1,32}$")
_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")


def _mask_email(value: str) -> str:
    local, _, domain = (value or "").partition("@")
    if not domain:
        return ""
    return f"{local[:1]}***@{domain}"


def _simple(value):
    return value if isinstance(value, (str, int, float, bool)) or value is None else None


def serialize_event(event: AuditEvent) -> dict:
    return {
        "id": str(event.id),
        "created_at": event.created_at,
        "event_type": event.event_type,
        "actor_role": event.actor_role,
        "actor": _mask_email(getattr(event.actor, "email", "") if event.actor_id else ""),
        "establishment": event.establishment.name if event.establishment_id else "",
        "concerns_patient": bool(event.patient_id),
        "metadata": {key: _simple(value) for key, value in (event.metadata or {}).items() if key in ALLOWED_METADATA_KEYS and not key.endswith("_id") and _simple(value) is not None},
    }


def _day(params, name: str):
    raw = str(params.get(name, "") or "").strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise ValidationError({name: "Date attendue au format AAAA-MM-JJ."})


def filtered_events(params):
    """Applique les filtres : type (début), rôle, période (jours inclus). Plus récent d'abord."""
    qs = AuditEvent.objects.select_related("actor", "establishment").order_by("-created_at", "-id")
    event_type = str(params.get("type", "") or "").strip().lower()
    if event_type:
        if not _TYPE.match(event_type):
            raise ValidationError({"type": "Type d’événement invalide."})
        qs = qs.filter(event_type__startswith=event_type)
    role = str(params.get("role", "") or "").strip().lower()
    if role:
        if not _ROLE.match(role):
            raise ValidationError({"role": "Rôle invalide."})
        qs = qs.filter(actor_role=role)
    start, end = _day(params, "from"), _day(params, "to")
    if start and end and start > end:
        raise ValidationError({"to": "La date de fin doit être égale ou postérieure à la date de début."})
    zone = timezone.get_current_timezone()
    if start:
        qs = qs.filter(created_at__gte=timezone.make_aware(datetime.combine(start, time.min), zone))
    if end:
        qs = qs.filter(created_at__lt=timezone.make_aware(datetime.combine(end + timedelta(days=1), time.min), zone))
    return qs


class AdminAuditJournalView(APIView):
    """GET ?type=&role=&from=&to=&limit=&before=<date-heure ISO> : événements, du plus récent au plus ancien."""

    permission_classes = [IsOperationsAdmin]

    def get(self, request):
        qs = filtered_events(request.query_params)
        before = str(request.query_params.get("before", "") or "").strip()
        if before:
            moment = None
            try:
                moment = datetime.fromisoformat(before.replace("Z", "+00:00"))
            except ValueError:
                raise ValidationError({"before": "Repère de pagination invalide."})
            if timezone.is_naive(moment):
                moment = timezone.make_aware(moment, timezone.get_current_timezone())
            qs = qs.filter(created_at__lt=moment)
        try:
            limit = int(request.query_params.get("limit", PAGE_SIZE_DEFAULT))
        except (TypeError, ValueError):
            raise ValidationError({"limit": "Nombre invalide."})
        limit = max(1, min(limit, PAGE_SIZE_MAX))
        page = list(qs[: limit + 1])
        has_more = len(page) > limit
        page = page[:limit]
        return Response({"success": True, "data": {
            "events": [serialize_event(event) for event in page],
            "next_before": page[-1].created_at.isoformat() if has_more and page else None,
            "immutable": True,
        }})


def _csv_cell(value) -> str:
    text = "" if value is None else str(value)
    return "'" + text if text.startswith(_FORMULA_START) else text


class AdminAuditExportView(APIView):
    """GET ?type=&role=&from=&to= : export CSV (UTF-8 avec BOM, lisible par Excel), au plus 5 000 lignes, journalisé."""

    permission_classes = [IsOperationsAdmin]

    def get(self, request):
        events = [serialize_event(event) for event in filtered_events(request.query_params)[:EXPORT_MAX_ROWS]]
        buffer = io.StringIO()
        writer = csv.writer(buffer, delimiter=";")
        writer.writerow(["Date", "Type d'événement", "Rôle", "Acteur", "Établissement", "Concerne un patient", "Détails"])
        for event in events:
            moment = timezone.localtime(event["created_at"]).strftime("%d/%m/%Y %H:%M:%S")
            details = ", ".join(f"{key}={value}" for key, value in event["metadata"].items())
            writer.writerow([_csv_cell(moment), _csv_cell(event["event_type"]), _csv_cell(event["actor_role"]), _csv_cell(event["actor"]), _csv_cell(event["establishment"]), "oui" if event["concerns_patient"] else "non", _csv_cell(details)])
        scope = "&".join(f"{key}={request.query_params.get(key)}" for key in ("type", "role", "from", "to") if request.query_params.get(key))[:120]
        record_event(event_type="admin.audit.exported", actor=request.user, actor_role="operations_admin", metadata={"action": "exported", "scope": scope or "all", "status": "truncated" if len(events) >= EXPORT_MAX_ROWS else "complete"})
        response = HttpResponse("\ufeff" + buffer.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="journal-audit-{timezone.localdate().isoformat()}.csv"'
        response["Cache-Control"] = "private, no-store"
        return response

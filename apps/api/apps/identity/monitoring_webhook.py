import hashlib
import hmac
import json
import time
import uuid

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event
from .models import MonitoringWebhookEvent, OperationalIncident
from .throttles import IpScopedThrottle


def monitoring_signature(secret: str, timestamp: str, event_id: str, body: bytes) -> str:
    """HMAC-SHA256 de « horodatage.identifiant.corps », en hexadécimal."""
    signed = timestamp.encode() + b"." + event_id.encode() + b"." + body
    return hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()


class MonitoringWebhookView(APIView):
    """Réceptionne un événement technique signé et idempotent, sans session ni donnée métier."""

    authentication_classes = []
    permission_classes = []
    throttle_classes = [IpScopedThrottle]
    throttle_scope = "monitoring_webhook"

    @staticmethod
    def _signature_is_valid(request):
        secret = getattr(settings, "ECARNET_MONITOR_WEBHOOK_SECRET", "")
        received = request.headers.get("X-Ecarnet-Monitor-Signature", "")
        timestamp = request.headers.get("X-Ecarnet-Monitor-Timestamp", "")
        event_id = request.headers.get("X-Ecarnet-Monitor-Event-Id", "")
        if not secret or not received.startswith("sha256=") or not timestamp.isdigit() or len(timestamp) > 12:
            return False
        try:
            uuid.UUID(event_id)
        except (ValueError, AttributeError):
            return False
        tolerance = getattr(settings, "ECARNET_MONITOR_WEBHOOK_TOLERANCE_SECONDS", 300)
        if abs(time.time() - int(timestamp)) > tolerance:
            return False
        expected = monitoring_signature(secret, timestamp, event_id, request.body)
        return hmac.compare_digest(received[7:], expected)

    @staticmethod
    def _audit(event_type, incident=None, *, event_id=None):
        metadata = {"event_id": event_id} if event_id else {}
        if incident is not None:
            metadata.update({"incident_key": incident.incident_key, "category": incident.category, "severity": incident.severity, "status": incident.status})
        record_event(event_type=event_type, actor=None, actor_role="monitoring", metadata=metadata)

    def post(self, request):
        event_id = request.headers.get("X-Ecarnet-Monitor-Event-Id", "")
        if not self._signature_is_valid(request):
            return Response({"success": False, "message": "Signature de monitoring invalide."}, status=401)
        event_uuid = uuid.UUID(event_id)
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return Response({"success": False, "message": "Payload de monitoring invalide."}, status=400)
        if not isinstance(payload, dict):
            return Response({"success": False, "message": "Payload de monitoring invalide."}, status=400)

        incident_key = payload.get("incident_key")
        action = payload.get("action", "open")
        severity = payload.get("severity", "warning")
        category = payload.get("category", "api")
        summary = payload.get("summary")
        if not isinstance(incident_key, str) or not incident_key or len(incident_key) > 160:
            return Response({"success": False, "message": "incident_key invalide."}, status=400)
        if action not in {"open", "resolve"} or severity not in {"info", "warning", "major", "critical"} or category not in {"api", "database", "cache", "storage", "backup", "email", "security"}:
            return Response({"success": False, "message": "Événement de monitoring invalide."}, status=400)
        if not isinstance(summary, str) or not summary.strip() or len(summary) > 240:
            return Response({"success": False, "message": "Résumé de monitoring invalide."}, status=400)

        with transaction.atomic():
            try:
                with transaction.atomic():
                    MonitoringWebhookEvent.objects.create(event_id=event_uuid)
            except IntegrityError:
                self._audit("operations.monitoring_webhook.replayed", event_id=str(event_uuid))
                return Response({"success": True, "data": {"event_id": str(event_uuid), "already_received": True, "created": False}})

            if action == "resolve":
                # Une résolution ne crée jamais d'incident : on résout seulement ce qui existe et n'est pas déjà résolu.
                incident = OperationalIncident.objects.filter(incident_key=incident_key).first()
                if incident is None:
                    return Response({"success": True, "data": {"event_id": str(event_uuid), "incident_id": None, "created": False, "status": "unknown"}})
                if incident.status != "resolved":
                    incident.status = "resolved"
                    incident.resolved_at = timezone.now()
                    incident.resolution_note = "Résolu par le monitoring externe."
                    incident.save(update_fields=("status", "resolved_at", "resolution_note", "last_seen_at"))
                    self._audit("operations.incident.external_resolved", incident)
                return Response({"success": True, "data": {"event_id": str(event_uuid), "incident_id": str(incident.id), "created": False, "status": incident.status}})

            incident, created = OperationalIncident.objects.get_or_create(
                incident_key=incident_key,
                defaults={"severity": severity, "category": category, "summary": summary.strip()},
            )
            changed = []
            reopened = False
            if incident.status == "resolved":
                incident.status = "open"
                incident.resolved_at = None
                changed.extend(("status", "resolved_at"))
                reopened = True
            severity_changed = incident.severity != severity
            if severity_changed:
                incident.severity = severity
                changed.append("severity")
            if incident.category != category:
                incident.category = category
                changed.append("category")
            if incident.summary != summary.strip():
                incident.summary = summary.strip()
                changed.append("summary")
            incident.last_seen_at = timezone.now()
            changed.append("last_seen_at")
            incident.save(update_fields=tuple(dict.fromkeys(changed)))
            if created or reopened or severity_changed:
                self._audit("operations.incident.external_opened", incident)
            return Response({"success": True, "data": {"event_id": str(event_uuid), "incident_id": str(incident.id), "created": created, "status": incident.status}})

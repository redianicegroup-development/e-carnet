import hashlib
import hmac
import json
import time

from django.conf import settings
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event
from .models import OperationalIncident
from .throttles import IpScopedThrottle


def monitoring_signature(secret: str, timestamp: str, body: bytes) -> str:
    """Signature attendue : HMAC-SHA256 de « horodatage.corps », en hexadécimal (voir docs/MONITORING-WEBHOOK.md)."""
    return hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()


class MonitoringWebhookView(APIView):
    """Réceptionne un événement technique signé, sans session utilisateur ni donnée métier.

    L'horodatage fait partie de la signature : un événement capturé ne peut plus être rejoué après la tolérance
    (5 minutes par défaut). Les requêtes sont comptées par adresse IP, signature valide ou non."""

    authentication_classes = []
    permission_classes = []
    throttle_classes = [IpScopedThrottle]
    throttle_scope = "monitoring_webhook"

    @staticmethod
    def _signature_is_valid(request):
        secret = getattr(settings, "ECARNET_MONITOR_WEBHOOK_SECRET", "")
        received = request.headers.get("X-Ecarnet-Monitor-Signature", "")
        timestamp = request.headers.get("X-Ecarnet-Monitor-Timestamp", "")
        if not secret or not received.startswith("sha256=") or not timestamp.isdigit() or len(timestamp) > 12:
            return False
        tolerance = getattr(settings, "ECARNET_MONITOR_WEBHOOK_TOLERANCE_SECONDS", 300)
        if abs(time.time() - int(timestamp)) > tolerance:
            return False
        return hmac.compare_digest(received[7:], monitoring_signature(secret, timestamp, request.body))

    @staticmethod
    def _audit(event_type, incident):
        record_event(
            event_type=event_type, actor=None, actor_role="monitoring",
            metadata={"incident_key": incident.incident_key, "category": incident.category, "severity": incident.severity, "status": incident.status},
        )

    def post(self, request):
        if not self._signature_is_valid(request):
            return Response({"success": False, "message": "Signature de monitoring invalide."}, status=401)
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

        if action == "resolve":
            # Une résolution ne crée jamais d'incident : on résout seulement ce qui existe et n'est pas déjà résolu.
            incident = OperationalIncident.objects.filter(incident_key=incident_key).first()
            if incident is None:
                return Response({"success": True, "data": {"incident_id": None, "created": False, "status": "unknown"}})
            if incident.status != "resolved":
                incident.status = "resolved"
                incident.resolved_at = timezone.now()
                incident.resolution_note = "Résolu par le monitoring externe."
                incident.save(update_fields=("status", "resolved_at", "resolution_note", "last_seen_at"))
                self._audit("operations.incident.external_resolved", incident)
            return Response({"success": True, "data": {"incident_id": str(incident.id), "created": False, "status": incident.status}})

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
        # Un événement répété chaque minute ne remplit pas le journal : on trace l'ouverture, la réouverture et le changement de gravité.
        if created or reopened or severity_changed:
            self._audit("operations.incident.external_opened", incident)
        return Response({"success": True, "data": {"incident_id": str(incident.id), "created": created, "status": incident.status}})

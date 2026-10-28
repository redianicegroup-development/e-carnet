import hashlib
import hmac
import json

from django.conf import settings
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import OperationalIncident


class MonitoringWebhookView(APIView):
    """Réceptionne un événement technique signé, sans session utilisateur ni donnée métier."""

    authentication_classes = []
    permission_classes = []

    @staticmethod
    def _signature_is_valid(request):
        secret = getattr(settings, "ECARNET_MONITOR_WEBHOOK_SECRET", "")
        received = request.headers.get("X-Ecarnet-Monitor-Signature", "")
        if not secret or not received.startswith("sha256="):
            return False
        expected = hmac.new(secret.encode(), request.body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(received[7:], expected)

    def post(self, request):
        if not self._signature_is_valid(request):
            return Response({"success": False, "message": "Signature de monitoring invalide."}, status=401)
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
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

        incident, created = OperationalIncident.objects.get_or_create(
            incident_key=incident_key,
            defaults={"severity": severity, "category": category, "summary": summary.strip()},
        )
        if action == "resolve":
            incident.status = "resolved"
            incident.resolved_at = timezone.now()
            incident.resolution_note = "Résolu par le monitoring externe."
            incident.save(update_fields=("status", "resolved_at", "resolution_note", "last_seen_at"))
        else:
            changed = []
            if incident.status == "resolved":
                incident.status = "open"
                incident.resolved_at = None
                changed.extend(("status", "resolved_at"))
            if incident.severity != severity:
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

        return Response({"success": True, "data": {"incident_id": str(incident.id), "created": created, "status": incident.status}})

import os
import time

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event
from .admin_views import IsOperationsAdmin
from .models import OperationalIncident


class AdminOperationsSummaryView(APIView):
    """Résumé technique sans contenu médical, destiné à la console opérations."""

    permission_classes = [IsOperationsAdmin]

    @staticmethod
    def _check_database():
        started = time.perf_counter()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            return {"status": "ok", "duration_ms": round((time.perf_counter() - started) * 1000, 1), "vendor": connection.vendor}
        except Exception as exc:  # noqa: BLE001 - la réponse ne révèle que le type d'échec
            return {"status": "error", "duration_ms": round((time.perf_counter() - started) * 1000, 1), "error": exc.__class__.__name__}

    @staticmethod
    def _check_cache():
        key = "ecarnet:operations:health-check"
        try:
            cache.set(key, "ok", timeout=30)
            return {"status": "ok" if cache.get(key) == "ok" else "error", "backend": cache.__class__.__name__}
        except Exception as exc:  # noqa: BLE001 - ne pas exposer le message du backend
            return {"status": "error", "backend": cache.__class__.__name__, "error": exc.__class__.__name__}

    @staticmethod
    def _check_media():
        media_root = str(getattr(settings, "MEDIA_ROOT", ""))
        if not media_root:
            return {"status": "not_configured"}
        exists = os.path.isdir(media_root)
        writable = os.access(media_root, os.W_OK) if exists else False
        return {"status": "ok" if exists and writable else "warning", "configured": True, "directory_exists": exists, "writable": writable}

    @staticmethod
    def _incident_payload(incident):
        return {
            "id": str(incident.id), "incident_key": incident.incident_key, "severity": incident.severity,
            "category": incident.category, "status": incident.status, "summary": incident.summary,
            "first_seen_at": incident.first_seen_at.isoformat(), "last_seen_at": incident.last_seen_at.isoformat(),
            "acknowledged_at": incident.acknowledged_at.isoformat() if incident.acknowledged_at else None,
            "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
            "resolution_note": incident.resolution_note,
        }

    def get(self, request):
        now = timezone.now()
        database = self._check_database()
        health_cache = self._check_cache()
        media = self._check_media()
        components = {"database": database, "cache": health_cache, "media": media}
        status = "ok"
        if database["status"] == "error":
            status = "error"
        elif any(item["status"] in {"error", "warning"} for item in components.values()):
            status = "warning"
        incidents = [self._incident_payload(item) for item in OperationalIncident.objects.filter(status__in=("open", "acknowledged"))[:100]]
        return Response({"success": True, "data": {
            "generated_at": now.isoformat(), "status": status,
            "environment": "debug" if settings.DEBUG else "production",
            "version": os.environ.get("ECARNET_RELEASE_VERSION", "non définie"),
            "components": components, "incidents": incidents,
            "configuration": {
                "operations_email_allowlist_configured": bool(getattr(settings, "ECARNET_OPERATIONS_ADMIN_EMAILS", ())),
                "smtp_configured": bool(getattr(settings, "EMAIL_HOST", "")) and getattr(settings, "EMAIL_BACKEND", "").endswith("smtp.EmailBackend"),
                "database_configured": bool(os.environ.get("DATABASE_URL")),
                "external_monitoring_url_configured": bool(os.environ.get("ECARNET_MONITOR_BASE_URL")),
            },
            "limitations": [
                "Le résumé local ne remplace pas une sonde externe lorsque l'API est indisponible.",
                "Les métriques p95, 5xx, stockage Hodi et sauvegardes nécessitent une intégration de monitoring externe.",
                "Aucun contenu médical, corps de requête ou secret n'est renvoyé.",
            ],
        }})


class AdminOperationsIncidentView(APIView):
    permission_classes = [IsOperationsAdmin]

    def patch(self, request, incident_id):
        incident = get_object_or_404(OperationalIncident, pk=incident_id)
        action = request.data.get("action")
        if action == "acknowledge":
            incident.status = "acknowledged"
            incident.acknowledged_at = timezone.now()
            incident.acknowledged_by = request.user
            incident.save(update_fields=("status", "acknowledged_at", "acknowledged_by", "last_seen_at"))
            record_event(event_type="operations.incident.acknowledged", actor=request.user, actor_role="ecarnet_staff", metadata={"incident_key": incident.incident_key, "category": incident.category, "severity": incident.severity, "status": incident.status})
        elif action == "resolve":
            note = request.data.get("resolution_note", "")
            if not isinstance(note, str) or len(note.strip()) > 500:
                return Response({"success": False, "message": "La note de résolution est invalide."}, status=400)
            incident.status = "resolved"
            incident.resolved_at = timezone.now()
            incident.resolution_note = note.strip()
            incident.save(update_fields=("status", "resolved_at", "resolution_note", "last_seen_at"))
            record_event(event_type="operations.incident.resolved", actor=request.user, actor_role="ecarnet_staff", metadata={"incident_key": incident.incident_key, "category": incident.category, "severity": incident.severity, "status": incident.status})
        else:
            return Response({"success": False, "message": "Action d’incident inconnue."}, status=400)
        return Response({"success": True, "data": AdminOperationsSummaryView._incident_payload(incident)})

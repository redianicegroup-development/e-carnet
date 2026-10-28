import hashlib
import hmac
import json

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from .models import OperationalIncident

class AdminOperationsTests(TestCase):
    url = "/api/v1/identity/admin/operations/summary/"

    def test_anonymous_users_cannot_access_operations(self):
        self.assertEqual(APIClient().get(self.url).status_code, 403)

    @override_settings(ECARNET_OPERATIONS_ADMIN_EMAILS=("ops@example.test",))
    def test_superadmin_outside_allowlist_cannot_access_operations(self):
        user = get_user_model().objects.create_superuser(
            username="other@example.test", email="other@example.test", password="Test-password-2026!",
        )
        client = APIClient()
        client.force_authenticate(user)
        self.assertEqual(client.get(self.url).status_code, 403)

    @override_settings(ECARNET_OPERATIONS_ADMIN_EMAILS=("ops@example.test",))
    def test_allowed_operations_email_receives_safe_summary(self):
        user = get_user_model().objects.create_superuser(
            username="ops@example.test", email="OPS@example.test", password="Test-password-2026!",
        )
        client = APIClient()
        client.force_authenticate(user)
        response = client.get(self.url)
        self.assertEqual(response.status_code, 200)
        payload = response.data["data"]
        self.assertIn(payload["status"], {"ok", "warning", "error"})
        self.assertIn("database", payload["components"])
        self.assertIn("cache", payload["components"])
        self.assertIn("media", payload["components"])
        self.assertNotIn("password", payload)
        self.assertNotIn("secret_key", payload)
        self.assertNotIn("patient_records", payload)

    @override_settings(ECARNET_OPERATIONS_ADMIN_EMAILS=("ops@example.test",))
    def test_operations_admin_can_acknowledge_and_resolve_incident(self):
        user = get_user_model().objects.create_superuser(
            username="incident-ops@example.test", email="ops@example.test", password="Test-password-2026!",
        )
        incident = OperationalIncident.objects.create(
            incident_key="api:test-500", severity="major", category="api", summary="Taux d’erreur de test élevé.",
        )
        client = APIClient()
        client.force_authenticate(user)
        incident_url = f"/api/v1/identity/admin/operations/incidents/{incident.id}/"
        acknowledged = client.patch(incident_url, {"action": "acknowledge"}, format="json")
        self.assertEqual(acknowledged.status_code, 200)
        incident.refresh_from_db()
        self.assertEqual(incident.status, "acknowledged")
        resolved = client.patch(incident_url, {"action": "resolve", "resolution_note": "Contrôle terminé."}, format="json")
        self.assertEqual(resolved.status_code, 200)
        incident.refresh_from_db()
        self.assertEqual(incident.status, "resolved")
        self.assertTrue(AuditEvent.objects.filter(event_type="operations.incident.acknowledged", actor=user).exists())
        self.assertTrue(AuditEvent.objects.filter(event_type="operations.incident.resolved", actor=user).exists())

    @override_settings(ECARNET_MONITOR_WEBHOOK_SECRET="test-webhook-secret")
    def test_signed_monitoring_webhook_opens_and_resolves_incident(self):
        payload = {"incident_key": "api:render-500", "action": "open", "severity": "major", "category": "api", "summary": "Taux 5xx trop élevé."}
        body = json.dumps(payload).encode()
        signature = hmac.new(b"test-webhook-secret", body, hashlib.sha256).hexdigest()
        client = APIClient()
        response = client.post("/api/v1/identity/monitoring/webhook/", body, content_type="application/json", HTTP_X_ECARNET_MONITOR_SIGNATURE=f"sha256={signature}")
        self.assertEqual(response.status_code, 200)
        incident = OperationalIncident.objects.get(incident_key="api:render-500")
        self.assertEqual(incident.status, "open")
        payload["action"] = "resolve"
        body = json.dumps(payload).encode()
        signature = hmac.new(b"test-webhook-secret", body, hashlib.sha256).hexdigest()
        response = client.post("/api/v1/identity/monitoring/webhook/", body, content_type="application/json", HTTP_X_ECARNET_MONITOR_SIGNATURE=f"sha256={signature}")
        self.assertEqual(response.status_code, 200)
        incident.refresh_from_db()
        self.assertEqual(incident.status, "resolved")

    def test_unsigned_monitoring_webhook_is_rejected(self):
        response = APIClient().post("/api/v1/identity/monitoring/webhook/", {"incident_key": "bad", "summary": "bad"}, format="json")
        self.assertEqual(response.status_code, 401)

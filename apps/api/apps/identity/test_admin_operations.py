import json
import time
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from .models import OperationalIncident
from .monitoring_webhook import MonitoringWebhookView, monitoring_signature
from .throttles import IpScopedThrottle

REAL_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "monitoring-webhook-tests"}}
WEBHOOK_URL = "/api/v1/identity/monitoring/webhook/"
SECRET = "test-webhook-secret"


def signed_post(client, payload, *, timestamp=None, secret=SECRET, raw_body=None):
    """Envoie un événement signé comme le fera le script d'exploitation (horodatage + corps)."""
    body = raw_body if raw_body is not None else json.dumps(payload).encode()
    ts = str(int(time.time()) if timestamp is None else timestamp)
    return client.post(
        WEBHOOK_URL, body, content_type="application/json",
        HTTP_X_ECARNET_MONITOR_TIMESTAMP=ts,
        HTTP_X_ECARNET_MONITOR_SIGNATURE=f"sha256={monitoring_signature(secret, ts, body)}",
    )

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

    # ---- Liste d'exploitation : fermée par défaut hors développement local
    def test_empty_allowlist_denies_every_superadmin_outside_debug(self):
        user = get_user_model().objects.create_superuser(username="root@example.test", email="root@example.test", password="Test-password-2026!")
        client = APIClient()
        client.force_authenticate(user)
        with override_settings(ECARNET_OPERATIONS_ADMIN_EMAILS=(), DEBUG=False):
            self.assertEqual(client.get(self.url).status_code, 403)

    def test_empty_allowlist_stays_open_for_local_debug_only(self):
        user = get_user_model().objects.create_superuser(username="dev@example.test", email="dev@example.test", password="Test-password-2026!")
        client = APIClient()
        client.force_authenticate(user)
        with override_settings(ECARNET_OPERATIONS_ADMIN_EMAILS=(), DEBUG=True):
            self.assertEqual(client.get(self.url).status_code, 200)

    # ---- Étiquette d'environnement
    @override_settings(ECARNET_OPERATIONS_ADMIN_EMAILS=("ops@example.test",), ECARNET_ENVIRONMENT="staging")
    def test_environment_label_comes_from_configuration(self):
        user = get_user_model().objects.create_superuser(username="env@example.test", email="ops@example.test", password="Test-password-2026!")
        client = APIClient()
        client.force_authenticate(user)
        self.assertEqual(client.get(self.url).data["data"]["environment"], "staging")
        with override_settings(ECARNET_ENVIRONMENT="", DEBUG=False):
            self.assertEqual(client.get(self.url).data["data"]["environment"], "production")

    # ---- Incidents : un incident résolu ne se rouvre pas, répéter « acquitter » est sans effet, le journal dit lequel
    @override_settings(ECARNET_OPERATIONS_ADMIN_EMAILS=("ops@example.test",))
    def test_resolved_incident_cannot_be_acknowledged_or_resolved_again(self):
        user = get_user_model().objects.create_superuser(username="guard@example.test", email="ops@example.test", password="Test-password-2026!")
        incident = OperationalIncident.objects.create(incident_key="db:slow", severity="major", category="database", summary="Base lente.")
        client = APIClient()
        client.force_authenticate(user)
        url = f"/api/v1/identity/admin/operations/incidents/{incident.id}/"
        self.assertEqual(client.patch(url, {"action": "resolve", "resolution_note": "Réglé."}, format="json").status_code, 200)
        for action in ("acknowledge", "resolve"):
            self.assertEqual(client.patch(url, {"action": action}, format="json").status_code, 409)
        incident.refresh_from_db()
        self.assertEqual(incident.status, "resolved")
        self.assertEqual(AuditEvent.objects.filter(event_type__startswith="operations.incident.").count(), 1)

    @override_settings(ECARNET_OPERATIONS_ADMIN_EMAILS=("ops@example.test",))
    def test_acknowledging_twice_is_idempotent_and_the_audit_names_the_incident(self):
        user = get_user_model().objects.create_superuser(username="twice@example.test", email="ops@example.test", password="Test-password-2026!")
        incident = OperationalIncident.objects.create(incident_key="api:slow", severity="warning", category="api", summary="API lente.")
        client = APIClient()
        client.force_authenticate(user)
        url = f"/api/v1/identity/admin/operations/incidents/{incident.id}/"
        self.assertEqual(client.patch(url, {"action": "acknowledge"}, format="json").status_code, 200)
        self.assertEqual(client.patch(url, {"action": "acknowledge"}, format="json").status_code, 200)
        events = AuditEvent.objects.filter(event_type="operations.incident.acknowledged")
        self.assertEqual(events.count(), 1)
        self.assertEqual(events.get().metadata.get("incident_key"), "api:slow")

    # ---- Webhook de monitoring : signature avec horodatage
    @override_settings(ECARNET_MONITOR_WEBHOOK_SECRET=SECRET)
    def test_signed_monitoring_webhook_opens_and_resolves_incident(self):
        payload = {"incident_key": "api:render-500", "action": "open", "severity": "major", "category": "api", "summary": "Taux 5xx trop élevé."}
        client = APIClient()
        self.assertEqual(signed_post(client, payload).status_code, 200)
        incident = OperationalIncident.objects.get(incident_key="api:render-500")
        self.assertEqual(incident.status, "open")
        self.assertEqual(signed_post(client, {**payload, "action": "resolve"}).status_code, 200)
        incident.refresh_from_db()
        self.assertEqual(incident.status, "resolved")
        events = AuditEvent.objects.filter(actor__isnull=True, actor_role="monitoring")
        self.assertEqual(sorted(events.values_list("event_type", flat=True)), ["operations.incident.external_opened", "operations.incident.external_resolved"])
        self.assertEqual(events.first().metadata.get("incident_key"), "api:render-500")

    def test_unsigned_monitoring_webhook_is_rejected(self):
        response = APIClient().post(WEBHOOK_URL, {"incident_key": "bad", "summary": "bad"}, format="json")
        self.assertEqual(response.status_code, 401)

    @override_settings(ECARNET_MONITOR_WEBHOOK_SECRET=SECRET)
    def test_webhook_without_timestamp_or_with_old_format_is_rejected(self):
        payload = {"incident_key": "api:old", "summary": "Ancien format."}
        body = json.dumps(payload).encode()
        import hashlib, hmac
        old_signature = hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
        response = APIClient().post(WEBHOOK_URL, body, content_type="application/json", HTTP_X_ECARNET_MONITOR_SIGNATURE=f"sha256={old_signature}")
        self.assertEqual(response.status_code, 401)
        self.assertFalse(OperationalIncident.objects.filter(incident_key="api:old").exists())

    @override_settings(ECARNET_MONITOR_WEBHOOK_SECRET=SECRET)
    def test_replayed_or_future_monitoring_events_are_rejected(self):
        payload = {"incident_key": "api:replay", "action": "open", "summary": "Rejeu."}
        client = APIClient()
        for offset in (-(60 * 10), 60 * 10):  # capturé il y a 10 minutes, ou daté du futur
            self.assertEqual(signed_post(client, payload, timestamp=int(time.time()) + offset).status_code, 401)
        self.assertEqual(signed_post(client, payload, timestamp=int(time.time()) - 60).status_code, 200)
        self.assertEqual(signed_post(client, payload, timestamp="not-a-number").status_code, 401)

    @override_settings(ECARNET_MONITOR_WEBHOOK_SECRET=SECRET)
    def test_signature_made_with_another_secret_or_changed_body_is_rejected(self):
        payload = {"incident_key": "api:forged", "action": "open", "summary": "Forgé."}
        client = APIClient()
        self.assertEqual(signed_post(client, payload, secret="autre-secret").status_code, 401)
        body = json.dumps(payload).encode()
        ts = str(int(time.time()))
        good = monitoring_signature(SECRET, ts, body)
        tampered = client.post(WEBHOOK_URL, body.replace(b"Forg", b"Forc"), content_type="application/json", HTTP_X_ECARNET_MONITOR_TIMESTAMP=ts, HTTP_X_ECARNET_MONITOR_SIGNATURE=f"sha256={good}")
        self.assertEqual(tampered.status_code, 401)
        self.assertFalse(OperationalIncident.objects.exists())

    @override_settings(ECARNET_MONITOR_WEBHOOK_SECRET=SECRET)
    def test_resolving_an_unknown_incident_creates_nothing_and_a_repeated_open_is_audited_once(self):
        client = APIClient()
        unknown = signed_post(client, {"incident_key": "api:ghost", "action": "resolve", "summary": "Fantôme."})
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(unknown.data["data"]["status"], "unknown")
        self.assertFalse(OperationalIncident.objects.filter(incident_key="api:ghost").exists())
        opening = {"incident_key": "api:repeat", "action": "open", "severity": "warning", "summary": "Répétition."}
        for _ in range(3):
            self.assertEqual(signed_post(client, opening).status_code, 200)
        self.assertEqual(AuditEvent.objects.filter(event_type="operations.incident.external_opened").count(), 1)
        signed_post(client, {**opening, "severity": "critical"})
        self.assertEqual(AuditEvent.objects.filter(event_type="operations.incident.external_opened").count(), 2)

    @override_settings(ECARNET_MONITOR_WEBHOOK_SECRET=SECRET)
    def test_webhook_payload_must_be_a_json_object(self):
        response = signed_post(APIClient(), None, raw_body=b"[1, 2, 3]")
        self.assertEqual(response.status_code, 400)

    @override_settings(ECARNET_MONITOR_WEBHOOK_SECRET=SECRET, CACHES=REAL_CACHE)
    def test_monitoring_webhook_is_rate_limited_per_ip_even_with_bad_signatures(self):
        from django.core.cache import cache
        cache.clear()
        client = APIClient()
        with patch.dict(IpScopedThrottle.THROTTLE_RATES, {"monitoring_webhook": "3/hour"}):
            statuses = [client.post(WEBHOOK_URL, {"incident_key": "x", "summary": "x"}, format="json").status_code for _ in range(5)]
        self.assertEqual(statuses, [401, 401, 401, 429, 429])
        cache.clear()

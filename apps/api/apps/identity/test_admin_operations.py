import json
import time
import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from .models import MonitoringWebhookEvent, OperationalIncident
from .monitoring_webhook import MonitoringWebhookView, monitoring_signature
from .throttles import IpScopedThrottle

REAL_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "monitoring-webhook-tests"}}
WEBHOOK_URL = "/api/v1/identity/monitoring/webhook/"
SECRET = "test-webhook-secret"


def signed_post(client, payload, *, timestamp=None, secret=SECRET, raw_body=None, event_id=None):
    """Envoie un événement signé comme le fera le script d'exploitation (horodatage + corps)."""
    body = raw_body if raw_body is not None else json.dumps(payload).encode()
    ts = str(int(time.time()) if timestamp is None else timestamp)
    event_id = event_id or str(uuid.uuid4())
    return client.post(
        WEBHOOK_URL, body, content_type="application/json",
        HTTP_X_ECARNET_MONITOR_TIMESTAMP=ts,
        HTTP_X_ECARNET_MONITOR_EVENT_ID=event_id,
        HTTP_X_ECARNET_MONITOR_SIGNATURE=f"sha256={monitoring_signature(secret, ts, event_id, body)}",
    )

PORTAL = {"ECARNET_OPS_PORTAL_ID": "exploitation", "ECARNET_OPS_PORTAL_SECRET": "un-secret-d-exploitation-assez-long-2026"}


def portal_login(client, identifier="exploitation", secret="un-secret-d-exploitation-assez-long-2026"):
    return client.post("/api/v1/identity/ops/login/", {"identifier": identifier, "secret": secret}, format="json")


@override_settings(CACHES=REAL_CACHE, **PORTAL)
class AdminOperationsTests(TestCase):
    """Surveillance technique : portail SÉPARÉ de la console (identifiant + secret posés dans les variables d'environnement du serveur)."""
    url = "/api/v1/identity/ops/summary/"

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.addCleanup(cache.clear)
        IpScopedThrottle.cache.clear() if hasattr(IpScopedThrottle, "cache") else None

    def opened(self):
        client = APIClient()
        response = portal_login(client)
        self.assertEqual(response.status_code, 200, response.content)
        client.defaults["HTTP_X_OPS_CSRF"] = response.data["data"]["csrf"]
        return client

    def test_summary_requires_a_portal_session(self):
        self.assertEqual(APIClient().get(self.url).status_code, 401)

    def test_a_superadmin_account_gives_no_access_to_the_portal(self):
        user = get_user_model().objects.create_superuser(username="root@example.test", email="root@example.test", password="Test-password-2026!")
        client = APIClient()
        client.force_authenticate(user)
        self.assertEqual(client.get(self.url).status_code, 403)

    def test_login_with_the_environment_secrets_opens_a_safe_summary(self):
        client = self.opened()
        response = client.get(self.url)
        self.assertEqual(response.status_code, 200)
        payload = response.data["data"]
        self.assertIn(payload["status"], {"ok", "warning", "error"})
        for component in ("database", "cache", "media"):
            self.assertIn(component, payload["components"])
        flat = json.dumps(payload).lower()
        for forbidden in ("password", "secret_key", "patient_records", PORTAL["ECARNET_OPS_PORTAL_SECRET"], PORTAL["ECARNET_OPS_PORTAL_ID"]):
            self.assertNotIn(forbidden, flat)
        cookie = client.cookies["ecarnet_ops"]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["path"], "/api/v1/identity/ops/")
        self.assertTrue(AuditEvent.objects.filter(event_type="operations.portal.login", actor__isnull=True).exists())

    def test_login_accepts_each_comma_separated_email_identifier(self):
        with override_settings(ECARNET_OPS_PORTAL_ID=" first@example.test, second@example.test "):
            for email in ("first@example.test", "second@example.test"):
                response = portal_login(APIClient(), email)
                self.assertEqual(response.status_code, 200)

            response = portal_login(APIClient(), "other@example.test")
            self.assertEqual(response.status_code, 401)

    def test_wrong_identifier_or_secret_is_refused_without_saying_which(self):
        for identifier, secret in (("exploitation", "mauvais-secret"), ("autre", "un-secret-d-exploitation-assez-long-2026"), ("", ""), (None, None)):
            response = portal_login(APIClient(), identifier, secret)
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.data["message"], "Identifiant ou secret incorrect.")
        self.assertEqual(AuditEvent.objects.filter(event_type="operations.portal.login_failed").count(), 4)

    def test_portal_stays_closed_until_both_secrets_are_set_and_long_enough(self):
        for overrides in ({"ECARNET_OPS_PORTAL_ID": ""}, {"ECARNET_OPS_PORTAL_SECRET": ""}, {"ECARNET_OPS_PORTAL_SECRET": "trop-court"}):
            with override_settings(**overrides):
                response = portal_login(APIClient())
                self.assertEqual((response.status_code, response.data["code"]), (503, "not_configured"))

    def test_changing_the_secret_kills_open_sessions(self):
        client = self.opened()
        self.assertEqual(client.get(self.url).status_code, 200)
        with override_settings(ECARNET_OPS_PORTAL_SECRET="un-autre-secret-d-exploitation-2026-xx"):
            self.assertEqual(client.get(self.url).status_code, 401)

    def test_session_expires(self):
        client = self.opened()
        with override_settings(ECARNET_OPS_PORTAL_SESSION_SECONDS=300), patch("django.core.signing.time.time", return_value=time.time() + 400):
            self.assertEqual(client.get(self.url).status_code, 401)

    def test_too_many_failures_lock_the_portal_even_for_the_right_secret(self):
        from .ops_portal import LOCK_LIMIT
        for index in range(LOCK_LIMIT):  # attaque répartie : une adresse IP différente à chaque essai
            portal_login(APIClient(REMOTE_ADDR=f"10.1.{index // 200}.{index % 200 + 1}"), "exploitation", "mauvais-secret")
        locked = portal_login(APIClient(REMOTE_ADDR="10.9.9.9"))
        self.assertEqual((locked.status_code, locked.data["code"]), (429, "locked"))

    def test_one_address_is_throttled_after_a_few_attempts(self):
        client = APIClient(REMOTE_ADDR="10.7.7.7")
        statuses = [portal_login(client, "exploitation", "mauvais-secret").status_code for _ in range(8)]
        self.assertEqual(statuses[:6], [401] * 6)
        self.assertEqual(statuses[6], 429)

    def test_logout_clears_the_cookie(self):
        client = self.opened()
        self.assertEqual(client.post("/api/v1/identity/ops/logout/", {}, format="json").status_code, 200)
        self.assertEqual(client.cookies["ecarnet_ops"].value, "")

    def test_changes_need_the_security_header(self):
        incident = OperationalIncident.objects.create(incident_key="api:csrf", severity="warning", category="api", summary="Test.")
        url = f"/api/v1/identity/ops/incidents/{incident.id}/"
        client = self.opened()
        client.defaults.pop("HTTP_X_OPS_CSRF")
        self.assertEqual(client.patch(url, {"action": "acknowledge"}, format="json").status_code, 403)
        client.defaults["HTTP_X_OPS_CSRF"] = "jeton-invente"
        self.assertEqual(client.patch(url, {"action": "acknowledge"}, format="json").status_code, 403)
        incident.refresh_from_db()
        self.assertEqual(incident.status, "open")

    def test_portal_can_acknowledge_and_resolve_incident(self):
        incident = OperationalIncident.objects.create(incident_key="api:test-500", severity="major", category="api", summary="Taux d’erreur de test élevé.")
        client = self.opened()
        url = f"/api/v1/identity/ops/incidents/{incident.id}/"
        self.assertEqual(client.patch(url, {"action": "acknowledge"}, format="json").status_code, 200)
        incident.refresh_from_db()
        self.assertEqual(incident.status, "acknowledged")
        self.assertEqual(client.patch(url, {"action": "resolve", "resolution_note": "Contrôle terminé."}, format="json").status_code, 200)
        incident.refresh_from_db()
        self.assertEqual(incident.status, "resolved")
        self.assertTrue(AuditEvent.objects.filter(event_type="operations.incident.acknowledged", actor__isnull=True, actor_role="ops_portal").exists())
        self.assertTrue(AuditEvent.objects.filter(event_type="operations.incident.resolved", actor__isnull=True).exists())

    def test_resolved_incident_cannot_be_acknowledged_or_resolved_again(self):
        incident = OperationalIncident.objects.create(incident_key="db:slow", severity="major", category="database", summary="Base lente.")
        client = self.opened()
        url = f"/api/v1/identity/ops/incidents/{incident.id}/"
        self.assertEqual(client.patch(url, {"action": "resolve", "resolution_note": "Réglé."}, format="json").status_code, 200)
        for action in ("acknowledge", "resolve"):
            self.assertEqual(client.patch(url, {"action": action}, format="json").status_code, 409)
        incident.refresh_from_db()
        self.assertEqual(incident.status, "resolved")
        self.assertEqual(AuditEvent.objects.filter(event_type__startswith="operations.incident.").count(), 1)

    def test_acknowledging_twice_is_idempotent_and_the_audit_names_the_incident(self):
        incident = OperationalIncident.objects.create(incident_key="api:slow", severity="warning", category="api", summary="API lente.")
        client = self.opened()
        url = f"/api/v1/identity/ops/incidents/{incident.id}/"
        self.assertEqual(client.patch(url, {"action": "acknowledge"}, format="json").status_code, 200)
        self.assertEqual(client.patch(url, {"action": "acknowledge"}, format="json").status_code, 200)
        events = AuditEvent.objects.filter(event_type="operations.incident.acknowledged")
        self.assertEqual(events.count(), 1)
        self.assertEqual(events.get().metadata.get("incident_key"), "api:slow")

    def test_environment_label_comes_from_configuration(self):
        client = self.opened()
        with override_settings(ECARNET_ENVIRONMENT="staging"):
            self.assertEqual(client.get(self.url).data["data"]["environment"], "staging")
        with override_settings(ECARNET_ENVIRONMENT="", DEBUG=False):
            self.assertEqual(client.get(self.url).data["data"]["environment"], "production")

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
        event_id = str(uuid.uuid4())
        good = monitoring_signature(SECRET, ts, event_id, body)
        tampered = client.post(WEBHOOK_URL, body.replace(b"Forg", b"Forc"), content_type="application/json", HTTP_X_ECARNET_MONITOR_TIMESTAMP=ts, HTTP_X_ECARNET_MONITOR_EVENT_ID=event_id, HTTP_X_ECARNET_MONITOR_SIGNATURE=f"sha256={good}")
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

    @override_settings(ECARNET_MONITOR_WEBHOOK_SECRET=SECRET)
    def test_replayed_event_is_idempotent_and_two_event_ids_are_distinct(self):
        client = APIClient()
        payload = {"incident_key": "api:idempotent", "action": "open", "severity": "warning", "summary": "Événement rejoué."}
        event_id = str(uuid.uuid4())
        first = signed_post(client, payload, event_id=event_id)
        replay = signed_post(client, {**payload, "severity": "critical"}, event_id=event_id)
        second = signed_post(client, {**payload, "severity": "critical"})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(replay.status_code, 200)
        self.assertTrue(replay.data["data"]["already_received"])
        self.assertEqual(second.status_code, 200)
        self.assertEqual(MonitoringWebhookEvent.objects.count(), 2)
        incident = OperationalIncident.objects.get(incident_key="api:idempotent")
        self.assertEqual(incident.severity, "critical")

    @override_settings(ECARNET_MONITOR_WEBHOOK_SECRET=SECRET, CACHES=REAL_CACHE)
    def test_monitoring_webhook_is_rate_limited_per_ip_even_with_bad_signatures(self):
        from django.core.cache import cache
        cache.clear()
        client = APIClient()
        with patch.dict(IpScopedThrottle.THROTTLE_RATES, {"monitoring_webhook": "3/hour"}):
            statuses = [client.post(WEBHOOK_URL, {"incident_key": "x", "summary": "x"}, format="json").status_code for _ in range(5)]
        self.assertEqual(statuses, [401, 401, 401, 429, 429])
        cache.clear()

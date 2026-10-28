import json
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.patients.models import PatientProfile
from . import push
from .models import PushSubscription
from .notifications import notify_patient

User = get_user_model()
SUBS_URL = "/api/v1/patient/care/push/subscriptions/"
KEY_URL = "/api/v1/patient/care/push/vapid-key/"
ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123"

VAPID = override_settings(
    ECARNET_VAPID_PUBLIC_KEY="BPubKey",
    ECARNET_VAPID_PRIVATE_KEY="PrivKey",
    ECARNET_VAPID_SUBJECT="mailto:ops@example.test",
)


def payload(endpoint=ENDPOINT):
    return {"subscription": {"endpoint": endpoint, "keys": {"p256dh": "BP256", "auth": "authsecret"}}}


class PushSubscriptionApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="push-user", password="local-test-password")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_register_requires_auth(self):
        response = APIClient().post(SUBS_URL, payload(), format="json")
        self.assertEqual(response.status_code, 403)

    def test_register_and_reactivate(self):
        self.assertEqual(self.client.post(SUBS_URL, payload(), format="json").status_code, 200)
        sub = PushSubscription.objects.get(user=self.user)
        PushSubscription.objects.filter(pk=sub.pk).update(active=False)
        self.client.post(SUBS_URL, payload(), format="json")
        sub.refresh_from_db()
        self.assertTrue(sub.active)

    def test_rejects_endpoints_outside_known_push_services(self):
        for bad in (
            "http://fcm.googleapis.com/fcm/send/abc",          # pas https
            "https://127.0.0.1/hook",                           # SSRF vers la machine
            "https://169.254.169.254/latest/meta-data",         # SSRF métadonnées cloud
            "https://evil.example/fcm.googleapis.com",          # domaine étranger
            "https://fcm.googleapis.com.evil.example/x",        # faux sous-domaine
            "https://user:pass@fcm.googleapis.com/x",           # identifiants dans l'URL
            "https://fcm.googleapis.com:8443/x",                # port non standard
        ):
            with self.subTest(endpoint=bad):
                response = self.client.post(SUBS_URL, payload(bad), format="json")
                self.assertEqual(response.status_code, 400)
        self.assertEqual(PushSubscription.objects.count(), 0)

    def test_rejects_malformed_payloads(self):
        for bad in ({}, {"subscription": "x"}, {"subscription": {"endpoint": ENDPOINT}}, {"subscription": {"endpoint": ENDPOINT, "keys": "x"}}):
            with self.subTest(body=bad):
                self.assertEqual(self.client.post(SUBS_URL, bad, format="json").status_code, 400)

    def test_endpoint_moves_to_the_logged_in_user(self):
        other = User.objects.create_user(username="push-other", password="local-test-password")
        PushSubscription.objects.create(user=other, endpoint=ENDPOINT, p256dh="old", auth="old")
        self.client.post(SUBS_URL, payload(), format="json")
        self.assertEqual(PushSubscription.objects.filter(endpoint=ENDPOINT).count(), 1)
        self.assertEqual(PushSubscription.objects.get(endpoint=ENDPOINT).user, self.user)

    def test_unregister_deletes_only_own_subscription(self):
        self.client.post(SUBS_URL, payload(), format="json")
        other = User.objects.create_user(username="push-other2", password="local-test-password")
        PushSubscription.objects.create(user=other, endpoint="https://fcm.googleapis.com/fcm/send/zzz", p256dh="k", auth="a")
        self.assertEqual(self.client.delete(SUBS_URL, {"endpoint": ENDPOINT}, format="json").status_code, 200)
        self.assertFalse(PushSubscription.objects.filter(endpoint=ENDPOINT).exists())
        self.assertEqual(self.client.delete(SUBS_URL, {"endpoint": "https://fcm.googleapis.com/fcm/send/zzz"}, format="json").status_code, 200)
        self.assertTrue(PushSubscription.objects.filter(user=other).exists())

    def test_subscriptions_are_capped_per_user(self):
        for index in range(12):
            self.client.post(SUBS_URL, payload(f"https://fcm.googleapis.com/fcm/send/{index}"), format="json")
        self.assertEqual(PushSubscription.objects.filter(user=self.user).count(), 10)

    def test_vapid_key_requires_auth_and_reports_disabled_without_keys(self):
        self.assertEqual(APIClient().get(KEY_URL).status_code, 403)
        data = self.client.get(KEY_URL).json()["data"]
        self.assertFalse(data["enabled"])
        self.assertEqual(data["public_key"], "")

    @VAPID
    @mock.patch("apps.care.push.webpush", new=mock.Mock())
    def test_vapid_key_returned_when_enabled(self):
        data = self.client.get(KEY_URL).json()["data"]
        self.assertTrue(data["enabled"])
        self.assertEqual(data["public_key"], "BPubKey")


class BuildPayloadTests(TestCase):
    def test_medication_push_text_is_neutral_by_default(self):
        built = push.build_payload("medication.reminder", "Rappel de prise", "Doliprane — 1 g", data={"notification_id": "n1"})
        self.assertNotIn("Doliprane", json.dumps(built, ensure_ascii=False))
        self.assertEqual(built["title"], "Rappel de prise")
        self.assertEqual(built["data"], {"notification_id": "n1", "kind": "medication.reminder"})

    def test_other_kinds_are_neutral_too(self):
        built = push.build_payload("establishment_record.opened", "Votre dossier a été consulté", "Clinique X · motif : urgence")
        self.assertNotIn("Clinique", json.dumps(built, ensure_ascii=False))

    @override_settings(ECARNET_PUSH_SHOW_DETAILS=True)
    def test_details_only_when_explicitly_enabled(self):
        built = push.build_payload("medication.reminder", "Rappel de prise", "Doliprane — 1 g")
        self.assertEqual(built["body"], "Doliprane — 1 g")


@VAPID
class DeliverTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="push-send", password="local-test-password")

    def _sub(self, endpoint=ENDPOINT):
        return PushSubscription.objects.create(user=self.user, endpoint=endpoint, p256dh="BP256", auth="authsecret")

    @mock.patch("apps.care.push.webpush")
    def test_sends_with_ttl_urgency_and_fresh_claims_per_subscription(self, mock_webpush):
        self._sub(); self._sub("https://updates.push.services.mozilla.com/wpush/v2/xyz")
        built = push.build_payload("medication.reminder", "T", "B")
        self.assertEqual(push.deliver(self.user.pk, built), [])
        first, second = mock_webpush.call_args_list
        self.assertIsNot(first.kwargs["vapid_claims"], second.kwargs["vapid_claims"])
        self.assertEqual(first.kwargs["vapid_claims"], {"sub": "mailto:ops@example.test"})
        self.assertEqual(first.kwargs["headers"], {"Urgency": "high"})
        self.assertEqual(first.kwargs["ttl"], 3600)

    @mock.patch("apps.care.push.webpush")
    def test_dead_subscription_is_deactivated(self, mock_webpush):
        mock_webpush.side_effect = push.WebPushException("gone", response=mock.Mock(status_code=410))
        self._sub()
        self.assertEqual(push.deliver(self.user.pk, push.build_payload("x", "T", "B")), [])
        self.assertFalse(PushSubscription.objects.get().active)

    @mock.patch("apps.care.push.webpush")
    def test_transient_error_keeps_subscription_and_is_counted(self, mock_webpush):
        mock_webpush.side_effect = push.WebPushException("timeout")
        sub = self._sub()
        self.assertEqual(push.deliver(self.user.pk, push.build_payload("x", "T", "B")), [str(sub.pk)])
        self.assertTrue(PushSubscription.objects.get().active)

    @mock.patch("apps.care.push.webpush")
    def test_retry_only_targets_the_failed_subscriptions(self, mock_webpush):
        ok, failed = self._sub(), self._sub("https://updates.push.services.mozilla.com/wpush/v2/xyz")
        push.deliver(self.user.pk, push.build_payload("x", "T", "B"), only=[str(failed.pk)])
        self.assertEqual(mock_webpush.call_count, 1)
        self.assertEqual(mock_webpush.call_args.kwargs["subscription_info"]["endpoint"], failed.endpoint)

    @override_settings(ECARNET_VAPID_PRIVATE_KEY="")
    @mock.patch("apps.care.push.webpush")
    def test_nothing_is_sent_without_vapid_keys(self, mock_webpush):
        self._sub()
        push.deliver(self.user.pk, push.build_payload("x", "T", "B"))
        mock_webpush.assert_not_called()


@VAPID
@mock.patch("apps.care.push.webpush", new=mock.Mock())
class NotifyPatientPushTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="push-patient", password="local-test-password")
        self.profile = PatientProfile.objects.create(user=self.user)

    @mock.patch("apps.care.push._dispatch")
    def test_push_is_sent_after_commit_with_neutral_text(self, dispatch):
        with self.captureOnCommitCallbacks(execute=True):
            notify_patient(self.profile, "medication.reminder", "Rappel de prise", "Doliprane — 1 g")
        dispatch.assert_called_once()
        user_id, sent = dispatch.call_args.args
        self.assertEqual(user_id, self.user.pk)
        self.assertNotIn("Doliprane", json.dumps(sent, ensure_ascii=False))
        self.assertIn("notification_id", sent["data"])

    @mock.patch("apps.care.push._dispatch")
    def test_no_push_before_commit(self, dispatch):
        with self.captureOnCommitCallbacks(execute=False):
            notify_patient(self.profile, "notice", "Info", "Texte")
        dispatch.assert_not_called()

    @mock.patch("apps.care.push._dispatch")
    def test_coalesced_event_does_not_push_twice(self, dispatch):
        with self.captureOnCommitCallbacks(execute=True):
            notify_patient(self.profile, "notice", "Info", "Texte", coalesce_key="same")
            notify_patient(self.profile, "notice", "Info", "Texte", coalesce_key="same")
        self.assertEqual(dispatch.call_count, 1)

    @mock.patch("apps.care.push._dispatch")
    def test_patient_without_account_is_skipped(self, dispatch):
        with self.captureOnCommitCallbacks(execute=True):
            notify_patient(PatientProfile.objects.create(), "notice", "Info", "Texte")
        dispatch.assert_not_called()

    @mock.patch("apps.care.push._dispatch", side_effect=RuntimeError("boom"))
    def test_push_failure_never_breaks_the_notification(self, _dispatch):
        with self.captureOnCommitCallbacks(execute=True):
            notification = notify_patient(self.profile, "notice", "Info", "Texte")
        self.assertIsNotNone(notification.pk)

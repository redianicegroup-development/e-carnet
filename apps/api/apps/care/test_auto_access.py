"""Règle du 08/11/2026 : le scan du QR vaut accord (accès ouvert tout de suite, 2 h) et un seul professionnel peut être connecté à la fois,
comme une connexion Bluetooth. Boîte de notifications du patient : pouls léger, lecture groupée, effacement."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.identity.models import AccountProfile
from apps.patients.models import PatientProfile
from .models import AccessGrant, Consultation, PatientAccessQrToken, PatientNotification
from .services import ANOTHER_PROFESSIONAL_CONNECTED_MESSAGE, create_patient_qr_token
from .tests import make_clinic_doctor, make_grant

User = get_user_model()
GRANTS = "/api/v1/patient/care/professional/access-grants/"
PATIENT_GRANTS = "/api/v1/patient/care/access-grants/"
NOTIFICATIONS = "/api/v1/patient/care/notifications/"


class QrScanOpensAccessTests(TestCase):
    def setUp(self):
        self.patient_user = User.objects.create_user(username="auto-patient", password="local-test-password", first_name="Awa", last_name="Kone")
        self.patient = PatientProfile.objects.create(user=self.patient_user)
        self.doctor_a, self.profile_a, self.establishment_a = make_clinic_doctor(self.patient_user, "auto-a")
        self.doctor_b, self.profile_b, self.establishment_b = make_clinic_doctor(self.patient_user, "auto-b")
        self.client_a, self.client_b, self.patient_client = APIClient(), APIClient(), APIClient()
        self.client_a.force_authenticate(self.doctor_a)
        self.client_b.force_authenticate(self.doctor_b)
        self.patient_client.force_authenticate(self.patient_user)

    def scan(self, client, scope=("preconsultation", "declarations", "documents")):
        return client.post(GRANTS, {"qr_token": create_patient_qr_token(patient=self.patient), "scope": list(scope)}, format="json")

    def test_scan_opens_the_access_for_two_hours_without_any_patient_decision(self):
        response = self.scan(self.client_a)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["data"]["status"], "active")
        grant = AccessGrant.objects.get(pk=response.data["data"]["id"])
        self.assertEqual(grant.expires_at - grant.starts_at, timedelta(hours=2))
        self.assertIsNotNone(PatientAccessQrToken.objects.get(patient=self.patient).consumed_at)
        # Le professionnel lit tout de suite la pré-consultation : aucune acceptation n'est attendue.
        self.assertEqual(self.client_a.get(f"{GRANTS}{grant.id}/encounters/").status_code, 200)

    def test_scan_is_audited_as_opened_by_qr_scan_and_notifies_the_patient(self):
        grant_id = self.scan(self.client_a).data["data"]["id"]
        events = AuditEvent.objects.filter(access_grant_id=grant_id).order_by("created_at")
        self.assertEqual([event.event_type for event in events], ["access_grant.requested", "access_grant.accept"])
        accepted = events[1]
        self.assertEqual(accepted.metadata["method"], "qr_scan")
        self.assertEqual(accepted.metadata["access_duration_minutes"], 120)
        self.assertEqual(accepted.actor, self.doctor_a)
        notification = PatientNotification.objects.get(patient=self.patient)
        self.assertEqual(notification.kind, "access.opened")
        self.assertIn("a scanné votre QR", notification.body)

    def test_a_second_professional_cannot_connect_while_the_first_is_connected(self):
        self.assertEqual(self.scan(self.client_a).status_code, 201)
        raw = create_patient_qr_token(patient=self.patient)
        blocked = self.client_b.post(GRANTS, {"qr_token": raw, "scope": ["preconsultation"]}, format="json")
        self.assertEqual(blocked.status_code, 400)
        self.assertEqual(blocked.data["message"], ANOTHER_PROFESSIONAL_CONNECTED_MESSAGE)
        # Le QR n'est pas brûlé : dès que la connexion en cours se termine, ce même QR fonctionne.
        self.assertIsNone(PatientAccessQrToken.objects.get(patient=self.patient, token_hash=PatientAccessQrToken.digest(raw)).consumed_at)
        self.assertEqual(AccessGrant.objects.filter(patient=self.patient, status="active").count(), 1)

    def test_the_patient_can_free_the_connection_by_revoking(self):
        first = self.scan(self.client_a).data["data"]["id"]
        self.assertEqual(self.patient_client.post(f"{PATIENT_GRANTS}{first}/revoke/").status_code, 200)
        self.assertEqual(self.scan(self.client_b).status_code, 201)

    def test_the_professional_can_end_their_own_access_and_the_patient_is_told(self):
        grant_id = self.scan(self.client_a).data["data"]["id"]
        # Un confrère ne peut pas terminer l'accès d'un autre.
        self.assertEqual(self.client_b.post(f"{GRANTS}{grant_id}/end/").status_code, 404)
        ended = self.client_a.post(f"{GRANTS}{grant_id}/end/")
        self.assertEqual(ended.status_code, 200)
        self.assertEqual(ended.data["data"]["status"], "expired")
        self.assertEqual(self.client_a.get(f"{GRANTS}{grant_id}/encounters/").status_code, 403)
        self.assertTrue(AuditEvent.objects.filter(access_grant_id=grant_id, event_type="access_grant.ended").exists())
        self.assertTrue(PatientNotification.objects.filter(patient=self.patient, kind="access.ended").exists())
        # Déjà terminé : on ne le termine pas deux fois.
        self.assertEqual(self.client_a.post(f"{GRANTS}{grant_id}/end/").status_code, 409)
        self.assertEqual(self.scan(self.client_b).status_code, 201)

    def test_an_expired_connection_no_longer_blocks_anyone(self):
        grant = make_grant(self.patient, self.profile_a, self.establishment_a, ["preconsultation"], expires_in=timedelta(hours=1))
        AccessGrant.objects.filter(pk=grant.pk).update(expires_at=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self.scan(self.client_b).status_code, 201)
        grant.refresh_from_db()
        self.assertEqual(grant.status, "expired")

    def test_the_same_professional_scanning_again_is_told_they_are_already_connected(self):
        self.assertEqual(self.scan(self.client_a).status_code, 201)
        again = self.scan(self.client_a)
        self.assertEqual(again.status_code, 400)
        self.assertIn("déjà connecté", again.data["message"])

    def test_a_wider_scope_still_waits_for_the_patient_and_respects_the_single_connection(self):
        self.assertEqual(self.scan(self.client_a).status_code, 201)
        pending = self.scan(self.client_b, scope=("preconsultation", "consultations"))
        self.assertEqual(pending.status_code, 201)
        self.assertEqual(pending.data["data"]["status"], "pending")
        # Accepter la demande de B reviendrait à connecter deux professionnels : refusé tant que A est connecté.
        blocked = self.patient_client.post(f"{PATIENT_GRANTS}{pending.data['data']['id']}/accept/")
        self.assertEqual(blocked.status_code, 409)
        self.assertEqual(blocked.data["message"], ANOTHER_PROFESSIONAL_CONNECTED_MESSAGE)
        first = AccessGrant.objects.get(patient=self.patient, status="active")
        self.assertEqual(self.patient_client.post(f"{PATIENT_GRANTS}{first.id}/revoke/").status_code, 200)
        self.assertEqual(self.patient_client.post(f"{PATIENT_GRANTS}{pending.data['data']['id']}/accept/").status_code, 200)

    def test_a_refusal_never_blocks_a_qr_the_patient_presents_themselves(self):
        wide = self.scan(self.client_a, scope=("preconsultation", "consultations")).data["data"]["id"]
        self.assertEqual(self.patient_client.post(f"{PATIENT_GRANTS}{wide}/refuse/").status_code, 200)
        self.assertEqual(self.scan(self.client_a).status_code, 201)


class AccessPayloadsShowWhoTests(TestCase):
    """Le patient reconnaît le professionnel (photo, fonction), le professionnel reconnaît le patient (nom, photo)."""

    def setUp(self):
        self.patient_user = User.objects.create_user(username="who-patient", password="local-test-password", first_name="Awa", last_name="Kone")
        self.patient = PatientProfile.objects.create(user=self.patient_user, first_name="Awa", last_name="Kone")
        AccountProfile.objects.create(user=self.patient_user, avatar_url="https://res.cloudinary.example/awa.jpg")
        self.doctor, self.profile, self.establishment = make_clinic_doctor(self.patient_user, "who")
        AccountProfile.objects.create(user=self.doctor, avatar_url="https://res.cloudinary.example/docteur.jpg")
        self.profile.specialty = "Pédiatrie"
        self.profile.save(update_fields=("specialty", "updated_at"))
        self.client_pro, self.client_patient = APIClient(), APIClient()
        self.client_pro.force_authenticate(self.doctor)
        self.client_patient.force_authenticate(self.patient_user)
        self.client_pro.post(GRANTS, {"qr_token": create_patient_qr_token(patient=self.patient), "scope": ["preconsultation"]}, format="json")

    def test_the_patient_sees_the_professional_photo_and_role_in_their_requests(self):
        listed = self.client_patient.get(PATIENT_GRANTS).data["data"]
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["professional_avatar"], "https://res.cloudinary.example/docteur.jpg")
        self.assertEqual(listed[0]["professional_title"], "Médecin · Pédiatrie")
        self.assertIn("establishment_logo", listed[0])

    def test_the_audit_journal_groups_events_by_professional_and_by_access(self):
        events = self.client_patient.get("/api/v1/patient/care/access-audit/").data["data"]
        self.assertTrue(events)
        for event in events:
            self.assertEqual(event["professional_id"], str(self.profile.id))
            self.assertEqual(event["professional_avatar"], "https://res.cloudinary.example/docteur.jpg")
            self.assertTrue(event["access_grant_id"])
        accept = next(event for event in events if event["action"] == "accept")
        self.assertEqual(accept["method"], "qr_scan")

    def test_the_professional_sees_the_patient_name_and_photo_on_each_signed_consultation(self):
        Consultation.objects.create(patient=self.patient, professional=self.profile, establishment=self.establishment, professional_name="Docteur", facility_label=self.establishment.name, reason="Fièvre", validated_at=timezone.now())
        rows = self.client_pro.get("/api/v1/patient/care/professional/consultations/").data["data"]
        self.assertEqual(rows[0]["patient_name"], "Awa Kone")
        self.assertEqual(rows[0]["patient_avatar"], "https://res.cloudinary.example/awa.jpg")


class NotificationInboxTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="notif-patient", password="local-test-password")
        self.patient = PatientProfile.objects.create(user=self.user)
        self.other_user = User.objects.create_user(username="notif-other", password="local-test-password")
        self.other = PatientProfile.objects.create(user=self.other_user)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def make(self, patient=None, **kwargs):
        return PatientNotification.objects.create(patient=patient or self.patient, kind="notice", title="Titre", body="Texte", **kwargs)

    def test_the_pulse_is_a_tiny_summary_that_changes_with_every_event(self):
        empty = self.client.get(NOTIFICATIONS + "pulse/")
        self.assertEqual(empty.status_code, 200)
        self.assertEqual(empty["Cache-Control"], "private, no-store")
        self.assertEqual(empty.data["data"], {"unread_count": 0, "total_count": 0, "latest_at": None})
        first = self.make()
        self.make(read_at=timezone.now())
        self.make(patient=self.other)
        pulse = self.client.get(NOTIFICATIONS + "pulse/").data["data"]
        self.assertEqual((pulse["unread_count"], pulse["total_count"]), (1, 2))
        self.assertIsNotNone(pulse["latest_at"])
        self.client.patch(f"{NOTIFICATIONS}{first.id}/read/", {}, format="json")
        self.assertEqual(self.client.get(NOTIFICATIONS + "pulse/").data["data"]["unread_count"], 0)

    def test_the_pulse_requires_a_session(self):
        self.assertIn(APIClient().get(NOTIFICATIONS + "pulse/").status_code, (401, 403))

    def test_delete_one_notification_only_touches_the_patient_own_inbox(self):
        mine, theirs = self.make(), self.make(patient=self.other)
        self.assertEqual(self.client.delete(f"{NOTIFICATIONS}{theirs.id}/").status_code, 404)
        self.assertTrue(PatientNotification.objects.filter(pk=theirs.pk).exists())
        self.assertEqual(self.client.delete(f"{NOTIFICATIONS}{mine.id}/").status_code, 200)
        self.assertFalse(PatientNotification.objects.filter(pk=mine.pk).exists())

    def test_mark_everything_as_read(self):
        self.make(); self.make(); self.make(patient=self.other)
        response = self.client.post(NOTIFICATIONS + "read-all/")
        self.assertEqual(response.data["data"]["updated"], 2)
        self.assertEqual(PatientNotification.objects.filter(patient=self.patient, read_at__isnull=True).count(), 0)
        self.assertEqual(PatientNotification.objects.filter(patient=self.other, read_at__isnull=True).count(), 1)

    def test_clear_everything_or_only_what_was_read(self):
        self.make(); self.make(read_at=timezone.now()); keep = self.make(patient=self.other)
        only_read = self.client.post(NOTIFICATIONS + "clear/", {"only_read": True}, format="json")
        self.assertEqual(only_read.data["data"]["deleted"], 1)
        self.assertEqual(PatientNotification.objects.filter(patient=self.patient).count(), 1)
        everything = self.client.post(NOTIFICATIONS + "clear/", {}, format="json")
        self.assertEqual(everything.data["data"]["deleted"], 1)
        self.assertEqual(PatientNotification.objects.filter(patient=self.patient).count(), 0)
        self.assertTrue(PatientNotification.objects.filter(pk=keep.pk).exists())

    def test_clearing_notifications_never_touches_the_access_journal(self):
        doctor, profile, establishment = make_clinic_doctor(self.user, "journal")
        APIClient()
        pro = APIClient()
        pro.force_authenticate(doctor)
        pro.post(GRANTS, {"qr_token": create_patient_qr_token(patient=self.patient), "scope": ["preconsultation"]}, format="json")
        self.assertTrue(PatientNotification.objects.filter(patient=self.patient).exists())
        self.client.post(NOTIFICATIONS + "clear/", {}, format="json")
        self.assertFalse(PatientNotification.objects.filter(patient=self.patient).exists())
        journal = self.client.get("/api/v1/patient/care/access-audit/").data["data"]
        self.assertTrue(any(event["action"] == "accept" for event in journal))

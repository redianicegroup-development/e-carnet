"""Mode invité (16/11/2026) : nom + date de naissance + téléphone retrouvent un dossier, la confirmation visuelle ouvre un accès borné."""
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.patients.models import PatientProfile
from .guest_access import (
    CONFIRMATION_INVALID_MESSAGE,
    GUEST_SCOPES,
    LOOKUP_FAILED_MESSAGE,
    MAX_FAILED_PER_PROFESSIONAL,
    phones_match,
)
from .models import AccessGrant, CareEncounter, GuestLookupAttempt, PatientNotification
from .services import ANOTHER_PROFESSIONAL_CONNECTED_MESSAGE, SELF_ACCESS_MESSAGE, require_scope
from .tests import make_clinic_doctor, make_grant

User = get_user_model()
LOOKUP = "/api/v1/patient/care/professional/guest-access/lookup/"
START = "/api/v1/patient/care/professional/guest-access/start/"
BIRTH = date(1990, 4, 12)
GOOD = {"first_name": "Aya", "last_name": "Koné", "birth_date": "1990-04-12", "phone": "0712345678"}


class GuestAccessTestCase(TestCase):
    def setUp(self):
        self.patient_user = User.objects.create_user(username="patient-guest", password="local-test-password", first_name="Aya", last_name="Koné")
        self.patient = PatientProfile.objects.create(user=self.patient_user, first_name="Aya", last_name="Koné", birth_date=BIRTH, phone="+225 07 12 34 56 78")
        self.doctor, self.profile, self.establishment = make_clinic_doctor(self.patient_user, "guest")
        self.client = APIClient()
        self.client.force_authenticate(self.doctor)

    def lookup(self, **overrides):
        return self.client.post(LOOKUP, {**GOOD, **overrides}, format="json")

    def open_grant(self):
        token = self.lookup().data["data"]["confirmation_token"]
        return self.client.post(START, {"confirmation_token": token}, format="json")

    def other_doctor(self, suffix):
        doctor, profile, establishment = make_clinic_doctor(self.patient_user, suffix)
        client = APIClient()
        client.force_authenticate(doctor)
        return doctor, profile, establishment, client


class GuestLookupTests(GuestAccessTestCase):
    def test_lookup_returns_the_profile_to_compare_and_a_token_without_medical_data(self):
        response = self.lookup()
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["patient"]["first_name"], "Aya")
        self.assertEqual(data["patient"]["last_name"], "Koné")
        self.assertEqual(set(data["patient"]), {"first_name", "last_name", "photo_url"})
        self.assertEqual(data["scope"], GUEST_SCOPES)
        self.assertTrue(data["confirmation_token"])
        self.assertNotIn("patient_id", data)

    def test_accents_case_order_and_phone_format_do_not_block(self):
        self.assertEqual(self.lookup(first_name="aya", last_name="KONE", phone="07 12 34 56 78").status_code, 200)
        self.assertEqual(self.lookup(first_name="Koné", last_name="Aya", phone="+2250712345678").status_code, 200)

    def test_every_failure_gets_the_same_message(self):
        for overrides in ({"phone": "0799999999"}, {"birth_date": "1990-04-13"}, {"last_name": "Traoré"}, {"phone": "123"}):
            response = self.lookup(**overrides)
            self.assertEqual(response.status_code, 400, overrides)
            self.assertEqual(response.data["message"], LOOKUP_FAILED_MESSAGE, overrides)

    def test_two_files_with_the_same_identity_are_never_guessed(self):
        PatientProfile.objects.create(first_name="Aya", last_name="Koné", birth_date=BIRTH, phone="0712345678")
        response = self.lookup()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["message"], LOOKUP_FAILED_MESSAGE)

    def test_same_name_and_birth_date_are_told_apart_by_the_phone(self):
        other = PatientProfile.objects.create(first_name="Aya", last_name="Koné", birth_date=BIRTH, phone="0501020304")
        self.assertEqual(self.lookup(phone="0501020304").status_code, 200)
        self.assertEqual(GuestLookupAttempt.objects.get(succeeded=True).patient, other)

    def test_a_professional_account_is_required(self):
        self.client.force_authenticate(self.patient_user)
        self.assertEqual(self.lookup().status_code, 403)

    def test_own_file_is_refused_like_the_qr(self):
        own = PatientProfile.objects.create(user=self.doctor, first_name="Docteur", last_name="Guest", birth_date=date(1985, 1, 2), phone="0102030405")
        response = self.lookup(first_name="Docteur", last_name="Guest", birth_date="1985-01-02", phone="0102030405")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["code"], "self_access")
        self.assertEqual(response.data["message"], SELF_ACCESS_MESSAGE)
        self.assertFalse(GuestLookupAttempt.objects.filter(patient=own).exists())

    def test_a_simple_lookup_does_not_alert_or_show_in_the_patient_journal(self):
        self.lookup()
        self.assertFalse(AuditEvent.objects.filter(patient=self.patient).exists())
        self.assertFalse(PatientNotification.objects.filter(patient=self.patient).exists())
        self.assertTrue(AuditEvent.objects.filter(event_type="access_grant.guest_lookup_matched", actor=self.doctor).exists())


class GuestLookupRateLimitTests(GuestAccessTestCase):
    def test_failures_lock_the_professional_even_with_the_right_information(self):
        for _ in range(MAX_FAILED_PER_PROFESSIONAL):
            self.assertEqual(self.lookup(phone="0799999999").status_code, 400)
        response = self.lookup()
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data["code"], "guest_lookup_locked")
        self.assertTrue(AuditEvent.objects.filter(event_type="access_grant.guest_lookup_locked", actor=self.doctor).exists())

    def test_lock_expires_with_the_window(self):
        for _ in range(MAX_FAILED_PER_PROFESSIONAL):
            self.lookup(phone="0799999999")
        GuestLookupAttempt.objects.update(created_at=timezone.now() - timedelta(minutes=16))
        self.assertEqual(self.lookup().status_code, 200)

    def test_guesses_spread_over_several_professionals_are_counted_on_the_target(self):
        clients = [self.other_doctor(name)[3] for name in ("a", "b", "c")]
        for client in clients[:2]:
            for _ in range(5):
                client.post(LOOKUP, {**GOOD, "phone": "0799999999"}, format="json")
        response = clients[2].post(LOOKUP, {**GOOD}, format="json")
        self.assertEqual(response.status_code, 429)


class GuestStartTests(GuestAccessTestCase):
    def test_confirmation_opens_a_bounded_guest_grant(self):
        response = self.open_grant()
        self.assertEqual(response.status_code, 201)
        grant = AccessGrant.objects.get(patient=self.patient)
        self.assertEqual(grant.access_mode, "guest")
        self.assertEqual(grant.scope, ["preconsultation"])
        self.assertEqual(grant.status, "active")
        self.assertEqual(grant.professional, self.profile)
        self.assertAlmostEqual((grant.expires_at - grant.starts_at).total_seconds(), 2 * 3600, delta=5)
        self.assertEqual(response.data["data"]["access_mode"], "guest")

    def test_guest_scope_never_opens_history_documents_or_declarations(self):
        self.open_grant()
        grant = AccessGrant.objects.get(patient=self.patient)
        require_scope(grant, "preconsultation")
        for scope in ("documents", "declarations", "consultations", "care_history"):
            with self.assertRaises(PermissionDenied, msg=scope):
                require_scope(grant, scope)

    def test_the_patient_is_alerted_and_the_journal_shows_the_guest_method(self):
        self.open_grant()
        notification = PatientNotification.objects.get(patient=self.patient)
        self.assertEqual(notification.kind, "access.opened")
        events = AuditEvent.objects.filter(patient=self.patient, event_type__in=("access_grant.requested", "access_grant.accept"))
        self.assertEqual(events.count(), 2)
        for event in events:
            self.assertEqual(event.metadata["method"], "guest_identity")
            self.assertEqual(event.actor, self.doctor)

    def test_the_token_is_single_use(self):
        token = self.lookup().data["data"]["confirmation_token"]
        self.assertEqual(self.client.post(START, {"confirmation_token": token}, format="json").status_code, 201)
        again = self.client.post(START, {"confirmation_token": token}, format="json")
        self.assertEqual(again.status_code, 400)
        self.assertEqual(again.data["message"], CONFIRMATION_INVALID_MESSAGE)
        self.assertEqual(AccessGrant.objects.filter(patient=self.patient).count(), 1)

    def test_the_token_only_works_for_the_professional_who_searched(self):
        token = self.lookup().data["data"]["confirmation_token"]
        _, _, _, other_client = self.other_doctor("thief")
        response = other_client.post(START, {"confirmation_token": token}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(AccessGrant.objects.filter(patient=self.patient).exists())

    def test_the_token_expires_after_five_minutes(self):
        token = self.lookup().data["data"]["confirmation_token"]
        GuestLookupAttempt.objects.update(created_at=timezone.now() - timedelta(minutes=6))
        self.assertEqual(self.client.post(START, {"confirmation_token": token}, format="json").status_code, 400)

    def test_a_made_up_token_is_refused(self):
        self.assertEqual(self.client.post(START, {"confirmation_token": "nimporte-quoi"}, format="json").status_code, 400)

    def test_only_one_professional_can_be_connected_at_a_time(self):
        _, other_profile, other_establishment, _ = self.other_doctor("busy")
        make_grant(self.patient, other_profile, other_establishment, ["preconsultation"])
        response = self.open_grant()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["message"], ANOTHER_PROFESSIONAL_CONNECTED_MESSAGE)
        self.assertFalse(AccessGrant.objects.filter(patient=self.patient, access_mode="guest").exists())

    def test_a_second_opening_while_connected_is_refused(self):
        self.assertEqual(self.open_grant().status_code, 201)
        self.assertEqual(self.open_grant().status_code, 400)
        self.assertEqual(AccessGrant.objects.filter(patient=self.patient).count(), 1)


class PhoneMatchingTests(TestCase):
    def test_formats(self):
        self.assertTrue(phones_match("+225 07 12 34 56 78", "0712345678"))
        self.assertTrue(phones_match("00225 0712345678", "07-12-34-56-78"))
        self.assertTrue(phones_match("12345678", "0712345678"))
        self.assertFalse(phones_match("0712345678", "0712345679"))
        self.assertFalse(phones_match("1234567", "1234567"))
        self.assertFalse(phones_match("", "0712345678"))


class GuestPreconsultationTests(GuestAccessTestCase):
    def path(self, grant):
        return f"/api/v1/patient/care/professional/access-grants/{grant.id}/guest-preconsultation/"

    def guest_grant(self):
        self.assertEqual(self.open_grant().status_code, 201)
        return AccessGrant.objects.get(patient=self.patient)

    def test_the_doctor_creates_the_draft_the_patient_could_not_prepare(self):
        grant = self.guest_grant()
        response = self.client.post(self.path(grant), {"reason": "Fièvre depuis deux jours", "observations": "Toux"}, format="json")
        self.assertEqual(response.status_code, 201)
        encounter = CareEncounter.objects.get(patient=self.patient)
        self.assertEqual(encounter.status, "draft")
        self.assertEqual(encounter.establishment, self.establishment)
        self.assertEqual(encounter.reason, "Fièvre depuis deux jours")
        self.assertEqual(encounter.recorded_with_help, grant.professional_name)
        event = AuditEvent.objects.get(event_type="preconsultation.created", patient=self.patient)
        self.assertEqual(event.actor, self.doctor)
        self.assertEqual(event.metadata["method"], "guest_identity")

    def test_an_existing_draft_is_returned_never_duplicated(self):
        CareEncounter.objects.create(patient=self.patient, reason="Préparée par l'infirmier")
        grant = self.guest_grant()
        response = self.client.post(self.path(grant), {"reason": "Autre motif"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["reason"], "Préparée par l'infirmier")
        self.assertEqual(CareEncounter.objects.filter(patient=self.patient).count(), 1)

    def test_a_draft_prepared_for_another_establishment_blocks_the_creation(self):
        _, _, other_establishment, _ = self.other_doctor("elsewhere")
        CareEncounter.objects.create(patient=self.patient, establishment=other_establishment, reason="Ailleurs")
        grant = self.guest_grant()
        response = self.client.post(self.path(grant), {"reason": "Ici"}, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(CareEncounter.objects.filter(patient=self.patient).count(), 1)

    def test_only_a_guest_grant_can_create_a_draft(self):
        qr_grant = make_grant(self.patient, self.profile, self.establishment, ["preconsultation"])
        response = self.client.post(self.path(qr_grant), {"reason": "Motif"}, format="json")
        self.assertEqual(response.status_code, 404)
        self.assertFalse(CareEncounter.objects.filter(patient=self.patient).exists())

    def test_another_professional_cannot_use_the_grant(self):
        grant = self.guest_grant()
        _, _, _, other_client = self.other_doctor("intruder")
        self.assertEqual(other_client.post(self.path(grant), {"reason": "Motif"}, format="json").status_code, 404)

    def test_the_reason_is_required(self):
        grant = self.guest_grant()
        self.assertEqual(self.client.post(self.path(grant), {"reason": ""}, format="json").status_code, 400)

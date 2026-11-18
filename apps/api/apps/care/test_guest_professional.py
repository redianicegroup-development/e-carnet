"""Mode invité, médecin sans téléphone (17/11/2026) : il est retrouvé sur le téléphone du patient, écrit la consultation, qui reste « en attente de
confirmation » jusqu'à ce qu'il la relise et la signe sur son propre téléphone."""
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.patients.models import PatientProfile
from .guest_access import CONFIRMATION_INVALID_MESSAGE, MAX_FAILED_PER_PROFESSIONAL, PROFESSIONAL_LOOKUP_FAILED_MESSAGE
from .models import AccessGrant, CareEncounter, Consultation, GuestConsultation, GuestProfessionalLookupAttempt, PatientNotification
from .services import ANOTHER_PROFESSIONAL_CONNECTED_MESSAGE
from .tests import make_clinic_doctor, make_grant

User = get_user_model()
BASE = "/api/v1/patient/care"
DOCTOR = {"first_name": "Docteur", "last_name": "Remote", "birth_date": "1980-05-05", "phone": "0511223344"}
WRITTEN = {"reason": "Fièvre depuis deux jours", "symptoms": "Toux sèche", "clinical_exam": "Gorge rouge", "diagnosis": "Angine", "conclusion": "Repos", "care_plan": "Boire beaucoup"}


class GuestProfessionalTestCase(TestCase):
    def setUp(self):
        self.patient_user = User.objects.create_user(username="patient-gp", password="local-test-password", first_name="Aya", last_name="Koné")
        self.patient = PatientProfile.objects.create(user=self.patient_user, first_name="Aya", last_name="Koné", birth_date=date(1990, 4, 12), phone="+225 07 12 34 56 78")
        self.doctor, self.profile, self.establishment = make_clinic_doctor(self.patient_user, "remote")
        # Un professionnel garde son identité (naissance, téléphone) sur son propre carnet : c'est elle qui permet de le retrouver.
        PatientProfile.objects.create(user=self.doctor, first_name="Docteur", last_name="Remote", birth_date=date(1980, 5, 5), phone="+225 05 11 22 33 44")
        self.phone = APIClient()  # le téléphone du patient, prêté au médecin
        self.phone.force_authenticate(self.patient_user)
        self.own = APIClient()  # le téléphone du médecin, retrouvé plus tard
        self.own.force_authenticate(self.doctor)

    def lookup(self, client=None, **overrides):
        return (client or self.phone).post(f"{BASE}/guest-professional/lookup/", {**DOCTOR, **overrides}, format="json")

    def start(self):
        token = self.lookup().data["data"]["confirmation_token"]
        return self.phone.post(f"{BASE}/guest-professional/start/", {"confirmation_token": token}, format="json")

    def write(self, grant_id, **overrides):
        return self.phone.post(f"{BASE}/guest-professional/{grant_id}/consultation/", {**WRITTEN, **overrides}, format="json")

    def write_pending(self, **overrides):
        grant_id = self.start().data["data"]["grant_id"]
        response = self.write(grant_id, **overrides)
        self.assertEqual(response.status_code, 201, response.data)
        return GuestConsultation.objects.get(pk=response.data["data"]["id"])

    def confirm(self, item, **overrides):
        payload = {"access_grant_id": str(item.access_grant_id), "source_encounter_id": str(item.source_encounter_id), "guest_consultation_id": str(item.id), "attestation_svg": "<svg></svg>", **item.draft, **overrides}
        return self.own.post(f"{BASE}/professional/consultations/", payload, format="json")


class GuestProfessionalLookupTests(GuestProfessionalTestCase):
    def test_the_doctor_is_found_with_his_own_name_birth_date_and_phone(self):
        response = self.lookup()
        self.assertEqual(response.status_code, 200)
        card = response.data["data"]["professional"]
        self.assertEqual((card["first_name"], card["last_name"], card["title"]), ("Docteur", "Remote", "Médecin"))
        self.assertEqual(card["establishment_name"], self.establishment.name)
        self.assertEqual(response.data["data"]["scope"], ["preconsultation"])
        self.assertEqual(self.lookup(first_name="docteur", last_name="REMOTE", phone="05 11 22 33 44").status_code, 200)

    def test_every_failure_gets_the_same_message(self):
        for overrides in ({"phone": "0799999999"}, {"birth_date": "1980-05-06"}, {"last_name": "Autre"}, {"phone": "12"}):
            response = self.lookup(**overrides)
            self.assertEqual(response.status_code, 400, overrides)
            self.assertEqual(response.data["message"], PROFESSIONAL_LOOKUP_FAILED_MESSAGE, overrides)

    def test_a_patient_who_is_not_a_professional_is_never_found(self):
        response = self.lookup(first_name="Aya", last_name="Koné", birth_date="1990-04-12", phone="0712345678")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["message"], PROFESSIONAL_LOOKUP_FAILED_MESSAGE)

    def test_a_professional_who_is_not_verified_is_not_found(self):
        self.profile.verification_status = "pending"
        self.profile.save(update_fields=("verification_status", "updated_at"))
        self.assertEqual(self.lookup().status_code, 400)

    def test_a_professional_without_an_active_attachment_is_not_found(self):
        self.establishment.status = "suspended"
        self.establishment.save(update_fields=("status",))
        self.assertEqual(self.lookup().status_code, 400)

    def test_your_own_account_cannot_be_the_doctor(self):
        PatientProfile.objects.filter(user=self.doctor).update(first_name="Docteur")
        response = self.lookup(client=self.own)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["code"], "self_access")

    def test_failures_lock_the_patient_phone_even_with_the_right_information(self):
        for _ in range(MAX_FAILED_PER_PROFESSIONAL):
            self.assertEqual(self.lookup(phone="0799999999").status_code, 400)
        response = self.lookup()
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data["code"], "guest_lookup_locked")
        GuestProfessionalLookupAttempt.objects.update(created_at=timezone.now() - timedelta(minutes=16))
        self.assertEqual(self.lookup().status_code, 200)


class GuestProfessionalSessionTests(GuestProfessionalTestCase):
    def test_confirming_the_profile_opens_a_two_hour_session_limited_to_the_consultation(self):
        response = self.start()
        self.assertEqual(response.status_code, 201)
        grant = AccessGrant.objects.get(pk=response.data["data"]["grant_id"])
        self.assertEqual((grant.access_mode, grant.status, grant.scope), ("guest_pro", "active", ["preconsultation"]))
        self.assertEqual((grant.patient, grant.professional), (self.patient, self.profile))
        self.assertAlmostEqual((grant.expires_at - grant.starts_at).total_seconds(), 2 * 3600, delta=5)
        events = AuditEvent.objects.filter(patient=self.patient, event_type__in=("access_grant.requested", "access_grant.accept"))
        self.assertEqual({event.metadata["method"] for event in events}, {"guest_identity"})
        self.assertEqual(events.count(), 2)

    def test_the_token_is_single_use_and_belongs_to_the_patient_who_searched(self):
        token = self.lookup().data["data"]["confirmation_token"]
        stranger_user = User.objects.create_user(username="stranger", password="local-test-password")
        PatientProfile.objects.create(user=stranger_user, first_name="Autre", last_name="Personne", birth_date=date(1992, 1, 1), phone="0102030405")
        stranger = APIClient()
        stranger.force_authenticate(stranger_user)
        self.assertEqual(stranger.post(f"{BASE}/guest-professional/start/", {"confirmation_token": token}, format="json").status_code, 400)
        self.assertEqual(self.phone.post(f"{BASE}/guest-professional/start/", {"confirmation_token": token}, format="json").status_code, 201)
        again = self.phone.post(f"{BASE}/guest-professional/start/", {"confirmation_token": token}, format="json")
        self.assertEqual(again.status_code, 400)
        self.assertEqual(again.data["message"], CONFIRMATION_INVALID_MESSAGE)

    def test_the_token_expires_after_five_minutes(self):
        token = self.lookup().data["data"]["confirmation_token"]
        GuestProfessionalLookupAttempt.objects.update(created_at=timezone.now() - timedelta(minutes=6))
        self.assertEqual(self.phone.post(f"{BASE}/guest-professional/start/", {"confirmation_token": token}, format="json").status_code, 400)

    def test_only_one_professional_can_be_connected_at_a_time(self):
        other, other_profile, other_establishment = make_clinic_doctor(self.patient_user, "busy")
        make_grant(self.patient, other_profile, other_establishment, ["preconsultation"])
        response = self.start()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["message"], ANOTHER_PROFESSIONAL_CONNECTED_MESSAGE)


class GuestConsultationWritingTests(GuestProfessionalTestCase):
    def test_the_consultation_is_saved_unsigned_and_the_session_closes(self):
        item = self.write_pending()
        self.assertEqual(item.status, "awaiting_confirmation")
        self.assertEqual((item.patient, item.professional, item.establishment), (self.patient, self.profile, self.establishment))
        self.assertEqual(item.draft["reason"], "Fièvre depuis deux jours")
        self.assertEqual(item.written_on_account, self.patient_user)
        self.assertAlmostEqual((item.expires_at - item.created_at).total_seconds(), 7 * 86400, delta=5)
        self.assertFalse(Consultation.objects.filter(patient=self.patient).exists(), "rien n'entre dans le carnet signé avant la confirmation")
        self.assertEqual(AccessGrant.objects.get(pk=item.access_grant_id).status, "expired")
        encounter = CareEncounter.objects.get(patient=self.patient)
        self.assertEqual((encounter.status, encounter.recorded_with_help), ("draft", "Docteur Remote"))
        written = AuditEvent.objects.get(event_type="guest_consultation.written", patient=self.patient)
        self.assertEqual((written.actor, written.metadata["status"], written.metadata["method"]), (self.patient_user, "awaiting_confirmation", "guest_identity"))
        self.assertTrue(AuditEvent.objects.filter(event_type="access_grant.ended", patient=self.patient, metadata__reason_code="guest_written").exists())

    def test_an_existing_preconsultation_is_reused(self):
        existing = CareEncounter.objects.create(patient=self.patient, reason="Préparée par l'infirmier")
        item = self.write_pending()
        self.assertEqual(item.source_encounter, existing)
        self.assertEqual(CareEncounter.objects.filter(patient=self.patient).count(), 1)

    def test_only_one_consultation_can_wait_on_a_preconsultation(self):
        self.write_pending()
        grant_id = self.start().data["data"]["grant_id"]
        response = self.write(grant_id)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(GuestConsultation.objects.filter(patient=self.patient).count(), 1)

    def test_an_expired_session_cannot_write(self):
        grant_id = self.start().data["data"]["grant_id"]
        AccessGrant.objects.filter(pk=grant_id).update(expires_at=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self.write(grant_id).status_code, 400)
        self.assertFalse(GuestConsultation.objects.exists())

    def test_nobody_else_can_write_on_this_session(self):
        grant_id = self.start().data["data"]["grant_id"]
        stranger_user = User.objects.create_user(username="stranger2", password="local-test-password")
        PatientProfile.objects.create(user=stranger_user, first_name="Autre", last_name="Personne", birth_date=date(1992, 1, 1), phone="0102030405")
        stranger = APIClient()
        stranger.force_authenticate(stranger_user)
        self.assertEqual(stranger.post(f"{BASE}/guest-professional/{grant_id}/consultation/", WRITTEN, format="json").status_code, 400)

    def test_a_qr_session_cannot_be_used_to_write_a_guest_consultation(self):
        grant = make_grant(self.patient, self.profile, self.establishment, ["preconsultation"])
        self.assertEqual(self.write(grant.id).status_code, 400)

    def test_the_reason_is_required(self):
        grant_id = self.start().data["data"]["grant_id"]
        self.assertEqual(self.write(grant_id, reason="").status_code, 400)

    def test_the_patient_sees_it_as_waiting_and_not_signed(self):
        item = self.write_pending()
        listing = self.phone.get(f"{BASE}/guest-consultations/").data["data"]
        self.assertEqual([entry["id"] for entry in listing], [str(item.id)])
        self.assertEqual(listing[0]["status"], "awaiting_confirmation")
        self.assertEqual(listing[0]["reason"], "Fièvre depuis deux jours")


class GuestConsultationConfirmationTests(GuestProfessionalTestCase):
    def test_the_doctor_finds_what_was_written_in_his_name_with_the_content(self):
        item = self.write_pending()
        listing = self.own.get(f"{BASE}/professional/guest-consultations/").data["data"]
        self.assertEqual(len(listing), 1)
        self.assertEqual((listing[0]["id"], listing[0]["patient_name"]), (str(item.id), "Aya Koné"))
        self.assertEqual(listing[0]["draft"]["diagnosis"], "Angine")
        self.assertEqual(listing[0]["encounter"]["reason"], "Fièvre depuis deux jours")

    def test_confirming_signs_it_and_keeps_both_moments(self):
        item = self.write_pending()
        response = self.confirm(item, diagnosis="Angine virale")
        self.assertEqual(response.status_code, 201, response.data)
        consultation = Consultation.objects.get(patient=self.patient)
        self.assertEqual((consultation.access_mode, consultation.diagnosis, consultation.professional), ("guest_pro", "Angine virale", self.profile))
        self.assertEqual(consultation.drafted_at, item.created_at)
        self.assertGreater(consultation.validated_at, consultation.drafted_at)
        item.refresh_from_db()
        self.assertEqual((item.status, item.consultation), ("confirmed", consultation))
        self.assertEqual(CareEncounter.objects.get(patient=self.patient).status, "closed")
        self.assertEqual(response.data["data"]["access_mode"], "guest_pro")
        self.assertIsNotNone(response.data["data"]["drafted_at"])
        self.assertEqual(self.own.get(f"{BASE}/professional/guest-consultations/").data["data"], [])
        self.assertEqual(self.phone.get(f"{BASE}/guest-consultations/").data["data"], [])

    def test_without_the_waiting_entry_the_closed_session_cannot_sign(self):
        item = self.write_pending()
        response = self.confirm(item, guest_consultation_id=None)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Consultation.objects.filter(patient=self.patient).exists())

    def test_it_cannot_be_confirmed_twice(self):
        item = self.write_pending()
        self.assertEqual(self.confirm(item).status_code, 201)
        self.assertEqual(self.confirm(item).status_code, 400)
        self.assertEqual(Consultation.objects.filter(patient=self.patient).count(), 1)

    def test_only_the_named_doctor_can_confirm(self):
        item = self.write_pending()
        other, _, _ = make_clinic_doctor(self.patient_user, "intruder")
        intruder = APIClient()
        intruder.force_authenticate(other)
        payload = {"access_grant_id": str(item.access_grant_id), "source_encounter_id": str(item.source_encounter_id), "guest_consultation_id": str(item.id), "attestation_svg": "<svg></svg>"}
        self.assertEqual(intruder.post(f"{BASE}/professional/consultations/", payload, format="json").status_code, 400)
        self.assertFalse(Consultation.objects.filter(patient=self.patient).exists())

    def test_the_confirmation_must_match_the_written_consultation(self):
        item = self.write_pending()
        other_encounter = CareEncounter.objects.create(patient=self.patient, reason="Autre", status="closed")
        self.assertEqual(self.confirm(item, source_encounter_id=str(other_encounter.id)).status_code, 400)

    def test_after_the_delay_it_expires_and_is_never_signed(self):
        item = self.write_pending()
        GuestConsultation.objects.filter(pk=item.pk).update(expires_at=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self.confirm(item).status_code, 400)
        self.assertFalse(Consultation.objects.filter(patient=self.patient).exists())
        # Constaté à la lecture : la liste du médecin ne la propose plus, celle du patient la montre « expirée », jamais signée.
        self.assertEqual(self.own.get(f"{BASE}/professional/guest-consultations/").data["data"], [])
        item.refresh_from_db()
        self.assertEqual(item.status, "expired")
        self.assertEqual(self.phone.get(f"{BASE}/guest-consultations/").data["data"][0]["status"], "expired")
        self.assertEqual(self.confirm(item).status_code, 400)

    def test_the_doctor_can_reject_what_he_does_not_recognise(self):
        item = self.write_pending()
        response = self.own.post(f"{BASE}/professional/guest-consultations/{item.id}/reject/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        item.refresh_from_db()
        self.assertEqual(item.status, "rejected")
        self.assertFalse(Consultation.objects.filter(patient=self.patient).exists())
        self.assertEqual(CareEncounter.objects.get(patient=self.patient).status, "draft")
        self.assertTrue(PatientNotification.objects.filter(patient=self.patient, kind="consultation.not_confirmed").exists())
        self.assertTrue(AuditEvent.objects.filter(event_type="guest_consultation.rejected", actor=self.doctor).exists())
        self.assertEqual(self.confirm(item).status_code, 400)

    def test_only_the_named_doctor_can_reject(self):
        item = self.write_pending()
        other, _, _ = make_clinic_doctor(self.patient_user, "intruder2")
        intruder = APIClient()
        intruder.force_authenticate(other)
        self.assertEqual(intruder.post(f"{BASE}/professional/guest-consultations/{item.id}/reject/", {}, format="json").status_code, 400)
        item.refresh_from_db()
        self.assertEqual(item.status, "awaiting_confirmation")

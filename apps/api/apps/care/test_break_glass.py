"""ACS-13 — accès d'urgence « bris de glace » : le cahier des charges, test par test.

Couvre d'abord les quatre tests exigés (sans motif → refus ; au-delà d'1 h → refus ; le patient est notifié ; jamais au-delà du
périmètre d'urgence), puis les garde-fous : drapeau, identification stricte, non-renouvellement, revue a posteriori, abus signalé."""
from datetime import date, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.establishments.models import EstablishmentAdministrator, EstablishmentNotification
from apps.identity.models import OperationalIncident
from apps.patients.models import ClinicalDeclaration, PatientProfile, TrustedContactDelegation
from .break_glass import emergency_summary
from .models import AccessGrant, EmergencyAccessRequest, EmergencyAccessReview, PatientNotification
from .tests import make_clinic_doctor, make_grant

User = get_user_model()
ROOT = "/api/v1/patient/care/professional/emergency-access/"
BIRTH = date(1990, 5, 17)
NOTE = "Patient retrouvé inconscient à l’arrivée, famille injoignable."


def admin_url(establishment_id, suffix=""):
    return f"/api/v1/patient/care/establishment/{establishment_id}/emergency-access/{suffix}"


@override_settings(ECARNET_BREAK_GLASS_ENABLED=True)
class BreakGlassBase(TestCase):
    def setUp(self):
        cache.clear()
        self.patient_user = User.objects.create_user(username="bg-patient", password="local-test-password", first_name="Awa", last_name="Koné")
        self.patient = PatientProfile.objects.create(user=self.patient_user, first_name="Awa", last_name="Koné", birth_date=BIRTH, phone="+2250102030405", address="Rue secrète 12", coverage_number="ASSUR-998")
        for kind, label, details in (
            ("blood_group", "O+", ""), ("allergy", "Pénicilline", "Urticaire"), ("treatment", "Metformine", "500 mg le matin"),
            ("antecedent", "Diabète de type 2", ""), ("emergency_contact", "Mariam Koné", "+2250707070707"), ("city", "Abidjan", ""),
        ):
            ClinicalDeclaration.objects.create(patient=self.patient, kind=kind, label=label, details=details)
        self.doctor, self.profile, self.establishment = make_clinic_doctor(self.patient_user, "bgurgence")
        self.admin_user = User.objects.create_user(username="bg-admin", password="local-test-password", first_name="Admin", last_name="Clinique")
        EstablishmentAdministrator.objects.create(establishment=self.establishment, user=self.admin_user, assigned_by=self.patient_user, status="active")
        self.client = APIClient(); self.client.force_authenticate(self.doctor)
        self.admin_client = APIClient(); self.admin_client.force_authenticate(self.admin_user)

    def payload(self, **overrides):
        data = {"first_name": "Awa", "last_name": "Koné", "birth_date": BIRTH.isoformat(), "reason_category": "unconscious", "reason_note": NOTE}
        data.update(overrides)
        return data

    def open(self, client=None, **overrides):
        return (client or self.client).post(ROOT, self.payload(**overrides), format="json")

    def expire(self, minutes=61):
        """Fait avancer l'horloge du service : les accès sont immuables, on ne modifie jamais leurs dates."""
        return mock.patch("django.utils.timezone.now", return_value=timezone.now() + timedelta(minutes=minutes))


@override_settings(ECARNET_BREAK_GLASS_ENABLED=False)
class BreakGlassFlagTests(TestCase):
    def setUp(self):
        cache.clear()
        self.patient_user = User.objects.create_user(username="bg-flag-patient", password="local-test-password")
        self.doctor, self.profile, self.establishment = make_clinic_doctor(self.patient_user, "bgflag")
        self.client = APIClient(); self.client.force_authenticate(self.doctor)

    def test_disabled_by_default_everywhere(self):
        self.assertEqual(self.client.get(ROOT).status_code, 404)
        self.assertEqual(self.client.post(ROOT, {}, format="json").status_code, 404)
        self.assertEqual(self.client.get(f"{ROOT}00000000-0000-0000-0000-000000000000/").status_code, 404)
        self.assertEqual(self.client.get(admin_url(self.establishment.id)).status_code, 404)
        self.assertEqual(self.client.get(ROOT).data["code"], "break_glass_disabled")
        self.assertEqual(EmergencyAccessRequest.objects.count(), 0)


class BreakGlassOpenTests(BreakGlassBase):
    # ---- Les quatre tests exigés par le cahier des charges
    def test_without_reason_is_refused(self):
        for overrides in ({"reason_category": ""}, {"reason_category": "curiosity"}, {"reason_note": ""}, {"reason_note": "   "}, {"reason_note": "court"}):
            with self.subTest(overrides=overrides):
                response = self.open(**overrides)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data["code"], "reason_required")
        self.assertEqual(EmergencyAccessRequest.objects.count(), 0)
        self.assertFalse(PatientNotification.objects.filter(kind="break_glass.opened").exists())
        # Sans motif, on ne cherche même pas : aucune trace de recherche non plus.
        self.assertFalse(AuditEvent.objects.filter(event_type__startswith="break_glass.").exists())

    def test_beyond_one_hour_is_refused_and_not_renewable(self):
        opened = self.open()
        self.assertEqual(opened.status_code, 201, opened.data)
        item = EmergencyAccessRequest.objects.get()
        self.assertEqual(item.expires_at - item.requested_at, timedelta(hours=1))
        url = f"{ROOT}{item.id}/"
        self.assertEqual(self.client.get(url).status_code, 200)
        with self.expire(61):
            refused = self.client.get(url)
            self.assertEqual(refused.status_code, 403)
            self.assertEqual(refused.data["code"], "expired")
            # Rouvrir tout de suite est refusé aussi : non renouvelable.
            again = self.open()
            self.assertEqual(again.status_code, 409)
            self.assertEqual(again.data["code"], "not_renewable")
        self.assertEqual(EmergencyAccessRequest.objects.count(), 1)
        self.assertTrue(AuditEvent.objects.filter(event_type="break_glass.refused", metadata__reason_code="expired").exists())
        # Au bout de 24 h seulement, une nouvelle urgence peut être déclarée (avec son propre motif, sa propre revue).
        with self.expire(25 * 60):
            self.assertEqual(self.open().status_code, 201)
        self.assertEqual(EmergencyAccessRequest.objects.count(), 2)

    def test_patient_is_notified_immediately(self):
        self.assertEqual(self.open().status_code, 201)
        notice = PatientNotification.objects.get(kind="break_glass.opened")
        self.assertEqual(notice.patient_id, self.patient.id)
        self.assertIn("sans votre accord", notice.body)
        self.assertIn(self.establishment.name, notice.body)
        self.assertLessEqual(len(notice.body), 500)
        event = AuditEvent.objects.get(event_type="break_glass.opened")
        self.assertEqual(event.patient_id, self.patient.id)
        self.assertEqual(event.metadata["severity"], "critical")
        self.assertEqual(event.metadata["reason_category"], "unconscious")
        self.assertEqual(event.metadata["access_duration_minutes"], 60)
        # Le texte libre et l'identité saisie ne sont jamais recopiés dans l'audit.
        self.assertNotIn(NOTE, str(event.metadata))
        self.assertNotIn("Koné", str(event.metadata))

    def test_access_never_exceeds_the_emergency_scope(self):
        response = self.open()
        self.assertEqual(response.status_code, 201)
        summary = response.data["data"]["summary"]
        self.assertEqual(set(summary), {"first_name", "last_name", "blood_group", "allergies", "treatments", "antecedents", "scope", "provenance"})
        self.assertEqual(summary["blood_group"], "O+")
        self.assertEqual(summary["allergies"], [{"label": "Pénicilline", "details": "Urticaire"}])
        self.assertEqual(summary["treatments"], [{"label": "Metformine", "details": "500 mg le matin"}])
        self.assertEqual(summary["antecedents"], [{"label": "Diabète de type 2", "details": ""}])
        flat = str(response.data)
        for forbidden in ("Mariam", "+2250707070707", "+2250102030405", "Rue secrète", "ASSUR-998", "Abidjan"):
            self.assertNotIn(forbidden, flat)
        # Et la relecture ne donne rien de plus.
        item = EmergencyAccessRequest.objects.get()
        again = self.client.get(f"{ROOT}{item.id}/")
        self.assertEqual(set(again.data["data"]["summary"]), set(summary))
        # L'accès d'urgence n'ouvre aucune autre porte : il ne crée aucune autorisation d'accès au carnet.
        self.assertFalse(AccessGrant.objects.exists())

    # ---- Garde-fous
    def test_replaying_the_request_returns_the_same_access_without_extending_it(self):
        first = self.open()
        second = self.open()
        self.assertEqual((first.status_code, second.status_code), (201, 200))
        self.assertEqual(first.data["data"]["access"]["id"], second.data["data"]["access"]["id"])
        self.assertEqual(first.data["data"]["access"]["expires_at"], second.data["data"]["access"]["expires_at"])
        self.assertEqual(EmergencyAccessRequest.objects.count(), 1)
        self.assertEqual(PatientNotification.objects.filter(kind="break_glass.opened").count(), 1)

    @override_settings(ECARNET_BREAK_GLASS_DURATION_MINUTES=600)
    def test_duration_setting_can_only_shorten_the_window(self):
        self.assertEqual(self.open().status_code, 201)
        item = EmergencyAccessRequest.objects.get()
        self.assertEqual(item.expires_at - item.requested_at, timedelta(hours=1))

    @override_settings(ECARNET_BREAK_GLASS_DURATION_MINUTES=15)
    def test_duration_setting_shortens_the_window(self):
        self.assertEqual(self.open().status_code, 201)
        item = EmergencyAccessRequest.objects.get()
        self.assertEqual(item.expires_at - item.requested_at, timedelta(minutes=15))

    def test_patient_is_identified_exactly_and_failures_are_uniform_and_anonymous(self):
        other = User.objects.create_user(username="bg-twin", password="local-test-password")
        PatientProfile.objects.create(user=other, first_name="Awa", last_name="Koné", birth_date=BIRTH)  # homonyme exact : ambigu
        for overrides in ({"birth_date": "1990-05-18"}, {"first_name": "Aïcha"}, {"last_name": "Inconnu"}, {}):  # {} = homonymes → ambigu
            with self.subTest(overrides=overrides):
                response = self.open(**overrides)
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.data["code"], "patient_not_identified")
        # Le téléphone départage les homonymes.
        self.assertEqual(self.open(phone="+225 01 02 03 04 05").status_code, 201)
        failures = AuditEvent.objects.filter(event_type="break_glass.refused", metadata__reason_code="patient_not_identified")
        self.assertEqual(failures.count(), 4)
        for event in failures:
            self.assertIsNone(event.patient_id)
            self.assertNotIn("Koné", str(event.metadata))
            self.assertEqual(event.actor_id, self.doctor.id)

    def test_accents_case_and_hyphens_do_not_block_a_legitimate_lookup(self):
        self.assertEqual(self.open(first_name="  AWA ", last_name="kone").status_code, 201)

    def test_only_verified_attached_professionals_can_invoke(self):
        self.profile.verification_status = "pending"; self.profile.save(update_fields=("verification_status",))
        self.assertEqual(self.open().status_code, 403)
        self.profile.verification_status = "verified"; self.profile.active_establishment = None; self.profile.save(update_fields=("verification_status", "active_establishment"))
        self.assertEqual(self.open().status_code, 403)
        outsider = APIClient(); outsider.force_authenticate(User.objects.create_user(username="bg-not-pro", password="local-test-password"))
        self.assertEqual(self.open(client=outsider).status_code, 403)
        self.assertEqual(EmergencyAccessRequest.objects.count(), 0)

    def test_a_professional_cannot_open_their_own_file(self):
        PatientProfile.objects.create(user=self.doctor, first_name="Docteur", last_name="Bgurgence", birth_date=date(1980, 1, 1))
        response = self.open(first_name="Docteur", last_name="Bgurgence", birth_date="1980-01-01")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["code"], "patient_not_identified")

    def test_no_emergency_access_when_the_patient_already_granted_access(self):
        make_grant(self.patient, self.profile, self.establishment, ["preconsultation"])
        response = self.open()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "consent_available")

    def test_read_is_bound_to_the_invoking_professional_and_their_establishment(self):
        self.assertEqual(self.open().status_code, 201)
        item = EmergencyAccessRequest.objects.get()
        colleague, _, _ = make_clinic_doctor(self.patient_user, "bgautre")
        other = APIClient(); other.force_authenticate(colleague)
        self.assertEqual(other.get(f"{ROOT}{item.id}/").status_code, 404)
        self.assertEqual(self.client.get(ROOT).data["data"]["items"][0]["id"], str(item.id))
        self.assertEqual(other.get(ROOT).data["data"]["items"], [])

    def test_records_are_immutable(self):
        self.open()
        item = EmergencyAccessRequest.objects.get()
        item.reason_note = "modifié"
        with self.assertRaises(TypeError):
            item.save()
        with self.assertRaises(TypeError):
            EmergencyAccessRequest.objects.update(reason_note="x")
        with self.assertRaises(TypeError):
            item.delete()

    def test_database_refuses_an_empty_reason_note(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            EmergencyAccessRequest.objects.create(
                patient=self.patient, professional=self.profile, establishment=self.establishment, professional_name="X", facility_label="Y",
                reason_category="unconscious", reason_note="", expires_at=timezone.now() + timedelta(hours=1), review_due_at=timezone.now() + timedelta(hours=72),
            )

    def test_summary_function_reads_live_declarations(self):
        before = emergency_summary(self.patient)
        ClinicalDeclaration.objects.create(patient=self.patient, kind="allergy", label="Arachide")
        self.assertEqual(len(emergency_summary(self.patient)["allergies"]), len(before["allergies"]) + 1)


class BreakGlassVisibilityTests(BreakGlassBase):
    def test_patient_sees_it_in_the_access_history(self):
        self.open()
        client = APIClient(); client.force_authenticate(self.patient_user)
        events = client.get("/api/v1/patient/care/access-audit/").data["data"]
        opened = [event for event in events if event["event_type"] == "break_glass.opened"]
        self.assertEqual(len(opened), 1)
        self.assertEqual(opened[0]["professional_name"], f"{self.doctor.first_name} {self.doctor.last_name}")
        self.assertEqual(opened[0]["facility_label"], self.establishment.name)
        self.assertEqual(opened[0]["reason_category"], "unconscious")
        self.assertTrue(opened[0]["emergency_access_id"])
        # Les relectures pendant la fenêtre restent dans l'audit, pas dans la liste du patient.
        self.client.get(f"{ROOT}{EmergencyAccessRequest.objects.get().id}/")
        self.assertTrue(AuditEvent.objects.filter(event_type="break_glass.read").exists())
        events = client.get("/api/v1/patient/care/access-audit/").data["data"]
        self.assertFalse([event for event in events if event["event_type"] == "break_glass.read"])

    def _trusted_contact(self):
        contact_user = User.objects.create_user(username="bg-trusted", password="local-test-password", first_name="Mariam")
        contact_profile = PatientProfile.objects.create(user=contact_user, first_name="Mariam", last_name="Proche")
        TrustedContactDelegation.objects.create(
            patient=self.patient, delegate=contact_user, invited_email="mariam@example.test", relationship_label="ami", scopes=["emergency_card"],
            status="active", token_hash="b" * 64, invitation_expires_at=timezone.now() + timedelta(days=1), expires_at=timezone.now() + timedelta(days=30),
        )
        return contact_profile

    @override_settings(ECARNET_TRUSTED_CONTACTS_ENABLED=True)
    def test_active_trusted_contacts_are_notified_when_enabled(self):
        contact = self._trusted_contact()
        self.open()
        notice = PatientNotification.objects.get(kind="break_glass.trusted_contact")
        self.assertEqual(notice.patient_id, contact.id)
        self.assertIn("Awa", notice.body)

    @override_settings(ECARNET_TRUSTED_CONTACTS_ENABLED=False)
    def test_trusted_contacts_are_not_notified_when_the_feature_is_off(self):
        self._trusted_contact()
        self.open()
        self.assertFalse(PatientNotification.objects.filter(kind="break_glass.trusted_contact").exists())
        self.assertTrue(PatientNotification.objects.filter(kind="break_glass.opened").exists())

    def test_establishment_administrators_are_told_but_not_the_invoker(self):
        self.open()
        notice = EstablishmentNotification.objects.get(kind="break_glass.review_due")
        self.assertEqual(notice.recipient_id, self.admin_user.id)
        self.assertEqual(notice.establishment_id, self.establishment.id)


class BreakGlassReviewTests(BreakGlassBase):
    def setUp(self):
        super().setUp()
        self.assertEqual(self.open().status_code, 201)
        self.item = EmergencyAccessRequest.objects.get()
        self.review_url = admin_url(self.establishment.id, f"{self.item.id}/review/")

    def test_list_shows_the_request_without_any_clinical_content(self):
        response = self.admin_client.get(admin_url(self.establishment.id))
        self.assertEqual(response.status_code, 200)
        row = response.data["data"]["items"][0]
        self.assertEqual(row["patient_name"], "Awa Koné")
        self.assertEqual(row["reason_note"], NOTE)
        self.assertEqual(row["review_state"], "pending")
        self.assertFalse(row["can_review"])  # la fenêtre est encore ouverte
        flat = str(response.data)
        for forbidden in ("Pénicilline", "Metformine", "O+", "Diabète"):
            self.assertNotIn(forbidden, flat)
        self.assertEqual((self.item.review_due_at - self.item.requested_at), timedelta(hours=72))

    def test_review_waits_for_the_end_of_the_window(self):
        response = self.admin_client.post(self.review_url, {"outcome": "justified"}, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "still_active")

    def test_justified_review_is_final(self):
        with self.expire(90):
            response = self.admin_client.post(self.review_url, {"outcome": "justified", "note": "Admission aux urgences confirmée."}, format="json")
            self.assertEqual(response.status_code, 201, response.data)
            again = self.admin_client.post(self.review_url, {"outcome": "unjustified", "note": "Finalement non."}, format="json")
            self.assertEqual(again.status_code, 409)
            self.assertEqual(again.data["code"], "already_reviewed")
            self.assertEqual(self.admin_client.get(admin_url(self.establishment.id)).data["data"]["items"][0]["review_state"], "done")
        self.assertEqual(EmergencyAccessReview.objects.get().outcome, "justified")
        self.assertFalse(OperationalIncident.objects.filter(incident_key__startswith="break-glass-abuse:").exists())
        self.assertTrue(AuditEvent.objects.filter(event_type="break_glass.reviewed", metadata__status="justified").exists())

    def test_unjustified_review_needs_a_note_then_flags_the_abuse(self):
        with self.expire(90):
            missing = self.admin_client.post(self.review_url, {"outcome": "unjustified"}, format="json")
            self.assertEqual((missing.status_code, missing.data["code"]), (400, "note_required"))
            done = self.admin_client.post(self.review_url, {"outcome": "unjustified", "note": "Aucune admission ce jour-là."}, format="json")
            self.assertEqual(done.status_code, 201, done.data)
        incident = OperationalIncident.objects.get(incident_key=f"break-glass-abuse:{self.item.id}")
        self.assertEqual((incident.severity, incident.category, incident.status), ("critical", "security", "open"))
        self.assertNotIn("Koné", incident.summary)
        self.assertTrue(AuditEvent.objects.filter(event_type="break_glass.abuse_flagged", patient=self.patient).exists())
        self.assertTrue(PatientNotification.objects.filter(kind="break_glass.abuse_flagged", patient=self.patient).exists())

    def test_invalid_outcome_is_refused(self):
        with self.expire(90):
            self.assertEqual(self.admin_client.post(self.review_url, {"outcome": "maybe"}, format="json").data["code"], "invalid_outcome")

    def test_the_invoking_professional_cannot_review_their_own_access(self):
        EstablishmentAdministrator.objects.create(establishment=self.establishment, user=self.doctor, assigned_by=self.patient_user, status="active")
        with self.expire(90):
            response = self.client.post(self.review_url, {"outcome": "justified"}, format="json")
            self.assertEqual((response.status_code, response.data["code"]), (403, "review_conflict"))
        self.assertEqual(self.client.get(admin_url(self.establishment.id)).data["data"]["items"][0]["is_own"], True)

    def test_only_administrators_of_that_establishment_can_see_and_review(self):
        _, _, other_establishment = make_clinic_doctor(self.patient_user, "bgautre2")
        stranger = User.objects.create_user(username="bg-stranger-admin", password="local-test-password")
        EstablishmentAdministrator.objects.create(establishment=other_establishment, user=stranger, assigned_by=self.patient_user, status="active")
        client = APIClient(); client.force_authenticate(stranger)
        self.assertEqual(client.get(admin_url(self.establishment.id)).status_code, 403)
        with self.expire(90):
            self.assertEqual(client.post(self.review_url, {"outcome": "justified"}, format="json").status_code, 403)
            # Même en se faisant passer pour son propre établissement, l'accès d'un autre reste introuvable.
            cross = client.post(admin_url(other_establishment.id, f"{self.item.id}/review/"), {"outcome": "justified"}, format="json")
            self.assertEqual((cross.status_code, cross.data["code"]), (404, "not_found"))
        self.assertEqual(client.get(admin_url(other_establishment.id)).data["data"]["items"], [])
        self.assertEqual(self.client.get(admin_url(self.establishment.id)).status_code, 403)  # un simple médecin n'est pas administrateur

    def test_overdue_reviews_are_escalated_once(self):
        with self.expire(73 * 60):
            self.assertEqual(self.admin_client.get(admin_url(self.establishment.id)).data["data"]["items"][0]["review_state"], "overdue")
            call_command("review_break_glass_overdue", stdout=mock.MagicMock())
            call_command("review_break_glass_overdue", stdout=mock.MagicMock())
        incident = OperationalIncident.objects.get(incident_key=f"break-glass-overdue:{self.item.id}")
        self.assertEqual((incident.severity, incident.category), ("major", "security"))
        self.assertEqual(AuditEvent.objects.filter(event_type="break_glass.review_overdue").count(), 1)
        self.assertEqual(EstablishmentNotification.objects.filter(kind="break_glass.review_overdue", recipient=self.admin_user).count(), 1)

    def test_reviewed_accesses_are_not_escalated(self):
        with self.expire(90):
            self.admin_client.post(self.review_url, {"outcome": "justified"}, format="json")
        with self.expire(73 * 60):
            call_command("review_break_glass_overdue", stdout=mock.MagicMock())
        self.assertFalse(OperationalIncident.objects.filter(incident_key__startswith="break-glass-overdue:").exists())

    def test_reviews_are_immutable(self):
        with self.expire(90):
            self.admin_client.post(self.review_url, {"outcome": "justified"}, format="json")
        review = EmergencyAccessReview.objects.get()
        review.outcome = "unjustified"
        with self.assertRaises(TypeError):
            review.save()
        with self.assertRaises(TypeError):
            EmergencyAccessReview.objects.update(outcome="unjustified")

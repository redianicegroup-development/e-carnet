"""Un compte professionnel est aussi un patient (deux espaces, un seul compte) : jamais son propre dossier côté professionnel."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.identity.models import AccountContext
from apps.patients.models import PatientProfile
from .models import AccessGrant, PatientAccessQrToken
from .services import SELF_ACCESS_MESSAGE, create_patient_qr_token, is_own_patient_file
from .tests import make_clinic_doctor, make_grant

User = get_user_model()
GRANTS = "/api/v1/patient/care/professional/access-grants/"


class ProfessionalCannotOpenOwnFileTests(TestCase):
    def setUp(self):
        # Le médecin est aussi patient : même utilisateur, un profil patient et un profil professionnel.
        self.doctor, self.profile, self.establishment = make_clinic_doctor(User.objects.create_user(username="creator-self", password="local-test-password"), "self")
        self.own_patient = PatientProfile.objects.create(user=self.doctor)
        AccountContext.objects.get_or_create(user=self.doctor, role="patient", defaults={"is_active": False, "onboarding_completed": True})
        self.colleague, self.colleague_profile, self.colleague_establishment = make_clinic_doctor(self.doctor, "colleague")
        self.client = APIClient()

    def test_own_qr_is_refused_with_a_message_pointing_to_the_patient_space(self):
        raw = create_patient_qr_token(patient=self.own_patient)
        self.client.force_authenticate(self.doctor)
        response = self.client.post(GRANTS, {"qr_token": raw, "scope": ["preconsultation"]}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["code"], "self_access")
        self.assertEqual(response.data["message"], SELF_ACCESS_MESSAGE)
        self.assertIn("espace patient", response.data["message"])
        self.assertFalse(AccessGrant.objects.filter(patient=self.own_patient).exists())

    def test_refusal_is_audited_and_does_not_burn_the_qr(self):
        raw = create_patient_qr_token(patient=self.own_patient)
        self.client.force_authenticate(self.doctor)
        self.client.post(GRANTS, {"qr_token": raw, "scope": ["preconsultation"]}, format="json")
        self.assertIsNone(PatientAccessQrToken.objects.get(patient=self.own_patient).consumed_at)
        event = AuditEvent.objects.get(event_type="access_grant.self_refused")
        self.assertEqual(event.actor, self.doctor)
        self.assertEqual(event.metadata, {"action": "self_access_refused", "status": "refused"})

    def test_a_colleague_follows_the_normal_circuit(self):
        raw = create_patient_qr_token(patient=self.own_patient)
        self.client.force_authenticate(self.colleague)
        response = self.client.post(GRANTS, {"qr_token": raw, "scope": ["preconsultation"]}, format="json")
        self.assertEqual(response.status_code, 201)
        grant = AccessGrant.objects.get(patient=self.own_patient)
        self.assertEqual(grant.professional, self.colleague_profile)
        self.assertEqual(grant.status, "pending")
        self.assertIsNotNone(PatientAccessQrToken.objects.get(patient=self.own_patient).consumed_at)

    def test_another_patient_is_unaffected(self):
        other = PatientProfile.objects.create(user=User.objects.create_user(username="other-self", password="local-test-password"))
        raw = create_patient_qr_token(patient=other)
        self.client.force_authenticate(self.doctor)
        self.assertEqual(self.client.post(GRANTS, {"qr_token": raw, "scope": ["preconsultation"]}, format="json").status_code, 201)

    def test_a_grant_on_own_file_never_shows_in_the_professional_list(self):
        make_grant(self.own_patient, self.profile, self.establishment, ["preconsultation"])
        self.client.force_authenticate(self.doctor)
        response = self.client.get(GRANTS)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], [])

    def test_helper_ignores_patients_without_account(self):
        orphan = PatientProfile.objects.create(user=None)
        self.assertFalse(is_own_patient_file(self.profile, orphan))
        self.assertTrue(is_own_patient_file(self.profile, self.own_patient))


class FollowUpPlanGrantTests(TestCase):
    """Audit QA du 23/10/2026 : le plan de suivi passe par la même porte que les autres lectures cliniques."""
    URL = "/api/v1/patient/care/professional/follow-up-plans/"

    def setUp(self):
        self.patient = PatientProfile.objects.create(user=User.objects.create_user(username="patient-plan", password="local-test-password"))
        self.doctor, self.profile, self.establishment = make_clinic_doctor(self.patient.user, "plan")
        self.client = APIClient()
        self.client.force_authenticate(self.doctor)

    def create(self, grant_id):
        return self.client.post(self.URL, {"access_grant_id": str(grant_id), "title": "Tension"}, format="json")

    def test_active_grant_with_scope_creates_the_plan(self):
        grant = make_grant(self.patient, self.profile, self.establishment, ["consultations"])
        response = self.client.post(self.URL, {"access_grant_id": str(grant.id), "objective": "Suivre la tension", "status": "active", "items": [{"measurement_kind": "blood_pressure", "frequency": "Chaque semaine"}]}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["data"]["objective"], "Suivre la tension")
        self.assertEqual(response.data["data"]["history"][0]["action"], "created")

    def test_status_change_is_visible_in_append_only_history(self):
        grant = make_grant(self.patient, self.profile, self.establishment, ["consultations"])
        created = self.client.post(self.URL, {"access_grant_id": str(grant.id), "objective": "Suivre le poids", "items": [{"measurement_kind": "weight", "frequency": "Chaque mois"}]}, format="json")
        self.assertEqual(created.status_code, 201)
        plan_id = created.data["data"]["id"]
        updated = self.client.patch(f"{self.URL}{plan_id}/", {"access_grant_id": str(grant.id), "status": "paused"}, format="json")
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["data"]["status"], "paused")
        self.assertEqual([item["action"] for item in updated.data["data"]["history"]], ["updated", "created"])

    def test_expired_grant_still_flagged_active_is_refused(self):
        from datetime import timedelta
        grant = make_grant(self.patient, self.profile, self.establishment, ["consultations"], expires_in=timedelta(seconds=-5))
        self.assertEqual(self.create(grant.id).status_code, 403)

    def test_grant_of_another_establishment_is_refused(self):
        _, _, other_establishment = make_clinic_doctor(self.patient.user, "plan-other")
        grant = make_grant(self.patient, self.profile, other_establishment, ["consultations"])
        self.assertEqual(self.create(grant.id).status_code, 403)

    def test_scope_missing_or_malformed_id_is_refused_without_crash(self):
        grant = make_grant(self.patient, self.profile, self.establishment, ["preconsultation"])
        self.assertEqual(self.create(grant.id).status_code, 403)
        self.assertEqual(self.client.post(self.URL, {"access_grant_id": "pas-un-uuid", "title": "x"}, format="json").status_code, 403)

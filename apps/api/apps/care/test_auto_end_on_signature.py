"""Règle du 08/11/2026 (suite) : signer la consultation ferme tout de suite l'accès du professionnel au carnet.

Le patient n'a rien à révoquer si le professionnel oublie de cliquer « Terminer l'accès », et un autre professionnel peut se connecter aussitôt."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.patients.models import PatientProfile
from .models import AccessGrant, CareEncounter, Consultation, PatientNotification
from .services import END_REASON_CONSULTATION_SIGNED, create_patient_qr_token
from .tests import make_clinic_doctor

User = get_user_model()
GRANTS = "/api/v1/patient/care/professional/access-grants/"
SIGN = "/api/v1/patient/care/professional/consultations/"
PATIENT_GRANTS = "/api/v1/patient/care/access-grants/"


class SigningTheConsultationEndsTheAccessTests(TestCase):
    def setUp(self):
        self.patient_user = User.objects.create_user(username="sign-end-patient", password="local-test-password", first_name="Awa", last_name="Kone")
        self.patient = PatientProfile.objects.create(user=self.patient_user)
        self.doctor_a, self.profile_a, self.establishment_a = make_clinic_doctor(self.patient_user, "sign-end-a")
        self.doctor_b, self.profile_b, self.establishment_b = make_clinic_doctor(self.patient_user, "sign-end-b")
        self.client_a, self.client_b, self.patient_client = APIClient(), APIClient(), APIClient()
        self.client_a.force_authenticate(self.doctor_a)
        self.client_b.force_authenticate(self.doctor_b)
        self.patient_client.force_authenticate(self.patient_user)
        self.encounter = CareEncounter.objects.create(patient=self.patient, reason="Fièvre", observations="Fièvre depuis deux jours", status="draft")

    def scan(self, client):
        return client.post(GRANTS, {"qr_token": create_patient_qr_token(patient=self.patient), "scope": ["preconsultation", "declarations", "documents"]}, format="json")

    def sign(self, client, grant_id, encounter_id=None):
        return client.post(SIGN, {"access_grant_id": grant_id, "source_encounter_id": str(encounter_id or self.encounter.id), "attestation_svg": "<svg></svg>", "diagnosis": "Paludisme simple"}, format="json")

    def test_signing_closes_the_access_audits_it_and_tells_the_patient(self):
        grant_id = self.scan(self.client_a).data["data"]["id"]
        signed = self.sign(self.client_a, grant_id)
        self.assertEqual(signed.status_code, 201)
        grant = AccessGrant.objects.get(pk=grant_id)
        self.assertEqual(grant.status, "expired")
        self.assertIsNotNone(grant.expires_at)
        ended = AuditEvent.objects.get(access_grant_id=grant_id, event_type="access_grant.ended")
        self.assertEqual(ended.metadata["reason_code"], END_REASON_CONSULTATION_SIGNED)
        self.assertEqual(ended.actor, self.doctor_a)
        notification = PatientNotification.objects.get(patient=self.patient, kind="access.ended")
        self.assertEqual(notification.title, "Consultation terminée")
        self.assertIn("fermé automatiquement", notification.body)

    def test_the_professional_can_no_longer_read_the_chart_after_signing(self):
        grant_id = self.scan(self.client_a).data["data"]["id"]
        self.assertEqual(self.sign(self.client_a, grant_id).status_code, 201)
        self.assertEqual(self.client_a.get(f"{GRANTS}{grant_id}/encounters/").status_code, 403)
        # Terminer à la main un accès déjà fermé par la signature : refusé proprement, sans second événement.
        self.assertEqual(self.client_a.post(f"{GRANTS}{grant_id}/end/").status_code, 409)
        self.assertEqual(AuditEvent.objects.filter(access_grant_id=grant_id, event_type="access_grant.ended").count(), 1)
        self.assertEqual(PatientNotification.objects.filter(patient=self.patient, kind="access.ended").count(), 1)

    def test_another_professional_can_connect_right_after_the_signature(self):
        grant_id = self.scan(self.client_a).data["data"]["id"]
        self.assertEqual(self.scan(self.client_b).status_code, 400)  # tant que A est connecté
        self.assertEqual(self.sign(self.client_a, grant_id).status_code, 201)
        self.assertEqual(self.scan(self.client_b).status_code, 201)

    def test_a_refused_signature_leaves_the_access_open(self):
        grant_id = self.scan(self.client_a).data["data"]["id"]
        unknown = "00000000-0000-0000-0000-000000000000"
        self.assertEqual(self.sign(self.client_a, grant_id, encounter_id=unknown).status_code, 400)
        self.assertEqual(Consultation.objects.count(), 0)
        self.assertEqual(AccessGrant.objects.get(pk=grant_id).status, "active")
        self.assertFalse(AuditEvent.objects.filter(access_grant_id=grant_id, event_type="access_grant.ended").exists())
        self.assertEqual(self.client_a.get(f"{GRANTS}{grant_id}/encounters/").status_code, 200)

    def test_signing_after_the_patient_revoked_is_refused_and_creates_nothing(self):
        grant_id = self.scan(self.client_a).data["data"]["id"]
        self.assertEqual(self.patient_client.post(f"{PATIENT_GRANTS}{grant_id}/revoke/").status_code, 200)
        self.assertEqual(self.sign(self.client_a, grant_id).status_code, 400)
        self.assertEqual(Consultation.objects.count(), 0)
        self.assertFalse(AuditEvent.objects.filter(access_grant_id=grant_id, event_type="access_grant.ended").exists())
        self.assertEqual(AccessGrant.objects.get(pk=grant_id).status, "revoked")

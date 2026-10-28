"""Scanner le QR du patient ouvre aussi la lecture seule de ses documents : le périmètre « documents » est toujours demandé."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.patients.models import PatientProfile
from .models import AccessGrant
from .services import create_patient_qr_token
from .tests import make_clinic_doctor

User = get_user_model()
GRANTS = "/api/v1/patient/care/professional/access-grants/"


class QrScanIncludesDocumentsTests(TestCase):
    def setUp(self):
        self.doctor, self.profile, self.establishment = make_clinic_doctor(User.objects.create_user(username="doc-qr-scope", password="local-test-password"), "qr-scope")
        self.patient = PatientProfile.objects.create(user=User.objects.create_user(username="pat-qr-scope", password="local-test-password"))
        self.client = APIClient()
        self.client.force_authenticate(self.doctor)

    def test_documents_are_requested_even_when_the_client_does_not_ask_for_them(self):
        response = self.client.post(GRANTS, {"qr_token": create_patient_qr_token(patient=self.patient), "scope": ["preconsultation"]}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertIn("documents", response.data["data"]["scope"])
        self.assertIn("documents", AccessGrant.objects.get(patient=self.patient).scope)

    def test_default_scope_without_any_scope_sent(self):
        response = self.client.post(GRANTS, {"qr_token": create_patient_qr_token(patient=self.patient)}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(sorted(response.data["data"]["scope"]), ["declarations", "documents", "preconsultation"])

    def test_documents_are_not_duplicated_when_already_requested(self):
        response = self.client.post(GRANTS, {"qr_token": create_patient_qr_token(patient=self.patient), "scope": ["preconsultation", "documents"]}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["data"]["scope"].count("documents"), 1)

    def test_an_unknown_scope_is_still_refused(self):
        response = self.client.post(GRANTS, {"qr_token": create_patient_qr_token(patient=self.patient), "scope": ["diagnostic"]}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_the_patient_qr_announces_the_same_scope(self):
        self.client.force_authenticate(self.patient.user)
        response = self.client.post("/api/v1/patient/care/access-qr/", {}, format="json")
        self.assertIn(response.status_code, (200, 201))
        self.assertIn("documents", response.data["data"]["scope"])

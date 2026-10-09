from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from apps.care.models import CareEncounter, PreConsultationRevision
from apps.establishments.models import Establishment

User = get_user_model()


class PatientOwnedDataTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user(username="patient-a", password="local-test-password")
        self.b = User.objects.create_user(username="patient-b", password="local-test-password")
        self.client = APIClient()

    def test_profile_and_declarations_are_isolated(self):
        self.client.force_authenticate(self.a)
        created = self.client.post("/api/v1/patient/declarations/", {"kind": "allergy", "label": "Pénicilline", "details": "Déclaration fictive de test"}, format="json")
        self.assertEqual(created.status_code, 201)
        self.client.force_authenticate(self.b)
        self.assertEqual(self.client.get("/api/v1/patient/declarations/").data["data"], [])
        self.assertEqual(self.client.get("/api/v1/patient/profile/").status_code, 200)

    def test_preconsultation_closure_is_idempotent_and_immutable(self):
        self.client.force_authenticate(self.a)
        site = Establishment.objects.create(created_by=self.a, name="Centre fictif", establishment_type="Centre", city="Abidjan", address="A", phone="0", email="patient-test@example.test", responsible_name="Responsable", status="active")
        created = self.client.post("/api/v1/patient/care/encounters/", {"establishment_id": str(site.id), "reason": "Motif fictif", "observations": "Observation fictive"}, format="json")
        pk = created.data["data"]["id"]
        first = self.client.post(f"/api/v1/patient/care/encounters/{pk}/", {}, format="json")
        second = self.client.post(f"/api/v1/patient/care/encounters/{pk}/", {}, format="json")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(PreConsultationRevision.objects.filter(encounter_id=pk).count(), 1)
        blocked = self.client.patch(f"/api/v1/patient/care/encounters/{pk}/", {"reason": "Modification interdite"}, format="json")
        self.assertEqual(blocked.status_code, 409)

    def test_anonymous_patient_data_is_forbidden(self):
        self.assertEqual(self.client.get("/api/v1/patient/profile/").status_code, 403)

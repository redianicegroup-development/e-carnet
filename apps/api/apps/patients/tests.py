from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from apps.care.models import CareEncounter, PreConsultationRevision
from apps.establishments.models import Establishment
from .models import ClinicalDeclaration

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

    def test_blood_group_is_a_patient_declaration_and_only_one_is_active(self):
        self.client.force_authenticate(self.a)
        invalid = self.client.post("/api/v1/patient/declarations/", {"kind": "blood_group", "label": "G+", "details": ""}, format="json")
        self.assertEqual(invalid.status_code, 400)
        first = self.client.post("/api/v1/patient/declarations/", {"kind": "blood_group", "label": "A+", "details": ""}, format="json")
        second = self.client.post("/api/v1/patient/declarations/", {"kind": "blood_group", "label": "O−", "details": ""}, format="json")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(list(ClinicalDeclaration.objects.filter(patient__user=self.a, kind="blood_group", status="declared").values_list("label", flat=True)), ["O−"])
        card = self.client.get("/api/v1/patient/emergency-card/")
        self.assertEqual(card.data["data"]["blood_group"], "O−")
        self.assertFalse(card.data["data"]["qr_enabled"])

    def test_emergency_qr_only_exposes_selected_fields_and_can_be_revoked_or_rotated(self):
        self.client.force_authenticate(self.a)
        self.client.post("/api/v1/patient/declarations/", {"kind": "blood_group", "label": "AB+", "details": ""}, format="json")
        self.client.post("/api/v1/patient/declarations/", {"kind": "allergy", "label": "Pénicilline", "details": "Réaction cutanée"}, format="json")
        self.client.post("/api/v1/patient/declarations/", {"kind": "treatment", "label": "Traitement fictif", "details": "1 fois par jour"}, format="json")
        self.client.patch("/api/v1/patient/emergency-card/", {"contact_name": "Contact fictif", "contact_phone": "+225 00 00 00 00", "qr_enabled": True}, format="json")
        first_token = self.client.get("/api/v1/patient/emergency-card/").data["data"]["qr_token"]

        self.client.force_authenticate(None)
        public = self.client.get(f"/api/v1/patient/emergency-card/qr/{first_token}/")
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.data["data"]["blood_group"], "AB+")
        self.assertEqual(public.data["data"]["allergies"][0]["label"], "Pénicilline")
        self.assertEqual(public.data["data"]["treatments"][0]["label"], "Traitement fictif")
        self.assertEqual(public.data["data"]["contact_name"], "Contact fictif")
        self.assertEqual(set(public.data["data"]), {"blood_group", "allergies", "treatments", "contact_name", "contact_phone"})
        self.assertIn("no-store", public["Cache-Control"])
        self.assertIn("noindex", public["X-Robots-Tag"])
        self.assertEqual(self.client.get("/api/v1/patient/emergency-card/qr/not-a-token/").status_code, 404)

        self.client.force_authenticate(self.a)
        rotated = self.client.post("/api/v1/patient/emergency-card/", {}, format="json")
        new_token = rotated.data["data"]["qr_token"]
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/v1/patient/emergency-card/qr/{first_token}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/patient/emergency-card/qr/{new_token}/").status_code, 200)

        self.client.force_authenticate(self.a)
        self.client.patch("/api/v1/patient/emergency-card/", {"qr_enabled": False}, format="json")
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/v1/patient/emergency-card/qr/{new_token}/").status_code, 404)

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
        self.assertEqual(self.client.get("/api/v1/patient/emergency-card/").status_code, 403)

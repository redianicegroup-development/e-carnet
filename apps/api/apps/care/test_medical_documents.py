from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.patients.models import PatientProfile
from .models import Consultation, MedicalDocument, PrescriptionLine, Vaccination

User = get_user_model()


@override_settings(MEDIA_ROOT="/tmp/ecarnet-test-media")
class MedicalDocumentTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="documents-patient", password="local-test-password")
        self.other_user = User.objects.create_user(username="documents-other", password="local-test-password")
        self.profile = PatientProfile.objects.create(user=self.user)
        self.other_profile = PatientProfile.objects.create(user=self.other_user)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def upload(self, name="ordonnance.pdf", content=b"%PDF-1.4 test", content_type="application/pdf"):
        return self.client.post(
            "/api/v1/patient/care/documents/",
            {"file": SimpleUploadedFile(name, content, content_type=content_type), "document_type": "prescription"},
            format="multipart",
        )

    def test_patient_can_upload_list_and_download_document(self):
        response = self.upload()
        self.assertEqual(response.status_code, 201)
        document_id = response.data["data"]["id"]
        self.assertEqual(response.data["data"]["document_type_label"], "Ordonnance")
        listed = self.client.get("/api/v1/patient/care/documents/")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.data["data"]), 1)
        downloaded = self.client.get(f"/api/v1/patient/care/documents/{document_id}/download/")
        self.assertEqual(downloaded.status_code, 200)
        self.assertEqual(downloaded["Content-Type"], "application/pdf")
        self.assertEqual(b"".join(downloaded.streaming_content), b"%PDF-1.4 test")

    def test_invalid_type_and_oversized_file_are_rejected(self):
        invalid = self.upload("ordonnance.txt", b"text", "text/plain")
        self.assertEqual(invalid.status_code, 400)
        oversized = self.upload(content=b"x" * (10 * 1024 * 1024 + 1))
        self.assertEqual(oversized.status_code, 400)
        self.assertEqual(MedicalDocument.objects.count(), 0)

    def test_patient_cannot_read_another_patients_document(self):
        response = self.upload()
        document_id = response.data["data"]["id"]
        self.client.force_authenticate(self.other_user)
        self.assertEqual(self.client.get("/api/v1/patient/care/documents/").data["data"], [])
        self.assertEqual(self.client.get(f"/api/v1/patient/care/documents/{document_id}/download/").status_code, 404)

    def test_patient_can_add_vaccination_without_false_non_effectue_status(self):
        response = self.client.post("/api/v1/patient/care/vaccinations/", {"vaccine_name": "BCG", "dose_number": 1, "administered_on": "2026-01-10"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["data"]["status"], "declared")
        self.assertEqual(self.client.get("/api/v1/patient/care/vaccinations/").data["data"][0]["vaccine_name"], "BCG")
        self.assertFalse(Vaccination.objects.filter(patient=self.profile, status="not_done").exists())

    def test_patient_can_download_a_printable_prescription(self):
        consultation = Consultation.objects.create(patient=self.profile, professional_name="Dr Test", facility_label="Clinique Test", reason="Fièvre", validated_at=timezone.now())
        PrescriptionLine.objects.create(consultation=consultation, drug_name="Paracétamol", dosage="1 g", posology="1 comprimé matin et soir", duration="3 jours")
        response = self.client.get(f"/api/v1/patient/care/consultations/{consultation.id}/prescription/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(b"%PDF" in b"".join(response.streaming_content) if getattr(response, "streaming", False) else response.content.startswith(b"%PDF"))

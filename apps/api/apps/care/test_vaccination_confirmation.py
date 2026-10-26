from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.patients.models import PatientProfile
from .models import MedicalDocument, PatientNotification, Vaccination
from .tests import make_clinic_doctor, make_grant

User = get_user_model()
VACCINATIONS = "/api/v1/patient/care/vaccinations/"
DOCUMENTS = "/api/v1/patient/care/documents/"


class PatientVaccinationEvidenceTests(TestCase):
    def setUp(self):
        self.patient_user = User.objects.create_user(username="vaccination-owner", password="local-test-password")
        self.patient = PatientProfile.objects.create(user=self.patient_user)
        self.client = APIClient()
        self.client.force_authenticate(self.patient_user)

    def upload_vaccination_document(self):
        return self.client.post(
            DOCUMENTS,
            {"file": SimpleUploadedFile("carnet.pdf", b"%PDF-1.7 carnet"), "document_type": "vaccination"},
            format="multipart",
        )

    def test_patient_cannot_self_confirm_and_attached_evidence_marks_documented(self):
        forged = self.client.post(VACCINATIONS, {"vaccine_name": "BCG", "status": "confirmed"}, format="json")
        self.assertEqual(forged.status_code, 201)
        self.assertEqual(forged.data["data"]["status"], "declared")
        self.assertIsNone(forged.data["data"]["confirmed_at"])

        uploaded = self.upload_vaccination_document()
        self.assertEqual(uploaded.status_code, 201)
        created = self.client.post(
            VACCINATIONS,
            {"vaccine_name": "DT-Coq-Polio", "dose_number": 2, "document_id": uploaded.data["data"]["id"]},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["data"]["status"], "documented")
        self.assertEqual(str(created.data["data"]["document_id"]), uploaded.data["data"]["id"])

    def test_patient_cannot_attach_a_different_patient_or_non_vaccination_document(self):
        other_user = User.objects.create_user(username="vaccination-other", password="local-test-password")
        other = PatientProfile.objects.create(user=other_user)
        document = MedicalDocument.objects.create(patient=other, original_name="other.pdf", document_type="vaccination", content_type="application/pdf", size_bytes=20)
        response = self.client.post(VACCINATIONS, {"vaccine_name": "BCG", "document_id": str(document.id)}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Vaccination.objects.filter(patient=self.patient).exists())

        own_document = MedicalDocument.objects.create(patient=self.patient, original_name="analysis.pdf", document_type="analysis", content_type="application/pdf", size_bytes=20)
        response = self.client.post(VACCINATIONS, {"vaccine_name": "BCG", "document_id": str(own_document.id)}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_deleting_document_reverts_only_documented_status_to_declared(self):
        uploaded = self.upload_vaccination_document()
        created = self.client.post(VACCINATIONS, {"vaccine_name": "BCG", "document_id": uploaded.data["data"]["id"]}, format="json")
        item = Vaccination.objects.get(pk=created.data["data"]["id"])
        self.assertEqual(item.status, "documented")
        deleted = self.client.delete(f"{DOCUMENTS}{uploaded.data['data']['id']}/")
        self.assertEqual(deleted.status_code, 200)
        item.refresh_from_db()
        self.assertEqual(item.status, "declared")
        self.assertIsNone(item.document_id)


class ProfessionalVaccinationConfirmationTests(TestCase):
    def setUp(self):
        self.patient_user = User.objects.create_user(username="vaccination-patient", password="local-test-password")
        self.patient = PatientProfile.objects.create(user=self.patient_user)
        self.doctor, self.profile, self.establishment = make_clinic_doctor(self.patient_user, "vaccination")
        self.client = APIClient()
        self.client.force_authenticate(self.doctor)

    def url(self, grant_id):
        return f"/api/v1/patient/care/professional/access-grants/{grant_id}/vaccinations/"

    def test_active_declarations_grant_is_required_and_confirmation_is_audited(self):
        item = Vaccination.objects.create(patient=self.patient, vaccine_name="Fièvre jaune")
        refused = make_grant(self.patient, self.profile, self.establishment, ["preconsultation"])
        self.assertEqual(self.client.get(self.url(refused.id)).status_code, 403)
        refused.scope = ["declarations"]
        refused.save(update_fields=("scope",))
        grant = refused
        listed = self.client.get(self.url(grant.id))
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data["data"][0]["status"], "declared")
        confirmed = self.client.post(f"{self.url(grant.id)}{item.id}/confirm/", {}, format="json")
        self.assertEqual(confirmed.status_code, 200)
        self.assertEqual(confirmed.data["data"]["status"], "confirmed")
        item.refresh_from_db()
        self.assertEqual(item.confirmed_by_id, self.profile.id)
        self.assertEqual(item.confirmed_access_grant_id, grant.id)
        self.assertEqual(item.establishment_id, self.establishment.id)
        self.assertEqual(confirmed.data["data"]["establishment_id"], str(self.establishment.id))
        self.assertIsNotNone(item.confirmed_at)
        self.assertTrue(AuditEvent.objects.filter(event_type="vaccination.confirmed", patient=self.patient, access_grant=grant).exists())
        notice = PatientNotification.objects.get(patient=self.patient, kind="vaccination.confirmed")
        self.assertIn("Fièvre jaune", notice.body)

    def test_attached_document_requires_the_separate_documents_scope_before_confirmation(self):
        document = MedicalDocument.objects.create(patient=self.patient, original_name="carnet.pdf", document_type="vaccination", content_type="application/pdf", size_bytes=20)
        item = Vaccination.objects.create(patient=self.patient, vaccine_name="BCG", document=document, status="documented")
        grant = make_grant(self.patient, self.profile, self.establishment, ["declarations"], expires_in=timedelta(hours=1))
        url = f"{self.url(grant.id)}{item.id}/confirm/"
        self.assertEqual(self.client.post(url, {}, format="json").status_code, 403)
        item.refresh_from_db()
        self.assertEqual(item.status, "documented")
        grant.scope = ["declarations", "documents"]
        grant.save(update_fields=("scope",))
        confirmed = self.client.post(url, {}, format="json")
        self.assertEqual(confirmed.status_code, 200)
        self.assertEqual(confirmed.data["data"]["status"], "confirmed")

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.establishments.models import Establishment, EstablishmentMembership
from apps.identity.models import AccountContext
from apps.identity.account_action_views import anonymize_and_disable_account
from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile
from .models import AccessGrant, Appointment, Consultation, ExamRequest, HealthMeasurement, MedicalDocument, MedicationReminder, PatientNotification, Vaccination

User = get_user_model()


@override_settings(MEDIA_ROOT="/tmp/ecarnet-test-media-v2")
class MedicalDocumentsV2Tests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="docs-v2-patient", password="local-test-password")
        self.profile = PatientProfile.objects.create(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def upload(self, name="result.pdf", content=b"%PDF-1.7 test", **extra):
        payload = {"file": SimpleUploadedFile(name, content), "document_type": "analysis", **extra}
        return self.client.post("/api/v1/patient/care/documents/", payload, format="multipart")

    def test_signature_and_extension_must_match_and_vaccination_is_a_type(self):
        self.assertEqual(self.upload("fake.pdf", b"\x89PNG\r\n\x1a\nrest").status_code, 400)
        self.assertEqual(self.upload("fake.png", b"%PDF-1.7 test").status_code, 400)
        self.assertEqual(self.upload("fake.webp", b"RIFFxxxxNOPE").status_code, 400)
        response = self.upload("carnet.pdf", document_type="vaccination")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["data"]["document_type"], "vaccination")

    def test_count_and_cumulative_quotas_are_explicit(self):
        MedicalDocument.objects.bulk_create([
            MedicalDocument(patient=self.profile, original_name=f"{i}.pdf", document_type="other", content_type="application/pdf", size_bytes=1)
            for i in range(100)
        ])
        response = self.upload()
        self.assertEqual(response.status_code, 400)
        self.assertIn("100 documents", str(response.data))
        MedicalDocument.objects.all().delete()
        MedicalDocument.objects.create(patient=self.profile, original_name="large.pdf", document_type="other", content_type="application/pdf", size_bytes=200 * 1024 * 1024)
        response = self.upload()
        self.assertEqual(response.status_code, 400)
        self.assertIn("200 MiB", str(response.data))

    def test_owner_delete_destroys_private_cloudinary_asset_or_keeps_reference_on_failure(self):
        item = MedicalDocument.objects.create(patient=self.profile, original_name="scan.pdf", document_type="analysis", content_type="application/pdf", size_bytes=10, cloudinary_public_id="e-carnet/patient/asset", cloudinary_resource_type="raw")
        with patch("apps.care.views.cloudinary_destroy", return_value={"result": "ok"}) as destroy:
            response = self.client.delete(f"/api/v1/patient/care/documents/{item.id}/")
        self.assertEqual(response.status_code, 200)
        destroy.assert_called_once_with("e-carnet/patient/asset", resource_type="raw")
        self.assertFalse(MedicalDocument.objects.filter(pk=item.pk).exists())
        failed = MedicalDocument.objects.create(patient=self.profile, original_name="scan2.pdf", document_type="analysis", content_type="application/pdf", size_bytes=10, cloudinary_public_id="asset-2", cloudinary_resource_type="image")
        with patch("apps.care.views.cloudinary_destroy", side_effect=RuntimeError("refused")):
            response = self.client.delete(f"/api/v1/patient/care/documents/{failed.id}/")
        self.assertEqual(response.status_code, 502)
        self.assertTrue(MedicalDocument.objects.filter(pk=failed.pk).exists())
        self.assertTrue(AuditEvent.objects.filter(event_type="medical_document.delete_failed", patient=self.profile).exists())

    def test_open_exam_link_transitions_and_delete_restores_requested(self):
        consultation = Consultation.objects.create(patient=self.profile, professional_name="Dr Test", facility_label="Clinique", reason="Bilan", validated_at=timezone.now())
        exam = ExamRequest.objects.create(consultation=consultation, kind="analysis", label="NFS")
        response = self.upload(exam_request_id=str(exam.id))
        self.assertEqual(response.status_code, 201)
        exam.refresh_from_db()
        self.assertEqual(exam.status, "result_received")
        document_id = response.data["data"]["id"]
        self.assertFalse(response.data["data"]["verified"])
        self.assertEqual(self.client.delete(f"/api/v1/patient/care/documents/{document_id}/").status_code, 200)
        exam.refresh_from_db()
        self.assertEqual(exam.status, "requested")

    def test_account_erasure_removes_documents_operational_data_but_keeps_signed_consultation_and_audit(self):
        self.profile.first_name = "Prénom patient"
        self.profile.last_name = "Nom patient"
        self.profile.save(update_fields=("first_name", "last_name"))
        consultation = Consultation.objects.create(patient=self.profile, professional_name="Dr Signé", facility_label="Clinique", reason="Suivi", validated_at=timezone.now())
        AuditEvent.objects.create(event_type="consultation.validated", actor=self.user, actor_role="patient", patient=self.profile, consultation=consultation, metadata={"action": "validated"})
        MedicalDocument.objects.create(patient=self.profile, original_name="delete.pdf", document_type="other", content_type="application/pdf", size_bytes=10)
        Vaccination.objects.create(patient=self.profile, vaccine_name="BCG")
        HealthMeasurement.objects.create(patient=self.profile, kind="weight", value="70", unit="kg", measured_at=timezone.now())
        reminder = MedicationReminder.objects.create(patient=self.profile, name="Traitement", starts_on=timezone.localdate(), times=["08:00"])
        Appointment.objects.create(patient=self.profile, reason="Contrôle", starts_at=timezone.now())
        PatientNotification.objects.create(patient=self.profile, kind="notice", title="Info", body="Message")
        anonymize_and_disable_account(self.user)
        self.assertFalse(MedicalDocument.objects.filter(patient=self.profile).exists())
        self.assertFalse(Vaccination.objects.filter(patient=self.profile).exists())
        self.assertFalse(HealthMeasurement.objects.filter(patient=self.profile).exists())
        self.assertFalse(MedicationReminder.objects.filter(pk=reminder.pk).exists())
        self.assertFalse(Appointment.objects.filter(patient=self.profile).exists())
        self.assertFalse(PatientNotification.objects.filter(patient=self.profile).exists())
        self.profile.refresh_from_db()
        self.assertIsNone(self.profile.user_id)
        self.assertEqual(self.profile.first_name, "")
        self.assertEqual(self.profile.last_name, "")
        self.assertTrue(Consultation.objects.filter(pk=consultation.pk).exists())
        self.assertTrue(AuditEvent.objects.filter(consultation=consultation).exists())

    def test_account_erasure_destroys_private_assets_before_erasing_document_rows(self):
        document = MedicalDocument.objects.create(patient=self.profile, original_name="cloud.pdf", document_type="other", content_type="application/pdf", size_bytes=10, cloudinary_public_id="private/patient/cloud", cloudinary_resource_type="raw")
        with patch("apps.identity.account_action_views.cloudinary_destroy", return_value={"result": "ok"}) as destroy:
            anonymize_and_disable_account(self.user)
        destroy.assert_called_once_with("private/patient/cloud", resource_type="raw")
        self.assertFalse(MedicalDocument.objects.filter(pk=document.pk).exists())
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_account_erasure_keeps_identity_and_document_reference_when_cloudinary_refuses(self):
        document = MedicalDocument.objects.create(patient=self.profile, original_name="cloud.pdf", document_type="other", content_type="application/pdf", size_bytes=10, cloudinary_public_id="private/patient/refused", cloudinary_resource_type="raw")
        with patch("apps.identity.account_action_views.cloudinary_destroy", side_effect=RuntimeError("refused")):
            with self.assertRaises(RuntimeError):
                anonymize_and_disable_account(self.user)
        self.user.refresh_from_db()
        self.profile.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertEqual(self.profile.user_id, self.user.id)
        self.assertTrue(MedicalDocument.objects.filter(pk=document.pk).exists())

    def test_account_erasure_destroys_and_clears_professional_stamp_and_signature(self):
        professional = ProfessionalProfile.objects.create(
            user=self.user, professional_title="Médecin", professional_identifier="ORD-123",
            stamp_cloudinary_public_id="private/pro/stamp", stamp_cloudinary_resource_type="image", stamp_cloudinary_version=3,
            signature_cloudinary_public_id="private/pro/signature", signature_cloudinary_resource_type="image", signature_cloudinary_version=4,
        )
        with patch("apps.identity.account_action_views.cloudinary_destroy", return_value={"result": "ok"}) as destroy:
            anonymize_and_disable_account(self.user)
        self.assertEqual(destroy.call_count, 2)
        self.assertEqual({call.args[0] for call in destroy.call_args_list}, {"private/pro/stamp", "private/pro/signature"})
        professional.refresh_from_db()
        self.assertEqual(professional.professional_identifier, "")
        self.assertEqual(professional.stamp_cloudinary_public_id, "")
        self.assertEqual(professional.signature_cloudinary_public_id, "")

    def test_professional_documents_require_active_grant_and_documents_scope(self):
        doctor_user = User.objects.create_user(username="docs-v2-doctor", password="local-test-password")
        doctor = ProfessionalProfile.objects.create(user=doctor_user, professional_title="Médecin", verification_status="verified")
        site = Establishment.objects.create(created_by=self.user, name="Clinique documents", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="docs-v2@example.test", responsible_name="Root", status="active")
        EstablishmentMembership.objects.create(establishment=site, professional=doctor, status="active")
        doctor.active_establishment = site
        doctor.save(update_fields=("active_establishment", "updated_at"))
        document = MedicalDocument.objects.create(patient=self.profile, original_name="read.pdf", document_type="analysis", content_type="application/pdf", size_bytes=10)
        grant = AccessGrant.objects.create(patient=self.profile, professional=doctor, establishment=site, professional_name="Médecin", facility_label=site.name, scope=["consultations"], status="active", starts_at=timezone.now(), expires_at=timezone.now() + timedelta(hours=1))
        AccountContext.objects.create(user=doctor_user, role="professional", is_active=True)
        professional_client = APIClient()
        professional_client.force_authenticate(doctor_user)
        url = f"/api/v1/patient/care/professional/access-grants/{grant.id}/documents/"
        self.assertEqual(professional_client.get(url).status_code, 403)
        grant.scope = ["documents"]
        grant.save(update_fields=("scope",))
        self.assertEqual(professional_client.get(url).status_code, 200)
        self.assertEqual(professional_client.post(url, {}, format="json").status_code, 405)
        self.assertEqual(document.patient_id, self.profile.id)

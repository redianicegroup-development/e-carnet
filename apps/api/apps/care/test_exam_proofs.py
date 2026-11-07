"""Photo de la demande d'examen : preuve prise par le médecin, jamais un résultat ; nom du patient dans « Mes demandes »."""
import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.patients.models import PatientProfile
from .models import CareEncounter, Consultation, ExamRequest, MedicalDocument
from .tests import make_clinic_doctor, make_grant

User = get_user_model()
SIGN = "/api/v1/patient/care/professional/consultations/"
GRANTS = "/api/v1/patient/care/professional/access-grants/"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
MEDIA = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=MEDIA)
class ExamProofTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.patient_user = User.objects.create_user(username="patient-proof", password="local-test-password", first_name="Awa", last_name="Kone")
        self.patient = PatientProfile.objects.create(user=self.patient_user)
        self.doctor, self.profile, self.establishment = make_clinic_doctor(self.patient_user, "proof")
        self.grant = make_grant(self.patient, self.profile, self.establishment, ["preconsultation", "declarations"])
        self.encounter = CareEncounter.objects.create(patient=self.patient, reason="Fièvre", status="draft")
        self.client = APIClient()
        self.client.force_authenticate(self.doctor)

    def upload(self, name="bon.png", content=PNG, grant=None):
        file = SimpleUploadedFile(name, content, content_type="image/png")
        return self.client.post(f"{GRANTS}{(grant or self.grant).id}/exam-proofs/", {"file": file}, format="multipart")

    def sign(self, exams):
        return self.client.post(SIGN, {"access_grant_id": str(self.grant.id), "source_encounter_id": str(self.encounter.id), "attestation_svg": "<svg></svg>", "conclusion": "Examens demandés", "requested_exams": exams}, format="json")

    def test_photo_is_stored_as_a_validated_document_and_linked_at_signature_without_a_result(self):
        response = self.upload()
        self.assertEqual(response.status_code, 201, response.data)
        document = MedicalDocument.objects.get()
        self.assertEqual((document.patient, document.professional, document.establishment), (self.patient, self.profile, self.establishment))
        self.assertIsNotNone(document.validated_at)
        self.assertIsNone(document.exam_request)
        signed = self.sign([{"kind": "imaging", "proof_document_id": response.data["data"]["id"]}])
        self.assertEqual(signed.status_code, 201, signed.data)
        exam = ExamRequest.objects.get()
        self.assertEqual(exam.proof_document_id, document.id)
        self.assertEqual(exam.status, "requested")  # une photo de demande n'est pas un résultat
        self.assertTrue(exam.label)
        self.assertEqual(signed.data["data"]["exam_requests"][0]["proof_document_id"], str(document.id))

    def test_an_exam_needs_a_label_or_a_photo(self):
        self.assertEqual(self.sign([{"kind": "analysis", "label": ""}]).status_code, 400)
        self.assertFalse(Consultation.objects.exists())

    def test_a_photo_cannot_be_reused_or_come_from_another_doctor(self):
        proof_id = self.upload().data["data"]["id"]
        self.assertEqual(self.sign([{"kind": "analysis", "proof_document_id": proof_id}, {"kind": "imaging", "proof_document_id": proof_id}]).status_code, 400)
        self.assertFalse(Consultation.objects.exists())
        other, _profile, _establishment = make_clinic_doctor(self.patient_user, "proof-other")
        self.client.force_authenticate(other)
        self.assertEqual(self.sign([{"kind": "analysis", "proof_document_id": proof_id}]).status_code, 400)

    def test_only_images_are_accepted_and_the_signature_must_match(self):
        pdf = SimpleUploadedFile("bon.pdf", b"%PDF-1.4 test", content_type="application/pdf")
        self.assertEqual(self.client.post(f"{GRANTS}{self.grant.id}/exam-proofs/", {"file": pdf}, format="multipart").status_code, 400)
        self.assertEqual(self.upload(name="faux.png", content=b"not an image").status_code, 400)
        self.assertFalse(MedicalDocument.objects.exists())

    def test_upload_requires_an_active_grant_of_this_doctor(self):
        self.grant.status = "revoked"
        self.grant.save(update_fields=("status",))
        self.assertEqual(self.upload().status_code, 403)

    def test_my_requests_name_the_patient(self):
        data = self.client.get(GRANTS).data["data"][0]
        self.assertEqual(data["patient_name"], "Awa Kone")
        self.assertIn("patient_avatar", data)
        self.assertIn("establishment_logo", data)
        self.assertNotIn("patient_id", data)

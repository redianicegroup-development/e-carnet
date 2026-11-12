"""Point 3 (11/2026) : pas de consultation sans signature ni cachet, figés sur la consultation, lisibles par le patient et le signataire.

Aucun appel réseau : Cloudinary est simulé (`signed_download`), seuls les identifiants de stockage sont manipulés."""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.patients.models import PatientProfile
from .models import AccessGrant, CareEncounter, Consultation
from .consultation_services import SEAL_REQUIRED_MESSAGE
from .tests import make_clinic_doctor, make_grant

User = get_user_model()
SIGN = "/api/v1/patient/care/professional/consultations/"
HISTORY = "/api/v1/patient/care/consultations/"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
SIGNATURE_ID = "e-carnet/professional-credentials/doc/signature-aaaaaaaaaaaa"
STAMP_ID = "e-carnet/professional-credentials/doc/stamp-bbbbbbbbbbbb"


def seal_url(consultation_id, kind):
    return f"/api/v1/patient/care/consultations/{consultation_id}/seal/{kind}/"


class SealRequiredToSignTests(TestCase):
    def setUp(self):
        self.patient_user = User.objects.create_user(username="seal-patient", password="local-test-password", first_name="Awa", last_name="Kone")
        self.patient = PatientProfile.objects.create(user=self.patient_user)
        self.doctor, self.profile, self.establishment = make_clinic_doctor(self.patient_user, "seal-required", sealed=False)
        self.grant = make_grant(self.patient, self.profile, self.establishment, ["preconsultation", "declarations"])
        self.encounter = CareEncounter.objects.create(patient=self.patient, reason="Fièvre", observations="Fièvre depuis deux jours", status="draft")
        self.client = APIClient()
        self.client.force_authenticate(self.doctor)
        self.patient_client = APIClient()
        self.patient_client.force_authenticate(self.patient_user)

    def sign(self):
        return self.client.post(SIGN, {"access_grant_id": str(self.grant.id), "source_encounter_id": str(self.encounter.id), "attestation_svg": "<svg></svg>", "diagnosis": "Paludisme simple"}, format="json")

    def set_seal(self, **fields):
        for name, value in fields.items():
            setattr(self.profile, name, value)
        self.profile.save()

    def test_without_signature_or_stamp_nothing_is_created_and_the_access_stays_open(self):
        response = self.sign()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["message"], "Ajoutez votre signature ou votre cachet avant de valider une consultation.")
        self.assertEqual(response.data["message"], SEAL_REQUIRED_MESSAGE)
        self.assertFalse(Consultation.objects.exists())
        self.encounter.refresh_from_db()
        self.assertEqual(self.encounter.status, "draft")
        self.assertIsNone(self.encounter.closed_at)
        self.grant.refresh_from_db()
        self.assertEqual(self.grant.status, "active")
        self.assertFalse(AuditEvent.objects.filter(event_type__in=("consultation.validated", "access_grant.ended")).exists())

    def test_a_stamp_alone_is_enough(self):
        self.set_seal(stamp_cloudinary_public_id=STAMP_ID)
        response = self.sign()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIs(response.data["data"]["has_stamp"], True)
        self.assertIs(response.data["data"]["has_signature"], False)
        consultation = Consultation.objects.get()
        self.assertEqual((consultation.stamp_asset_id, consultation.signature_asset_id), (STAMP_ID, ""))

    def test_a_signature_alone_is_enough(self):
        self.set_seal(signature_cloudinary_public_id=SIGNATURE_ID)
        response = self.sign()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIs(response.data["data"]["has_signature"], True)
        self.assertIs(response.data["data"]["has_stamp"], False)
        consultation = Consultation.objects.get()
        self.assertEqual((consultation.signature_asset_id, consultation.stamp_asset_id), (SIGNATURE_ID, ""))

    def test_the_refusal_then_adding_a_seal_lets_the_same_draft_be_signed(self):
        self.assertEqual(self.sign().status_code, 400)
        self.set_seal(signature_cloudinary_public_id=SIGNATURE_ID)
        self.assertEqual(self.sign().status_code, 201)
        self.encounter.refresh_from_db()
        self.assertEqual(self.encounter.status, "closed")

    def test_both_ids_are_frozen_on_the_consultation_whatever_happens_to_the_profile_later(self):
        self.set_seal(signature_cloudinary_public_id=SIGNATURE_ID, stamp_cloudinary_public_id=STAMP_ID)
        self.assertEqual(self.sign().status_code, 201)
        # Remplacement de la signature, retrait du cachet : la consultation déjà signée ne change pas.
        self.set_seal(signature_cloudinary_public_id="e-carnet/professional-credentials/doc/signature-cccccccccccc", stamp_cloudinary_public_id="")
        consultation = Consultation.objects.get()
        self.assertEqual((consultation.signature_asset_id, consultation.stamp_asset_id), (SIGNATURE_ID, STAMP_ID))
        item = self.patient_client.get(HISTORY).data["data"][0]
        self.assertIs(item["has_signature"], True)
        self.assertIs(item["has_stamp"], True)

    def test_the_storage_identifiers_are_never_in_the_api_payloads(self):
        self.set_seal(signature_cloudinary_public_id=SIGNATURE_ID, stamp_cloudinary_public_id=STAMP_ID)
        signed = self.sign()
        self.assertEqual(signed.status_code, 201)
        for payload in (signed.data, self.patient_client.get(HISTORY).data, self.client.get(SIGN).data):
            text = str(payload)
            self.assertNotIn("signature-aaaaaaaaaaaa", text)
            self.assertNotIn("stamp-bbbbbbbbbbbb", text)
            self.assertNotIn("asset_id", text)

    def test_a_consultation_without_frozen_files_reports_none(self):
        Consultation.objects.create(patient=self.patient, professional=self.profile, establishment=self.establishment, professional_name="Médecin", facility_label="Clinique", reason="Ancienne consultation", validated_at=timezone.now())
        item = self.patient_client.get(HISTORY).data["data"][0]
        self.assertIs(item["has_signature"], False)
        self.assertIs(item["has_stamp"], False)


class ConsultationSealImageTests(TestCase):
    def setUp(self):
        configured = patch("apps.care.views.CLOUDINARY_CONFIGURED", True)
        configured.start()
        self.addCleanup(configured.stop)
        self.patient_user = User.objects.create_user(username="seal-image-patient", password="local-test-password", first_name="Awa", last_name="Kone")
        self.patient = PatientProfile.objects.create(user=self.patient_user)
        self.doctor, self.profile, self.establishment = make_clinic_doctor(self.patient_user, "seal-image")
        self.profile.stamp_cloudinary_public_id = STAMP_ID
        self.profile.signature_cloudinary_public_id = SIGNATURE_ID
        self.profile.save()
        self.grant = make_grant(self.patient, self.profile, self.establishment, ["preconsultation", "declarations"])
        self.encounter = CareEncounter.objects.create(patient=self.patient, reason="Fièvre", status="draft")
        self.doctor_client = APIClient()
        self.doctor_client.force_authenticate(self.doctor)
        signed = self.doctor_client.post(SIGN, {"access_grant_id": str(self.grant.id), "source_encounter_id": str(self.encounter.id), "attestation_svg": "<svg></svg>", "diagnosis": "Paludisme simple"}, format="json")
        self.assertEqual(signed.status_code, 201, signed.data)
        self.consultation = Consultation.objects.get()
        self.patient_client = APIClient()
        self.patient_client.force_authenticate(self.patient_user)

    def other_client(self, username):
        user = User.objects.create_user(username=username, password="local-test-password")
        client = APIClient()
        client.force_authenticate(user)
        return client

    @patch("apps.care.views.signed_download", return_value=PNG)
    def test_the_patient_gets_the_frozen_png_with_a_one_day_private_cache(self, download):
        for kind, stored in (("signature", SIGNATURE_ID), ("stamp", STAMP_ID)):
            response = self.patient_client.get(seal_url(self.consultation.id, kind))
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response["Content-Type"], "image/png")
            self.assertEqual(response["Cache-Control"], "private, max-age=86400")
            self.assertEqual(response["X-Content-Type-Options"], "nosniff")
            self.assertTrue(response.content.startswith(b"\x89PNG"))
            download.assert_called_with(stored, resource_type="image", extension="png")

    @patch("apps.care.views.signed_download", return_value=PNG)
    def test_the_image_stays_the_one_frozen_at_signature_after_the_profile_changes(self, download):
        self.profile.signature_cloudinary_public_id = "e-carnet/professional-credentials/doc/signature-cccccccccccc"
        self.profile.save()
        self.assertEqual(self.patient_client.get(seal_url(self.consultation.id, "signature")).status_code, 200)
        download.assert_called_once_with(SIGNATURE_ID, resource_type="image", extension="png")

    @patch("apps.care.views.signed_download", return_value=PNG)
    def test_the_signing_professional_can_read_it(self, _download):
        self.assertEqual(self.doctor_client.get(seal_url(self.consultation.id, "signature")).status_code, 200)
        self.assertEqual(self.doctor_client.get(seal_url(self.consultation.id, "stamp")).status_code, 200)

    @patch("apps.care.views.signed_download", return_value=PNG)
    def test_another_patient_or_another_professional_gets_a_404(self, download):
        other_patient = self.other_client("seal-image-other-patient")
        self.assertEqual(other_patient.get(seal_url(self.consultation.id, "signature")).status_code, 404)
        other_doctor, *_ = make_clinic_doctor(self.patient_user, "seal-image-other")
        client = APIClient()
        client.force_authenticate(other_doctor)
        self.assertEqual(client.get(seal_url(self.consultation.id, "signature")).status_code, 404)
        self.assertEqual(client.get(seal_url(self.consultation.id, "stamp")).status_code, 404)
        download.assert_not_called()

    @patch("apps.care.views.signed_download", return_value=PNG)
    def test_anonymous_is_refused_and_unknown_or_missing_things_are_404(self, download):
        self.assertIn(APIClient().get(seal_url(self.consultation.id, "signature")).status_code, (401, 403))
        self.assertEqual(self.patient_client.get(seal_url(self.consultation.id, "passport")).status_code, 404)
        self.assertEqual(self.patient_client.get(seal_url("00000000-0000-0000-0000-000000000000", "signature")).status_code, 404)
        download.assert_not_called()

    @patch("apps.care.views.signed_download", return_value=PNG)
    def test_a_consultation_without_that_file_is_a_404_and_nothing_is_downloaded(self, download):
        old = Consultation.objects.create(patient=self.patient, professional=self.profile, establishment=self.establishment, professional_name="Médecin", facility_label="Clinique", reason="Ancienne", stamp_asset_id=STAMP_ID, validated_at=timezone.now())
        self.assertEqual(self.patient_client.get(seal_url(old.id, "signature")).status_code, 404)
        download.assert_not_called()
        self.assertEqual(self.patient_client.get(seal_url(old.id, "stamp")).status_code, 200)

    @patch("apps.care.views.signed_download", side_effect=OSError("boom Cloudinary"))
    def test_a_download_failure_is_a_502_that_hides_internal_details(self, _download):
        response = self.patient_client.get(seal_url(self.consultation.id, "signature"))
        self.assertEqual(response.status_code, 502)
        body = response.content.decode()
        self.assertNotIn("boom", body)
        self.assertNotIn("signature-aaaaaaaaaaaa", body)

    @patch("apps.care.views.signed_download", return_value=PNG)
    def test_storage_not_configured_is_a_503(self, download):
        with patch("apps.care.views.CLOUDINARY_CONFIGURED", False):
            self.assertEqual(self.patient_client.get(seal_url(self.consultation.id, "signature")).status_code, 503)
        download.assert_not_called()

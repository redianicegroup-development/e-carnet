"""Cachet et signature de l'ÉTABLISSEMENT : figés sur la consultation à sa validation, lisibles par le patient et le signataire.

Aucun appel réseau : Cloudinary est simulé (`signed_download`), seuls les identifiants de stockage sont manipulés."""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.patients.models import PatientProfile
from .models import CareEncounter, Consultation
from .tests import make_clinic_doctor, make_grant

User = get_user_model()
SIGN = "/api/v1/patient/care/professional/consultations/"
HISTORY = "/api/v1/patient/care/consultations/"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
DOCTOR_SIGNATURE = "e-carnet/professional-credentials/doc/signature-aaaaaaaaaaaa"
ESTABLISHMENT_STAMP = "e-carnet/establishment-credentials/etab/stamp-dddddddddddd"
ESTABLISHMENT_SIGNATURE = "e-carnet/establishment-credentials/etab/signature-eeeeeeeeeeee"


def seal_url(consultation_id, kind):
    return f"/api/v1/patient/care/consultations/{consultation_id}/seal/{kind}/"


class EstablishmentSealFrozenTests(TestCase):
    def setUp(self):
        configured = patch("apps.care.views.CLOUDINARY_CONFIGURED", True)
        configured.start()
        self.addCleanup(configured.stop)
        self.patient_user = User.objects.create_user(username="est-seal-patient", password="local-test-password", first_name="Awa", last_name="Kone")
        self.patient = PatientProfile.objects.create(user=self.patient_user)
        self.doctor, self.profile, self.establishment = make_clinic_doctor(self.patient_user, "est-seal")
        self.profile.signature_cloudinary_public_id = DOCTOR_SIGNATURE
        self.profile.save()
        self.grant = make_grant(self.patient, self.profile, self.establishment, ["preconsultation", "declarations"])
        self.encounter = CareEncounter.objects.create(patient=self.patient, reason="Fièvre", status="draft")
        self.doctor_client = APIClient()
        self.doctor_client.force_authenticate(self.doctor)
        self.patient_client = APIClient()
        self.patient_client.force_authenticate(self.patient_user)

    def set_establishment_marks(self, stamp="", signature=""):
        self.establishment.stamp_cloudinary_public_id = stamp
        self.establishment.signature_cloudinary_public_id = signature
        self.establishment.save()

    def sign(self):
        response = self.doctor_client.post(SIGN, {"access_grant_id": str(self.grant.id), "source_encounter_id": str(self.encounter.id), "attestation_svg": "<svg></svg>", "diagnosis": "Paludisme simple"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response

    def test_the_establishment_marks_are_frozen_on_the_consultation(self):
        self.set_establishment_marks(ESTABLISHMENT_STAMP, ESTABLISHMENT_SIGNATURE)
        signed = self.sign()
        self.assertIs(signed.data["data"]["has_establishment_stamp"], True)
        self.assertIs(signed.data["data"]["has_establishment_signature"], True)
        consultation = Consultation.objects.get()
        self.assertEqual((consultation.establishment_stamp_asset_id, consultation.establishment_signature_asset_id), (ESTABLISHMENT_STAMP, ESTABLISHMENT_SIGNATURE))

    def test_replacing_or_removing_them_later_never_changes_a_signed_consultation(self):
        self.set_establishment_marks(ESTABLISHMENT_STAMP, ESTABLISHMENT_SIGNATURE)
        self.sign()
        self.set_establishment_marks("e-carnet/establishment-credentials/etab/stamp-ffffffffffff", "")
        consultation = Consultation.objects.get()
        self.assertEqual((consultation.establishment_stamp_asset_id, consultation.establishment_signature_asset_id), (ESTABLISHMENT_STAMP, ESTABLISHMENT_SIGNATURE))
        item = self.patient_client.get(HISTORY).data["data"][0]
        self.assertIs(item["has_establishment_stamp"], True)
        self.assertIs(item["has_establishment_signature"], True)

    def test_without_scans_the_consultation_reports_none_and_is_still_signed(self):
        signed = self.sign()
        self.assertIs(signed.data["data"]["has_establishment_stamp"], False)
        self.assertIs(signed.data["data"]["has_establishment_signature"], False)

    def test_storage_identifiers_never_leave_the_api(self):
        self.set_establishment_marks(ESTABLISHMENT_STAMP, ESTABLISHMENT_SIGNATURE)
        signed = self.sign()
        for payload in (signed.data, self.patient_client.get(HISTORY).data, self.patient_client.get(f"{HISTORY}{Consultation.objects.get().id}/prescription-sheet/").data):
            text = str(payload)
            self.assertNotIn("stamp-dddddddddddd", text)
            self.assertNotIn("signature-eeeeeeeeeeee", text)

    @patch("apps.care.views.signed_download", return_value=PNG)
    def test_the_patient_and_the_signer_read_the_frozen_establishment_images(self, download):
        self.set_establishment_marks(ESTABLISHMENT_STAMP, ESTABLISHMENT_SIGNATURE)
        self.sign()
        consultation = Consultation.objects.get()
        # Remplacé ensuite : l'image servie reste celle figée à la signature.
        self.set_establishment_marks("e-carnet/establishment-credentials/etab/stamp-ffffffffffff", "")
        for client in (self.patient_client, self.doctor_client):
            for kind, stored in (("establishment-stamp", ESTABLISHMENT_STAMP), ("establishment-signature", ESTABLISHMENT_SIGNATURE)):
                response = client.get(seal_url(consultation.id, kind))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response["Content-Type"], "image/png")
                self.assertEqual(response["X-Content-Type-Options"], "nosniff")
                download.assert_called_with(stored, resource_type="image", extension="png")

    @patch("apps.care.views.signed_download", return_value=PNG)
    def test_a_stranger_gets_a_404_and_a_missing_file_a_404(self, download):
        self.set_establishment_marks(ESTABLISHMENT_STAMP, "")
        self.sign()
        consultation = Consultation.objects.get()
        stranger = User.objects.create_user(username="est-seal-stranger", password="local-test-password")
        client = APIClient()
        client.force_authenticate(stranger)
        self.assertEqual(client.get(seal_url(consultation.id, "establishment-stamp")).status_code, 404)
        download.assert_not_called()
        # Aucune signature d'établissement n'avait été déposée : rien à servir.
        self.assertEqual(self.patient_client.get(seal_url(consultation.id, "establishment-signature")).status_code, 404)

"""Cachet et signature de l'établissement (« Informations administratives ») : administrateurs de CETTE structure seulement.

Aucun appel réseau : Cloudinary est simulé ; aucun identifiant de stockage ne sort de l'API."""
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.care.models import Consultation
from apps.identity.models import AccountContext
from apps.patients.models import PatientProfile
from .models import Establishment, EstablishmentAdministrator

User = get_user_model()
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def png_file(name="asset.png"):
    stream = BytesIO()
    Image.new("RGBA", (64, 64), (0, 0, 0, 255)).save(stream, format="PNG")
    return SimpleUploadedFile(name, stream.getvalue(), content_type="image/png")


class EstablishmentCredentialsTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="cred-staff", password="staff-password", is_staff=True)
        self.admin = User.objects.create_user(username="cred-admin", email="cred-admin@test", password="admin-password")
        self.other_admin = User.objects.create_user(username="cred-other", email="cred-other@test", password="admin-password")
        self.establishment = Establishment.objects.create(name="Clinique cachet", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="cachet@test", responsible_name="Admin", status="active")
        self.other = Establishment.objects.create(name="Autre clinique", establishment_type="Clinique", city="Bouaké", address="B", phone="1", email="other@test", responsible_name="Autre", status="active")
        EstablishmentAdministrator.objects.create(establishment=self.establishment, user=self.admin, assigned_by=self.staff)
        EstablishmentAdministrator.objects.create(establishment=self.other, user=self.other_admin, assigned_by=self.staff)
        for user in (self.admin, self.other_admin):
            AccountContext.objects.create(user=user, role="establishment", is_active=True)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.url = f"/api/v1/establishments/{self.establishment.id}/credentials/"

    @patch("apps.establishments.credential_views.CLOUDINARY_CONFIGURED", True)
    @patch("apps.establishments.credential_views.cloudinary_upload")
    def test_valid_png_scans_are_sent_as_private_uploads(self, upload):
        upload.side_effect = [{"public_id": "e-carnet/establishment-credentials/x/stamp-1", "version": 3}, {"public_id": "e-carnet/establishment-credentials/x/signature-1", "version": 4}]
        response = self.client.patch(self.url, {"stamp": png_file("stamp.png"), "signature": png_file("signature.png")}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["data"], {"stamp_uploaded": True, "signature_uploaded": True})
        self.assertEqual(upload.call_count, 2)
        for call in upload.call_args_list:
            self.assertEqual(call.kwargs["delivery_type"], "private")
            self.assertEqual(call.kwargs["folder"], "establishment-credentials")
        self.establishment.refresh_from_db()
        self.assertTrue(self.establishment.stamp_cloudinary_public_id and self.establishment.signature_cloudinary_public_id)
        # Le profil annonce seulement des booléens, jamais l'identifiant de stockage.
        profile = self.client.get(f"/api/v1/establishments/{self.establishment.id}/profile/")
        self.assertEqual((profile.data["data"]["stamp_uploaded"], profile.data["data"]["signature_uploaded"]), (True, True))
        self.assertNotIn("stamp-1", str(profile.data))

    def test_missing_storage_configuration_is_reported_and_nothing_is_saved(self):
        response = self.client.patch(self.url, {"stamp": png_file()}, format="multipart")
        self.assertEqual(response.status_code, 503)
        self.establishment.refresh_from_db()
        self.assertEqual(self.establishment.stamp_cloudinary_public_id, "")

    def test_a_fake_png_is_rejected(self):
        fake = SimpleUploadedFile("stamp.png", b"not-a-png", content_type="image/png")
        self.assertEqual(self.client.patch(self.url, {"stamp": fake}, format="multipart").status_code, 400)

    def test_only_an_active_administrator_of_this_establishment_may_touch_the_scans(self):
        self.establishment.stamp_cloudinary_public_id = "e-carnet/establishment-credentials/x/stamp-1"
        self.establishment.save()
        intruder = APIClient()
        intruder.force_authenticate(self.other_admin)
        for method, url in (("get", self.url), ("patch", self.url), ("get", self.url + "stamp/"), ("delete", self.url + "stamp/")):
            self.assertEqual(getattr(intruder, method)(url).status_code, 403, (method, url))
        anonymous = APIClient()
        self.assertIn(anonymous.get(self.url).status_code, (401, 403))
        self.establishment.refresh_from_db()
        self.assertTrue(self.establishment.stamp_cloudinary_public_id)

    @patch("apps.establishments.credential_views.CLOUDINARY_CONFIGURED", True)
    @patch("apps.establishments.credential_views.cloudinary_download", return_value=PNG)
    def test_preview_is_served_privately_to_the_administrator(self, download):
        self.establishment.signature_cloudinary_public_id = "e-carnet/establishment-credentials/x/signature-1"
        self.establishment.save()
        response = self.client.get(self.url + "signature/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/png")
        self.assertEqual(response["Cache-Control"], "private, no-store")
        download.assert_called_once()
        self.assertEqual(self.client.get(self.url + "stamp/").status_code, 404)  # rien de déposé
        self.assertEqual(self.client.get(self.url + "seal/").status_code, 404)  # élément inconnu

    @patch("apps.establishments.credential_views.CLOUDINARY_CONFIGURED", True)
    @patch("apps.establishments.credential_views.cloudinary_destroy")
    def test_removing_a_scan_keeps_the_file_when_a_signed_consultation_still_uses_it(self, destroy):
        used, free = "e-carnet/establishment-credentials/x/stamp-used", "e-carnet/establishment-credentials/x/signature-free"
        self.establishment.stamp_cloudinary_public_id = used
        self.establishment.signature_cloudinary_public_id = free
        self.establishment.save()
        patient = PatientProfile.objects.create(user=User.objects.create_user(username="cred-patient", password="local-test-password"))
        Consultation.objects.create(patient=patient, establishment=self.establishment, professional_name="Dr X", facility_label="Clinique cachet", reason="Toux", validated_at=timezone.now(), establishment_stamp_asset_id=used)
        stamp = self.client.delete(self.url + "stamp/")
        signature = self.client.delete(self.url + "signature/")
        self.assertEqual((stamp.status_code, signature.status_code), (200, 200))
        self.assertEqual(signature.data["data"], {"stamp_uploaded": False, "signature_uploaded": False})
        self.establishment.refresh_from_db()
        self.assertEqual((self.establishment.stamp_cloudinary_public_id, self.establishment.signature_cloudinary_public_id), ("", ""))
        # Le cachet figé sur une consultation signée n'est JAMAIS détruit ; la signature, que personne ne garde, l'est.
        destroy.assert_called_once_with(free, resource_type="image")

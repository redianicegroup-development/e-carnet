from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient

from .models import ProfessionalProfile

User = get_user_model()


def png_file(name="asset.png"):
    stream = BytesIO()
    Image.new("RGBA", (64, 64), (0, 0, 0, 255)).save(stream, format="PNG")
    return SimpleUploadedFile(name, stream.getvalue(), content_type="image/png")


class ProfessionalCredentialsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="credential-professional", password="local-test-password")
        self.profile = ProfessionalProfile.objects.create(user=self.user, professional_title="Médecin")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_identifier_can_be_edited_without_cloudinary(self):
        response = self.client.patch("/api/v1/professionals/credentials/", {"professional_identifier": "ORD-456"}, format="multipart")
        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.professional_identifier, "ORD-456")
        self.assertFalse(response.data["data"]["signature_uploaded"])

    @patch("apps.professionals.views.CLOUDINARY_CONFIGURED", True)
    @patch("apps.professionals.views.cloudinary_upload")
    def test_valid_png_assets_are_sent_as_private_cloudinary_uploads(self, upload):
        upload.return_value = {"public_id": "e-carnet/professional-credentials/stamp", "version": 7}
        response = self.client.patch("/api/v1/professionals/credentials/", {"stamp": png_file()}, format="multipart")
        self.assertEqual(response.status_code, 200)
        upload.assert_called_once()
        self.assertEqual(upload.call_args.kwargs["delivery_type"], "private")
        self.profile.refresh_from_db()
        self.assertTrue(self.profile.stamp_cloudinary_public_id)

    def test_png_upload_reports_missing_cloudinary_configuration(self):
        response = self.client.patch("/api/v1/professionals/credentials/", {"signature": png_file("signature.png")}, format="multipart")
        self.assertEqual(response.status_code, 503)
        self.profile.refresh_from_db()
        self.assertFalse(self.profile.signature_cloudinary_public_id)

    def test_fake_png_is_rejected(self):
        fake = SimpleUploadedFile("signature.png", b"not-a-png", content_type="image/png")
        response = self.client.patch("/api/v1/professionals/credentials/", {"signature": fake}, format="multipart")
        self.assertEqual(response.status_code, 400)


class ProfessionalCredentialAssetTests(TestCase):
    """Aperçu et retrait du cachet / de la signature : propriétaire uniquement, jamais d'identifiant Cloudinary exposé."""

    def setUp(self):
        self.user = User.objects.create_user(username="asset-professional", password="local-test-password")
        self.profile = ProfessionalProfile.objects.create(user=self.user, professional_title="Médecin", stamp_cloudinary_public_id="private/stamp-1", stamp_cloudinary_version=3)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_unknown_kind_is_a_404(self):
        self.assertEqual(self.client.get("/api/v1/professionals/credentials/passport/").status_code, 404)
        self.assertEqual(self.client.delete("/api/v1/professionals/credentials/passport/").status_code, 404)

    def test_preview_without_file_is_a_404(self):
        self.assertEqual(self.client.get("/api/v1/professionals/credentials/signature/").status_code, 404)

    def test_preview_reports_missing_cloudinary_configuration(self):
        self.assertEqual(self.client.get("/api/v1/professionals/credentials/stamp/").status_code, 503)

    @patch("apps.professionals.views.CLOUDINARY_CONFIGURED", True)
    @patch("apps.professionals.views.cloudinary_download")
    def test_owner_gets_a_private_png_preview(self, download):
        download.return_value = png_file().read()
        response = self.client.get("/api/v1/professionals/credentials/stamp/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/png")
        self.assertIn("no-store", response["Cache-Control"])
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertTrue(response.content.startswith(b"\x89PNG"))

    @patch("apps.professionals.views.CLOUDINARY_CONFIGURED", True)
    @patch("apps.professionals.views.cloudinary_download", side_effect=OSError("boom"))
    def test_preview_failure_hides_internal_details(self, _download):
        response = self.client.get("/api/v1/professionals/credentials/stamp/")
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("boom", response.content.decode())
        self.assertNotIn("private/stamp-1", response.content.decode())

    def test_another_professional_never_sees_this_stamp(self):
        other = User.objects.create_user(username="other-professional", password="local-test-password")
        ProfessionalProfile.objects.create(user=other, professional_title="Médecin")
        client = APIClient()
        client.force_authenticate(other)
        self.assertEqual(client.get("/api/v1/professionals/credentials/stamp/").status_code, 404)

    @patch("apps.professionals.views.CLOUDINARY_CONFIGURED", True)
    @patch("apps.professionals.views.cloudinary_destroy")
    def test_delete_clears_the_file_and_destroys_the_private_asset(self, destroy):
        response = self.client.delete("/api/v1/professionals/credentials/stamp/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["data"]["stamp_uploaded"])
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.stamp_cloudinary_public_id, "")
        self.assertIsNone(self.profile.stamp_cloudinary_version)
        destroy.assert_called_once()

    @patch("apps.professionals.views.CLOUDINARY_CONFIGURED", True)
    @patch("apps.professionals.views.cloudinary_destroy", side_effect=RuntimeError("cloudinary down"))
    def test_delete_succeeds_even_if_cloud_cleanup_fails(self, _destroy):
        response = self.client.delete("/api/v1/professionals/credentials/stamp/")
        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.stamp_cloudinary_public_id, "")

    def test_delete_without_file_is_harmless(self):
        response = self.client.delete("/api/v1/professionals/credentials/signature/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["data"]["signature_uploaded"])

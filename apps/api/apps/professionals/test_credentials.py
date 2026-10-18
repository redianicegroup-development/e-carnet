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

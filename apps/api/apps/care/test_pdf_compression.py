import shutil
import subprocess
import unittest
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from reportlab.pdfgen import canvas
from rest_framework.test import APIClient

from apps.patients.models import PatientProfile
from .pdf_compression import compress_pdf_lossless

User = get_user_model()
TEST_TEXT = "ECARNET-LOSSLESS-VALIDATION-0426 repeated text for reversible stream compression "


def make_compressible_pdf():
    stream = BytesIO()
    document = canvas.Canvas(stream, pageCompression=0)
    for _page in range(3):
        for line in range(48):
            document.drawString(24, 790 - line * 15, TEST_TEXT * 6)
        document.showPage()
    document.save()
    return stream.getvalue()


class PdfCompressionFallbackTests(SimpleTestCase):
    def test_signed_pdf_is_returned_byte_for_byte_without_running_qpdf(self):
        signed = b"%PDF-1.7\n/ByteRange [0 123 456 789]\n%%EOF"
        with patch("apps.care.pdf_compression.shutil.which") as which, patch("apps.care.pdf_compression.subprocess.run") as run:
            self.assertEqual(compress_pdf_lossless(signed), signed)
        which.assert_not_called()
        run.assert_not_called()

    def test_encrypted_pdf_is_returned_byte_for_byte_without_running_qpdf(self):
        encrypted = b"%PDF-1.7\n/Encrypt 8 0 R\n%%EOF"
        with patch("apps.care.pdf_compression.shutil.which") as which:
            self.assertEqual(compress_pdf_lossless(encrypted), encrypted)
        which.assert_not_called()

    def test_missing_qpdf_or_qpdf_failure_preserves_the_original(self):
        original = b"%PDF-1.7\nmalformed but previously accepted\n%%EOF"
        with patch("apps.care.pdf_compression.shutil.which", return_value=None):
            self.assertEqual(compress_pdf_lossless(original), original)
        failed = subprocess.CompletedProcess(args=["qpdf"], returncode=2, stdout=b"", stderr=b"bad pdf")
        with patch("apps.care.pdf_compression.shutil.which", return_value="/usr/bin/qpdf"), patch("apps.care.pdf_compression.subprocess.run", return_value=failed):
            self.assertEqual(compress_pdf_lossless(original), original)


@override_settings(MEDIA_ROOT="/tmp/ecarnet-test-pdf-compression")
class MedicalDocumentCompressionIntegrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="pdf-compression-patient", password="local-test-password")
        cls.patient = PatientProfile.objects.create(user=cls.user)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @unittest.skipUnless(shutil.which("qpdf"), "qpdf est requis pour tester le chemin de compression réel")
    def test_upload_stores_and_downloads_the_losslessly_recompressed_pdf(self):
        original = make_compressible_pdf()
        response = self.client.post(
            "/api/v1/patient/care/documents/",
            {"file": SimpleUploadedFile("rapport.pdf", original, content_type="application/pdf"), "document_type": "analysis"},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        document_id = response.data["data"]["id"]
        stored_size = response.data["data"]["size_bytes"]
        self.assertLess(stored_size, len(original))

        download = self.client.get(f"/api/v1/patient/care/documents/{document_id}/download/")
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download["Content-Type"], "application/pdf")
        downloaded_bytes = b"".join(download.streaming_content)
        self.assertEqual(len(downloaded_bytes), stored_size)

        # qpdf peut décompresser les flux du résultat et retrouver le contenu textuel d’origine.
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory(prefix="ecarnet-pdf-test-") as directory:
            compressed_path = Path(directory) / "stored.pdf"
            plain_path = Path(directory) / "plain.pdf"
            compressed_path.write_bytes(downloaded_bytes)
            result = subprocess.run(
                [shutil.which("qpdf"), "--stream-data=uncompress", str(compressed_path), str(plain_path)],
                capture_output=True,
                timeout=10,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))
            self.assertIn(TEST_TEXT.encode("ascii"), plain_path.read_bytes())

    @unittest.skipUnless(shutil.which("qpdf"), "qpdf est requis pour tester le chemin de compression réel")
    def test_compressed_pdf_is_the_file_sent_to_cloudinary(self):
        original = make_compressible_pdf()
        sent_files = []

        def capture_upload(file_obj, **_kwargs):
            file_obj.seek(0)
            sent_files.append(file_obj.read())
            return {"public_id": "medical-documents/test/compressed", "version": 1}

        with patch("apps.care.views.CLOUDINARY_CONFIGURED", True), patch("apps.care.views.cloudinary_upload", side_effect=capture_upload):
            response = self.client.post(
                "/api/v1/patient/care/documents/",
                {"file": SimpleUploadedFile("rapport-cloud.pdf", original, content_type="application/pdf"), "document_type": "analysis"},
                format="multipart",
            )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(sent_files), 1)
        self.assertLess(len(sent_files[0]), len(original))
        self.assertEqual(response.data["data"]["size_bytes"], len(sent_files[0]))

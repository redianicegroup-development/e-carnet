from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from PIL import Image

from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile
from .models import Appointment, Consultation, PrescriptionLine

User = get_user_model()


class PrescriptionPdfTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="prescription-patient", password="local-test-password", first_name="Zoé", last_name="N’Guessan")
        self.profile = PatientProfile.objects.create(user=self.user)
        self.professional_user = User.objects.create_user(username="prescriber", password="local-test-password")
        self.professional = ProfessionalProfile.objects.create(user=self.professional_user, professional_title="Médecin", specialty="Pédiatrie", professional_identifier="ORD-123")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def consultation(self, signed=True):
        return Consultation.objects.create(
            patient=self.profile,
            professional=self.professional,
            professional_name="Dr Awa Kouassi",
            facility_label="Clinique des Lagunes",
            reason="Fièvre",
            validated_at=timezone.now(),
            attestation_signed_at=timezone.now() if signed else None,
        )

    def test_unsigned_consultation_is_blocked(self):
        consultation = self.consultation(signed=False)
        PrescriptionLine.objects.create(consultation=consultation, drug_name="Paracétamol", posology="1 comprimé")
        self.assertEqual(self.client.get(f"/api/v1/patient/care/consultations/{consultation.id}/prescription/").status_code, 409)

    def test_signed_pdf_contains_required_prescription_and_can_span_pages(self):
        consultation = self.consultation()
        Appointment.objects.create(patient=self.profile, professional=self.professional, reason="Suivi", starts_at=timezone.now() + timedelta(days=2), status="confirmed")
        for index in range(36):
            PrescriptionLine.objects.create(consultation=consultation, position=index, drug_name=f"Médicament {index}", dosage="1 g", posology="matin et soir pendant le repas", duration="10 jours", instructions="Boire de l’eau et respecter la posologie.")
        response = self.client.get(f"/api/v1/patient/care/consultations/{consultation.id}/prescription/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))
        self.assertGreater(response.content.count(b"/Type /Page"), 1)

    @patch("apps.care.views.signed_download")
    def test_deposited_private_assets_are_downloaded_without_logo_url_fetch(self, download):
        image = BytesIO()
        Image.new("RGBA", (64, 64), (0, 0, 0, 255)).save(image, format="PNG")
        self.professional.stamp_cloudinary_public_id = "private/stamp"
        self.professional.signature_cloudinary_public_id = "private/signature"
        self.professional.save(update_fields=("stamp_cloudinary_public_id", "signature_cloudinary_public_id", "updated_at"))
        consultation = self.consultation()
        PrescriptionLine.objects.create(consultation=consultation, drug_name="Paracétamol", posology="1 comprimé")
        download.return_value = image.getvalue()
        response = self.client.get(f"/api/v1/patient/care/consultations/{consultation.id}/prescription/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(download.call_count, 2)

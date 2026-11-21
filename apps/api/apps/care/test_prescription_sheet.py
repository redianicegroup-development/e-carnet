import re
from datetime import date, timedelta
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.establishments.models import Establishment, PrescriptionTemplate
from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile
from .models import Appointment, Consultation, PrescriptionLine
from .prescription_context import age_in_years, weight_label
from .prescription_pdf import build_prescription_pdf, monogram

User = get_user_model()
SAFE_LOGO = "https://res.cloudinary.com/demo/image/upload/logo.png"


def png_bytes():
    image = BytesIO()
    Image.new("RGBA", (64, 40), (20, 40, 120, 255)).save(image, format="PNG")
    return image.getvalue()


class PrescriptionHelperTests(SimpleTestCase):
    def test_age_counts_full_years_only(self):
        today = date(2026, 11, 21)
        self.assertEqual(age_in_years(date(1992, 11, 21), today), 34)
        self.assertEqual(age_in_years(date(1992, 11, 22), today), 33)
        self.assertEqual(age_in_years(date(2026, 1, 1), today), 0)

    def test_age_is_unknown_without_a_plausible_birth_date(self):
        today = date(2026, 11, 21)
        self.assertIsNone(age_in_years(None, today))
        self.assertIsNone(age_in_years(date(2027, 1, 1), today))
        self.assertIsNone(age_in_years(date(1800, 1, 1), today))

    def test_weight_reads_the_stored_vital_in_any_shape(self):
        self.assertEqual(weight_label({"weight_kg": {"value": 61, "source": "professional"}}), "61 kg")
        self.assertEqual(weight_label({"weight_kg": {"value": "61.5"}}), "61,5 kg")
        self.assertEqual(weight_label({"weight_kg": 8.25}), "8,2 kg")
        self.assertEqual(weight_label({"weight_kg": {"value": None}}), "")
        self.assertEqual(weight_label({"weight_kg": {"value": "n/a"}}), "")
        self.assertEqual(weight_label({}), "")
        self.assertEqual(weight_label(None), "")

    def test_monogram_keeps_the_first_useful_words(self):
        self.assertEqual(monogram("Clinique des Lagunes"), "CL")
        self.assertEqual(monogram("Centre de Santé d’Abobo"), "CS")
        self.assertEqual(monogram("Ab"), "A")
        self.assertEqual(monogram("de la"), "DE")  # que des mots vides : les deux premières lettres du nom


class PrescriptionSheetTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="sheet-patient", password="local-test-password", first_name="Zoé", last_name="Kouamé")
        self.profile = PatientProfile.objects.create(user=self.user, birth_date=date(1992, 3, 4), gender="female")
        self.professional_user = User.objects.create_user(username="sheet-prescriber", password="local-test-password")
        self.professional = ProfessionalProfile.objects.create(user=self.professional_user, professional_title="Médecin", specialty="Pédiatrie", professional_identifier="ORD-123")
        self.establishment = Establishment.objects.create(name="Clinique des Lagunes", status="active", establishment_type="Clinique", city="Abidjan", address="Cocody, rue des Jardins", phone="+225 27 00 00 00 00", email="contact@lagunes.test")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def consultation(self, *, signed=True, **extra):
        return Consultation.objects.create(
            patient=self.profile,
            professional=self.professional,
            establishment=self.establishment,
            professional_name="Dr Awa Kouassi",
            facility_label="Clinique des Lagunes",
            reason="Fièvre",
            vitals={"weight_kg": {"value": 61, "source": "professional"}},
            validated_at=timezone.now(),
            attestation_signed_at=timezone.now() if signed else None,
            **extra,
        )

    def line(self, consultation, **extra):
        values = {"drug_name": "Paracétamol", "dosage": "1 g", "posology": "1 comprimé × 3 par jour", "duration": "5 jours", "instructions": "Après les repas."}
        values.update(extra)
        return PrescriptionLine.objects.create(consultation=consultation, **values)

    def sheet(self, consultation):
        return self.client.get(f"/api/v1/patient/care/consultations/{consultation.id}/prescription-sheet/")

    def test_sheet_returns_everything_the_ordonnance_shows(self):
        consultation = self.consultation(stamp_asset_id="private/stamp-1", signature_asset_id="private/signature-1")
        self.line(consultation)
        response = self.sheet(consultation)
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["consultation_id"], str(consultation.id))
        self.assertEqual(data["reference"], str(consultation.id).replace("-", "")[:8].upper())
        self.assertEqual(data["issued_on"], consultation.validated_at.date().isoformat())
        self.assertEqual(data["establishment"]["name"], "Clinique des Lagunes")
        self.assertEqual(data["establishment"]["type"], "Clinique")
        self.assertEqual(data["establishment"]["city"], "Abidjan")
        self.assertEqual(data["prescriber"], {"name": "Dr Awa Kouassi", "title": "Médecin", "specialty": "Pédiatrie", "order_number": "ORD-123"})
        self.assertEqual(data["patient"]["name"], "Zoé Kouamé")
        self.assertEqual(data["patient"]["sex"], "female")
        self.assertEqual(data["patient"]["weight"], "61 kg")
        self.assertIsInstance(data["patient"]["age_years"], int)
        self.assertEqual([line["drug_name"] for line in data["lines"]], ["Paracétamol"])
        self.assertTrue(data["has_stamp"])
        self.assertTrue(data["has_signature"])

    def test_sheet_never_exposes_storage_identifiers(self):
        consultation = self.consultation(stamp_asset_id="private/stamp-secret", signature_asset_id="private/signature-secret")
        self.line(consultation)
        body = self.sheet(consultation).content.decode()
        self.assertNotIn("stamp-secret", body)
        self.assertNotIn("signature-secret", body)

    def test_template_fields_win_and_blank_ones_fall_back_to_the_establishment_record(self):
        PrescriptionTemplate.objects.create(establishment=self.establishment, header_text="Pédiatrie · Maternité", footer_text="Ouvert 7j/7", phone="+225 07 11 11 11 11")
        consultation = self.consultation()
        self.line(consultation)
        establishment = self.sheet(consultation).json()["data"]["establishment"]
        self.assertEqual(establishment["header_text"], "Pédiatrie · Maternité")
        self.assertEqual(establishment["footer_text"], "Ouvert 7j/7")
        self.assertEqual(establishment["phone"], "+225 07 11 11 11 11")
        self.assertEqual(establishment["address"], "Cocody, rue des Jardins")
        self.assertEqual(establishment["email"], "contact@lagunes.test")

    def test_logo_is_only_taken_from_trusted_storage(self):
        template = PrescriptionTemplate.objects.create(establishment=self.establishment, logo_url="http://tracker.example/pixel.png")
        self.establishment.logo_url = "https://res.cloudinary.com/demo/image/upload/fiche.png"
        self.establishment.save(update_fields=("logo_url",))
        consultation = self.consultation()
        self.line(consultation)
        self.assertEqual(self.sheet(consultation).json()["data"]["establishment"]["logo_url"], "https://res.cloudinary.com/demo/image/upload/fiche.png")
        template.logo_url = SAFE_LOGO
        template.save(update_fields=("logo_url",))
        self.assertEqual(self.sheet(consultation).json()["data"]["establishment"]["logo_url"], SAFE_LOGO)

    def test_next_appointment_is_the_one_at_the_same_establishment(self):
        other = Establishment.objects.create(name="Autre clinique", status="active")
        Appointment.objects.create(patient=self.profile, establishment=other, reason="Ailleurs", starts_at=timezone.now() + timedelta(days=1), status="confirmed")
        consultation = self.consultation()
        self.line(consultation)
        self.assertIsNone(self.sheet(consultation).json()["data"]["next_appointment"])
        Appointment.objects.create(patient=self.profile, establishment=self.establishment, reason="Suivi", starts_at=timezone.now() + timedelta(days=3), status="confirmed")
        Appointment.objects.create(patient=self.profile, establishment=self.establishment, reason="Annulé", starts_at=timezone.now() + timedelta(days=1), status="cancelled")
        self.assertIsNotNone(self.sheet(consultation).json()["data"]["next_appointment"])

    def test_sheet_is_refused_for_unsigned_or_empty_prescriptions_and_other_patients(self):
        unsigned = self.consultation(signed=False)
        self.line(unsigned)
        self.assertEqual(self.sheet(unsigned).status_code, 409)
        empty = self.consultation()
        self.assertEqual(self.sheet(empty).status_code, 404)
        signed = self.consultation()
        self.line(signed)
        stranger = User.objects.create_user(username="sheet-stranger", password="local-test-password")
        PatientProfile.objects.create(user=stranger)
        other = APIClient()
        other.force_authenticate(stranger)
        self.assertEqual(other.get(f"/api/v1/patient/care/consultations/{signed.id}/prescription-sheet/").status_code, 404)
        self.assertEqual(APIClient().get(f"/api/v1/patient/care/consultations/{signed.id}/prescription-sheet/").status_code, 403)

    def test_consultation_list_carries_the_signature_line_data(self):
        consultation = self.consultation()
        self.line(consultation)
        response = self.client.get("/api/v1/patient/care/consultations/")
        self.assertEqual(response.status_code, 200)
        item = next(row for row in response.json()["data"] if row["id"] == str(consultation.id))
        self.assertEqual(item["signatory"], {"title": "Médecin", "specialty": "Pédiatrie", "order_number": "ORD-123"})
        self.assertEqual(item["establishment"], {"name": "Clinique des Lagunes", "type": "Clinique", "city": "Abidjan", "phone": "+225 27 00 00 00 00"})

    def test_consultation_without_establishment_record_falls_back_to_its_label(self):
        consultation = Consultation.objects.create(patient=self.profile, professional_name="Dr X", facility_label="Cabinet du Plateau", reason="Toux", validated_at=timezone.now(), attestation_signed_at=timezone.now())
        response = self.client.get("/api/v1/patient/care/consultations/")
        item = next(row for row in response.json()["data"] if row["id"] == str(consultation.id))
        self.assertEqual(item["establishment"]["name"], "Cabinet du Plateau")
        self.assertEqual(item["signatory"], {"title": "", "specialty": "", "order_number": ""})

    @patch("apps.care.views.signed_download")
    def test_pdf_uses_the_images_frozen_at_signature(self, download):
        self.professional.stamp_cloudinary_public_id = "profile/stamp-now"
        self.professional.signature_cloudinary_public_id = "profile/signature-now"
        self.professional.save(update_fields=("stamp_cloudinary_public_id", "signature_cloudinary_public_id", "updated_at"))
        consultation = self.consultation(stamp_asset_id="frozen/stamp", signature_asset_id="frozen/signature")
        self.line(consultation)
        download.return_value = png_bytes()
        response = self.client.get(f"/api/v1/patient/care/consultations/{consultation.id}/prescription/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([call.args[0] for call in download.call_args_list], ["frozen/stamp", "frozen/signature"])

    @patch("apps.care.views.signed_download")
    def test_pdf_with_only_a_frozen_stamp_does_not_borrow_the_current_signature(self, download):
        self.professional.signature_cloudinary_public_id = "profile/signature-now"
        self.professional.save(update_fields=("signature_cloudinary_public_id", "updated_at"))
        consultation = self.consultation(stamp_asset_id="frozen/stamp")
        self.line(consultation)
        download.return_value = png_bytes()
        self.assertEqual(self.client.get(f"/api/v1/patient/care/consultations/{consultation.id}/prescription/").status_code, 200)
        self.assertEqual([call.args[0] for call in download.call_args_list], ["frozen/stamp"])

    @patch("apps.care.views.signed_download", side_effect=RuntimeError("storage down"))
    def test_pdf_reports_unavailable_storage_instead_of_a_blank_signature(self, _download):
        consultation = self.consultation(stamp_asset_id="frozen/stamp")
        self.line(consultation)
        self.assertEqual(self.client.get(f"/api/v1/patient/care/consultations/{consultation.id}/prescription/").status_code, 502)

    def test_pdf_without_any_image_is_still_a_valid_single_page_document(self):
        PrescriptionTemplate.objects.create(establishment=self.establishment, header_text="Pédiatrie", footer_text="Ouvert 7j/7")
        consultation = self.consultation()
        self.line(consultation)
        response = self.client.get(f"/api/v1/patient/care/consultations/{consultation.id}/prescription/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b"%PDF"))
        self.assertEqual(len(re.findall(rb"/Type /Page(?!s)", response.content)), 1)


class PrescriptionPdfBuilderTests(SimpleTestCase):
    def data(self, **overrides):
        base = {
            "consultation_id": "c1", "reference": "A1B2C3D4", "issued_on": "2026-11-21", "signed_at": "2026-11-21T10:42:00+00:00",
            "establishment": {"name": "Clinique des Lagunes Internationale de Cocody Angré", "type": "", "city": "", "address": "", "phone": "", "email": "", "logo_url": "", "header_text": "", "footer_text": ""},
            "prescriber": {"name": "Dr Awa Kouassi", "title": "", "specialty": "", "order_number": ""},
            "patient": {"name": "Zoé N’Guessan", "age_years": None, "sex": "", "weight": ""},
            "lines": [{"id": "l1", "drug_name": "Paracétamol <b>", "dosage": "", "posology": "1 comprimé", "duration": "", "instructions": ""}],
            "next_appointment": None, "has_signature": False, "has_stamp": False,
        }
        base.update(overrides)
        return base

    def test_minimal_data_builds_a_pdf(self):
        pdf = build_prescription_pdf(self.data(), [])
        self.assertTrue(pdf.startswith(b"%PDF"))

    def test_markup_in_free_text_is_escaped_not_interpreted(self):
        # Un nom de médicament contenant du balisage ne doit ni casser le PDF ni être interprété comme du balisage de mise en page.
        data = self.data(lines=[{"id": "l1", "drug_name": "<para><b>Test</i>", "dosage": "", "posology": "&nbsp;<x>", "duration": "", "instructions": "<font size=99>"}])
        self.assertTrue(build_prescription_pdf(data, []).startswith(b"%PDF"))

    def test_images_and_next_appointment_are_drawn(self):
        data = self.data(next_appointment="2026-12-01T09:30:00+00:00", has_stamp=True, has_signature=True)
        without = build_prescription_pdf(data, [])
        with_images = build_prescription_pdf(data, [("stamp", png_bytes()), ("signature", png_bytes())])
        self.assertGreater(len(with_images), len(without))

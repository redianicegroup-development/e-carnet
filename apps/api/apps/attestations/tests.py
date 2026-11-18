import zipfile
from datetime import timedelta
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.care.models import AccessGrant
from apps.establishments.models import Establishment, EstablishmentMembership
from apps.identity.models import AccountContext
from apps.patients.models import ClinicalDeclaration, PatientProfile
from apps.professionals.models import ProfessionalProfile

from .models import DeclarationAttestation, DeclarationShare

User = get_user_model()
PDF = b"%PDF-1.4\n%test\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64
BASE = "/api/v1/attestations/"


def docx(extra=()):
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr("word/document.xml", "<w:document/>")
        for name in extra:
            archive.writestr(name, "x")
    return buffer.getvalue()


def upload(name, data):
    return SimpleUploadedFile(name, data)


class Base(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="local-test-password")
        self.establishment = Establishment.objects.create(created_by=self.owner, name="Clinique Soleil", status="active", city="Abidjan")
        self.other_establishment = Establishment.objects.create(created_by=self.owner, name="Centre Lune", status="active", city="Bouaké")
        self.doctor_user, self.doctor = self.pro("doctor", "Médecin", self.establishment)
        self.colleague_user, self.colleague = self.pro("colleague", "Médecin", self.establishment)
        self.outsider_user, self.outsider = self.pro("outsider", "Médecin", self.other_establishment)
        self.patient_user = User.objects.create_user(username="patient", password="local-test-password")
        self.patient = PatientProfile.objects.create(user=self.patient_user, first_name="Awa", last_name="Kouassi")
        self.client = APIClient()

    def pro(self, username, title, establishment, signature="sig-1"):
        user = User.objects.create_user(username=username, password="local-test-password")
        profile = ProfessionalProfile.objects.create(user=user, professional_title=title, verification_status="verified", signature_cloudinary_public_id=signature)
        AccountContext.objects.create(user=user, role="professional", is_active=True)
        profile.active_establishment = establishment
        profile.save(update_fields=("active_establishment",))
        EstablishmentMembership.objects.create(establishment=establishment, professional=profile, status="active")
        return user, profile

    def see_patient(self, professional=None, establishment=None):
        now = timezone.now()
        return AccessGrant.objects.create(patient=self.patient, professional=professional or self.doctor, establishment=establishment or self.establishment, professional_name="Médecin", facility_label="x", scope=["consultations"], status="active", starts_at=now - timedelta(minutes=5), expires_at=now + timedelta(hours=1))

    def declare(self, **extra):
        self.client.force_authenticate(self.patient_user)
        data = {"kind": "implant", "label": "Pacemaker", "details": "Posé en 2021", "event_date": "2021-05-04", "establishment_ids": [str(self.establishment.id)], "files": [upload("preuve.pdf", PDF), upload("photo.png", PNG)]}
        data.update(extra)
        return self.client.post(BASE + "patient/declarations/", data, format="multipart")

    def share_id(self):
        return str(DeclarationShare.objects.get().id)


class PatientDeclarationTests(Base):
    def test_patient_declares_with_proofs_and_shares_with_one_establishment(self):
        response = self.declare()
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()["data"]
        self.assertEqual((data["kind"], data["label"], len(data["attachments"])), ("implant", "Pacemaker", 2))
        self.assertEqual([(s["establishment_name"], s["status"]) for s in data["shares"]], [("Clinique Soleil", "pending")])
        self.assertEqual(self.client.get(BASE + "patient/declarations/").json()["data"][0]["id"], data["id"])

    def test_a_declaration_without_justificatif_or_establishment_is_possible(self):
        response = self.declare(files=[], establishment_ids=[])
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["data"]["shares"], [])

    def test_only_pdf_png_jpg_and_real_docx_are_accepted(self):
        self.assertEqual(self.declare(label="Docx", files=[upload("lettre.docx", docx())]).status_code, 201)
        for bad in (upload("faux.pdf", PNG), upload("virus.exe", b"MZ" + b"0" * 50), upload("macro.docx", docx(("word/vbaProject.bin",))), upload("vide.docx", b"PK\x03\x04junk"), upload("x.pdf", b"%PDF-" + b"0" * (8 * 1024 * 1024))):
            response = self.declare(label=f"Test {bad.name}", files=[bad])
            self.assertEqual(response.status_code, 400, bad.name)
        self.assertEqual(ClinicalDeclaration.objects.filter(patient=self.patient).count(), 1)

    def test_limits_titles_categories_dates_and_duplicates(self):
        self.assertEqual(self.declare(files=[upload(f"{i}.pdf", PDF) for i in range(6)]).status_code, 400)
        self.assertEqual(self.declare(kind="blood_group").status_code, 400)
        self.assertEqual(self.declare(label="ab").status_code, 400)
        self.assertEqual(self.declare(event_date=(timezone.localdate() + timedelta(days=2)).isoformat()).status_code, 400)
        self.assertEqual(self.declare(event_date="pas-une-date").status_code, 400)
        self.assertEqual(self.declare().status_code, 201)
        self.assertEqual(self.declare().status_code, 400)

    def test_only_active_non_laboratory_establishments_can_receive_a_declaration(self):
        lab = Establishment.objects.create(created_by=self.owner, name="Labo", status="active", is_laboratory=True)
        pending = Establishment.objects.create(created_by=self.owner, name="Pas validé", status="pending")
        for target in (lab, pending, "pas-un-uuid"):
            self.assertEqual(self.declare(establishment_ids=[str(target.id) if hasattr(target, "id") else target]).status_code, 400)
        self.assertEqual(ClinicalDeclaration.objects.count(), 0)

    def test_establishment_choice_lists_the_places_that_already_received_the_patient_first(self):
        self.see_patient(establishment=self.other_establishment, professional=self.outsider)
        self.client.force_authenticate(self.patient_user)
        rows = self.client.get(BASE + "patient/establishments/").json()["data"]
        self.assertEqual([(row["name"], row["recent"]) for row in rows], [("Centre Lune", True), ("Clinique Soleil", False)])
        self.assertEqual(len(self.client.get(BASE + "patient/establishments/", {"q": "soleil"}).json()["data"]), 1)

    def test_a_patient_can_share_an_existing_declaration_later_but_not_twice_with_the_same_place(self):
        declaration_id = self.declare(establishment_ids=[]).json()["data"]["id"]
        url = BASE + f"patient/declarations/{declaration_id}/share/"
        self.assertEqual(self.client.post(url, {"establishment_ids": [str(self.establishment.id)]}, format="json").status_code, 200)
        self.assertEqual(self.client.post(url, {"establishment_ids": [str(self.establishment.id)]}, format="json").status_code, 400)

    def test_nobody_else_can_read_a_patients_proofs(self):
        data = self.declare().json()["data"]
        attachment = data["attachments"][0]["id"]
        self.assertEqual(self.client.get(BASE + f"patient/attachments/{attachment}/").status_code, 200)
        stranger = User.objects.create_user(username="stranger", password="local-test-password")
        PatientProfile.objects.create(user=stranger, first_name="Autre")
        self.client.force_authenticate(stranger)
        self.assertEqual(self.client.get(BASE + f"patient/attachments/{attachment}/").status_code, 404)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(BASE + f"patient/attachments/{attachment}/").status_code, (401, 403))


class AttestationFlowTests(Base):
    def setUp(self):
        super().setUp()
        self.declare()
        self.share = self.share_id()

    def pro_get(self, user, path="professional/declarations/"):
        self.client.force_authenticate(user)
        return self.client.get(BASE + path).json()["data"]

    def attest(self, user, share=None):
        self.client.force_authenticate(user)
        return self.client.post(BASE + f"professional/shares/{share or self.share}/attest/", {}, format="json")

    def test_before_the_first_consultation_the_declaration_waits_and_cannot_be_attested(self):
        data = self.pro_get(self.doctor_user)
        self.assertEqual((len(data["to_attest"]), len(data["waiting"])), (0, 1))
        self.assertFalse(data["waiting"][0]["can_attest"])
        response = self.attest(self.doctor_user)
        self.assertEqual(response.status_code, 409)
        self.assertIn("première consultation", response.json()["message"])
        self.assertEqual(self.pro_get(self.doctor_user, "professional/summary/"), {"allowed": True, "to_attest": 0, "waiting": 1})

    def test_after_the_first_consultation_it_is_reminded_and_attestable(self):
        grant = self.see_patient()
        reminder = self.pro_get(self.doctor_user, f"professional/reminders/?grant={grant.id}")
        self.assertEqual((reminder["count"], reminder["items"][0]["label"]), (1, "Pacemaker"))
        self.assertEqual(self.pro_get(self.colleague_user, f"professional/reminders/?grant={grant.id}")["count"], 0)
        data = self.pro_get(self.doctor_user)
        self.assertEqual((len(data["to_attest"]), data["to_attest"][0]["patient_name"], data["to_attest"][0]["can_attest"]), (1, "Awa Kouassi", True))
        response = self.attest(self.doctor_user)
        self.assertEqual(response.status_code, 201, response.content)
        attestation = DeclarationAttestation.objects.get()
        self.assertEqual((attestation.share.status, attestation.professional_title, attestation.snapshot["label"]), ("attested", "Médecin", "Pacemaker"))
        self.assertEqual(len(attestation.snapshot["attachments"]), 2)
        self.assertTrue(attestation.signature_fingerprint)
        self.client.force_authenticate(self.patient_user)
        shares = self.client.get(BASE + "patient/declarations/").json()["data"][0]["shares"]
        self.assertEqual((shares[0]["status"], shares[0]["attestation"]["professional_title"]), ("attested", "Médecin"))
        self.assertTrue(AuditEvent.objects.filter(event_type="declaration.attested", patient=self.patient).exists())

    def test_the_first_professional_wins_and_the_second_is_told_who_attested(self):
        self.see_patient()
        self.assertEqual(self.attest(self.doctor_user).status_code, 201)
        second = self.attest(self.colleague_user)
        self.assertEqual(second.status_code, 409)
        self.assertIn("Déjà attestée", second.json()["message"])
        self.assertEqual(DeclarationAttestation.objects.count(), 1)

    def test_a_professional_of_another_establishment_sees_nothing_and_cannot_attest(self):
        self.see_patient(professional=self.outsider, establishment=self.other_establishment)
        data = self.pro_get(self.outsider_user)
        self.assertEqual((data["to_attest"], data["waiting"]), ([], []))
        self.assertEqual(self.attest(self.outsider_user).status_code, 404)
        attachment = DeclarationShare.objects.get().declaration.attachments.first()
        self.client.force_authenticate(self.outsider_user)
        self.assertEqual(self.client.get(BASE + f"professional/attachments/{attachment.id}/").status_code, 404)

    def test_policy_signature_titles_and_self_attestation(self):
        self.see_patient()
        ProfessionalProfile.objects.filter(pk=self.doctor.pk).update(signature_cloudinary_public_id="", stamp_cloudinary_public_id="")
        self.assertEqual(self.attest(self.doctor_user).status_code, 403)
        ProfessionalProfile.objects.filter(pk=self.doctor.pk).update(signature_cloudinary_public_id="sig-1")
        with override_settings(ATTESTATION_ALLOWED_TITLES="Chirurgien"):
            self.assertEqual(self.attest(self.doctor_user).status_code, 403)
            self.assertFalse(self.pro_get(self.doctor_user)["to_attest"][0]["can_attest"])
        PatientProfile.objects.filter(pk=self.patient.pk).update(user=self.doctor_user)
        self.assertEqual(self.attest(self.doctor_user).status_code, 403)

    def test_a_laboratory_cannot_attest_yet(self):
        lab = Establishment.objects.create(created_by=self.owner, name="Labo", status="active", is_laboratory=True)
        user, profile = self.pro("labuser", "Biologiste", lab)
        DeclarationShare.objects.filter(pk=self.share).update(establishment=lab)
        self.see_patient(professional=profile, establishment=lab)
        self.assertEqual(self.attest(user).status_code, 403)

    def test_patient_withdrawal_closes_everything_for_the_establishment(self):
        self.see_patient()
        attachment = DeclarationShare.objects.get().declaration.attachments.first()
        self.client.force_authenticate(self.doctor_user)
        self.assertEqual(self.client.get(BASE + f"professional/attachments/{attachment.id}/").status_code, 200)
        self.client.force_authenticate(self.patient_user)
        self.assertEqual(self.client.post(BASE + f"patient/shares/{self.share}/revoke/", {}, format="json").status_code, 200)
        self.assertEqual(self.client.post(BASE + f"patient/shares/{self.share}/revoke/", {}, format="json").status_code, 200)
        self.assertEqual(self.pro_get(self.doctor_user)["to_attest"], [])
        self.assertEqual(self.attest(self.doctor_user).status_code, 409)
        self.client.force_authenticate(self.doctor_user)
        self.assertEqual(self.client.get(BASE + f"professional/attachments/{attachment.id}/").status_code, 404)

    def test_proof_download_is_attachment_only_and_traced(self):
        self.see_patient()
        attachment = DeclarationShare.objects.get().declaration.attachments.get(original_name="preuve.pdf")
        self.client.force_authenticate(self.doctor_user)
        response = self.client.get(BASE + f"professional/attachments/{attachment.id}/")
        self.assertEqual((response.status_code, response.content), (200, PDF))
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertTrue(AuditEvent.objects.filter(event_type="declaration.attachment_read", patient=self.patient).exists())

    def test_request_for_information_keeps_it_open_and_attestable(self):
        self.see_patient()
        self.client.force_authenticate(self.doctor_user)
        self.assertEqual(self.client.post(BASE + f"professional/shares/{self.share}/request-info/", {"message": "ok"}, format="json").status_code, 400)
        self.assertEqual(self.client.post(BASE + f"professional/shares/{self.share}/request-info/", {"message": "Merci d’ajouter le compte rendu opératoire"}, format="json").status_code, 200)
        row = self.pro_get(self.doctor_user)["to_attest"][0]
        self.assertEqual((row["status"], row["info_message"]), ("info_requested", "Merci d’ajouter le compte rendu opératoire"))
        self.assertEqual(self.attest(self.doctor_user).status_code, 201)

    def test_patient_can_report_an_error_after_attestation_and_professionals_see_it(self):
        self.see_patient()
        self.client.force_authenticate(self.patient_user)
        self.assertEqual(self.client.post(BASE + f"patient/shares/{self.share}/report-error/", {"message": "Mauvaise date"}, format="json").status_code, 400)
        self.attest(self.doctor_user)
        self.client.force_authenticate(self.patient_user)
        self.assertEqual(self.client.post(BASE + f"patient/shares/{self.share}/report-error/", {"message": "La date est fausse"}, format="json").status_code, 200)
        reported = self.pro_get(self.colleague_user)["reported"]
        self.assertEqual((len(reported), reported[0]["error_message"]), (1, "La date est fausse"))

    def test_a_cancelled_declaration_disappears_for_professionals(self):
        self.see_patient()
        ClinicalDeclaration.objects.update(status="cancelled")
        data = self.pro_get(self.doctor_user)
        self.assertEqual((data["to_attest"], data["waiting"]), ([], []))
        self.assertEqual(self.attest(self.doctor_user).status_code, 409)

    def test_professional_without_clinical_access_gets_nothing(self):
        user = User.objects.create_user(username="loose", password="local-test-password")
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get(BASE + "professional/declarations/").status_code, 403)
        self.assertEqual(self.client.get(BASE + "professional/summary/").json()["data"]["allowed"], False)

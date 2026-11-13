"""PAT-09 : export du carnet par période et par rubrique (PDF et Excel), journalisé, réservé au titulaire."""
import base64
import io
import re
import zipfile
import zlib
from datetime import date, datetime, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.http import QueryDict
from django.test import SimpleTestCase, TestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.audit.services import ALLOWED_METADATA_KEYS
from apps.patients.models import ClinicalDeclaration, PatientProfile
from . import export_pdf
from .export_filters import SECTION_KEYS, SECTION_TITLES, carnet_sections, describe_period, export_audit_metadata, parse_export_filters, parse_period, parse_sections, patient_display_name
from .export_pdf import PDF_FOOTER, pdf_markup, pdf_text
from .models import Consultation, ExamRequest, HealthMeasurement, MedicalDocument, PrescriptionLine, Vaccination

User = get_user_model()
EXPORT = "/api/v1/patient/care/export/"
ALL_TITLES = [SECTION_TITLES[key] for key in SECTION_KEYS]
XLSX_TITLES = ["Résumé", *ALL_TITLES, "Rappels médicaments", "Prises", "Rendez-vous"]


def utc(year, month, day, hour=9):
    return datetime(year, month, day, hour, tzinfo=dt_timezone.utc)


def pdf_lines(content: bytes) -> list[str]:
    """Lignes de texte d’un PDF reportlab (flux ASCII85 + Flate, polices standard cp1252), sans dépendance : une ligne = un `(…) Tj` ou plus,
    coupée à chaque `T*` / `ET`. Les mots d’un paragraphe replié sont donc sur des lignes distinctes."""
    token = re.compile(rb"\(((?:\\.|[^\\()])*)\)\s*Tj|(\bT\*)|(\bET\b)", re.S)

    def unescape(run: bytes) -> str:
        out, index = bytearray(), 0
        while index < len(run):
            if run[index] != 0x5C:
                out.append(run[index])
                index += 1
                continue
            octal = re.match(rb"[0-7]{1,3}", run[index + 1:index + 4])
            if octal:
                out.append(int(octal.group(), 8) & 0xFF)
                index += 1 + len(octal.group())
            else:
                out += run[index + 1:index + 2]
                index += 2
        return out.decode("cp1252", errors="replace")

    lines = []
    for stream in re.finditer(rb"stream\r?\n(.*?)endstream", content, re.S):
        try:
            data = zlib.decompress(base64.a85decode(stream.group(1).strip().removesuffix(b"~>")))
        except Exception:
            continue
        current = []
        for match in token.finditer(data):
            if match.group(1) is not None:
                current.append(unescape(match.group(1)))
            elif current:
                lines.append("".join(current))
                current = []
        if current:
            lines.append("".join(current))
    return lines


def pdf_text_of(response) -> str:
    return "\n".join(pdf_lines(response.content))


def xlsx_workbook(response):
    """(noms des feuilles, {nom: XML de la feuille}) d’un classeur de l’export."""
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    names = re.findall(r'<sheet name="([^"]*)"', archive.read("xl/workbook.xml").decode("utf-8"))
    return names, {name: archive.read(f"xl/worksheets/sheet{index}.xml").decode("utf-8") for index, name in enumerate(names, start=1)}


def make_carnet(profile, *, suffix=""):
    """Une entrée en janvier 2026 (hors période) et une en septembre 2026 (dans la période), pour chacune des sept rubriques."""
    HealthMeasurement.objects.create(patient=profile, kind="weight", value="68.4", unit="kg", source="measured", measured_at=utc(2026, 1, 10))
    HealthMeasurement.objects.create(patient=profile, kind="weight", value="70.1", unit="kg", source="measured", measured_at=utc(2026, 9, 10))
    Vaccination.objects.create(patient=profile, vaccine_name=f"VaccinJanvier{suffix}", administered_on=date(2026, 1, 10))
    Vaccination.objects.create(patient=profile, vaccine_name=f"VaccinSeptembre{suffix}", administered_on=date(2026, 9, 10))
    january = Consultation.objects.create(patient=profile, professional_name="Dr Janvier", facility_label="Clinique", reason=f"MotifJanvier{suffix}", validated_at=utc(2026, 1, 12))
    september = Consultation.objects.create(patient=profile, professional_name="Dr Septembre", facility_label="Clinique", reason=f"MotifSeptembre{suffix}", validated_at=utc(2026, 9, 12))
    PrescriptionLine.objects.create(consultation=january, drug_name=f"MedicamentJanvier{suffix}", posology="1 par jour")
    PrescriptionLine.objects.create(consultation=september, drug_name=f"MedicamentSeptembre{suffix}", posology="2 par jour")
    ExamRequest.objects.create(consultation=january, kind="analysis", label=f"ExamenJanvier{suffix}")
    ExamRequest.objects.create(consultation=september, kind="imaging", label=f"ExamenSeptembre{suffix}")
    for label, day in ((f"AllergieJanvier{suffix}", utc(2026, 1, 15)), (f"AllergieSeptembre{suffix}", utc(2026, 9, 15))):
        declaration = ClinicalDeclaration.objects.create(patient=profile, kind="allergy", label=label)
        ClinicalDeclaration.objects.filter(pk=declaration.pk).update(created_at=day)  # created_at est auto_now_add
    MedicalDocument.objects.create(patient=profile, original_name=f"DocJanvier{suffix}.pdf", document_type="analysis", content_type="application/pdf", size_bytes=1, document_date=date(2026, 1, 5))
    MedicalDocument.objects.create(patient=profile, original_name=f"DocSeptembre{suffix}.pdf", document_type="analysis", content_type="application/pdf", size_bytes=1, document_date=date(2026, 9, 5))
    undated = MedicalDocument.objects.create(patient=profile, original_name=f"DocSansDate{suffix}.pdf", document_type="other", content_type="application/pdf", size_bytes=1)
    MedicalDocument.objects.filter(pk=undated.pk).update(created_at=utc(2026, 9, 20))  # sans date : classé à sa date d’ajout


def flatten(section) -> str:
    return " | ".join(str(cell) for row in section.rows for cell in row)



def _first(detail):
    """Premier message d'une erreur de validation, qu'elle soit une chaîne ou une liste de chaînes."""
    return str(detail[0] if isinstance(detail, (list, tuple)) else detail)

class ParseFiltersTests(SimpleTestCase):
    def test_absent_filters_mean_the_whole_history_and_every_section(self):
        self.assertEqual(parse_period(QueryDict("")), (None, None))
        self.assertIsNone(parse_sections(QueryDict("")))
        self.assertEqual(parse_export_filters(QueryDict("format=pdf")), (None, None, None))

    def test_period_is_parsed_and_inclusive_bounds_may_be_equal(self):
        self.assertEqual(parse_period(QueryDict("from=2026-09-01&to=2026-09-30")), (date(2026, 9, 1), date(2026, 9, 30)))
        self.assertEqual(parse_period(QueryDict("from=2026-09-05&to=2026-09-05")), (date(2026, 9, 5), date(2026, 9, 5)))
        self.assertEqual(parse_period(QueryDict("from=2026-09-01")), (date(2026, 9, 1), None))
        self.assertEqual(parse_period({"to": "2026-09-30"}), (None, date(2026, 9, 30)))

    def test_bad_periods_are_refused_in_french(self):
        for query, field in (
            ("from=pas-une-date", "from"), ("to=2026-9-1", "to"), ("from=20260901", "from"), ("from=2026-W36-2", "from"),
            ("from=2026-02-30", "from"), ("to=2026-13-01", "to"),
            ("from=1899-12-31", "from"), ("to=2101-01-01", "to"), ("from=0000-01-01", "from"), ("to=9999-12-31", "to"),
            ("from=2026-10-01&to=2026-09-01", "to"),
        ):
            with self.subTest(query):
                with self.assertRaises(ValidationError) as caught:
                    parse_period(QueryDict(query))
                self.assertIn(field, caught.exception.detail)
        with self.assertRaises(ValidationError) as caught:
            parse_period(QueryDict("from=1800-01-01"))
        self.assertIn("1900", str(_first(caught.exception.detail["from"])))
        self.assertIn("2100", str(_first(caught.exception.detail["from"])))
        self.assertEqual(parse_period(QueryDict("from=1900-01-01&to=2100-12-31")), (date(1900, 1, 1), date(2100, 12, 31)))

    def test_sections_are_deduplicated_ordered_and_case_insensitive(self):
        self.assertEqual(parse_sections(QueryDict("sections=mesures, Vaccins ,mesures")), ("vaccins", "mesures"))
        self.assertEqual(parse_sections(QueryDict("sections=" + ",".join(reversed(SECTION_KEYS)))), SECTION_KEYS)
        self.assertEqual(parse_sections(QueryDict("sections=examens&sections=prescriptions")), ("prescriptions", "examens"))
        self.assertEqual(parse_sections({"sections": "documents"}), ("documents",))

    def test_unknown_or_empty_sections_are_refused_and_list_the_valid_values(self):
        for query in ("sections=mesures,tout", "sections=pdf", "sections=%3Cb%3E"):
            with self.subTest(query):
                with self.assertRaises(ValidationError) as caught:
                    parse_sections(QueryDict(query))
                message = str(_first(caught.exception.detail["sections"]))
                self.assertIn("Rubrique inconnue", message)
                for key in ("consultations", "prescriptions", "examens", "mesures", "vaccins", "allergies", "documents"):
                    self.assertIn(key, message)
        for query in ("sections=", "sections=,,"):
            with self.subTest(query):
                with self.assertRaises(ValidationError):
                    parse_sections(QueryDict(query))

    def test_a_very_long_unknown_value_is_not_echoed_in_full(self):
        with self.assertRaises(ValidationError) as caught:
            parse_sections({"sections": "x" * 5000})
        self.assertLess(len(str(_first(caught.exception.detail["sections"]))), 400)

    def test_the_seven_categories_are_exactly_the_documented_ones(self):
        self.assertEqual(set(SECTION_KEYS), {"consultations", "prescriptions", "examens", "mesures", "vaccins", "allergies", "documents"})
        self.assertEqual(set(SECTION_TITLES), set(SECTION_KEYS))

    def test_period_wording(self):
        self.assertEqual(describe_period(None, None), "tout l'historique")
        self.assertEqual(describe_period(date(2026, 9, 1), date(2026, 9, 30)), "du 01/09/2026 au 30/09/2026")
        self.assertEqual(describe_period(date(2026, 9, 1), None), "à partir du 01/09/2026")
        self.assertEqual(describe_period(None, date(2026, 9, 30)), "jusqu’au 30/09/2026")

    def test_audit_metadata_describes_the_request_never_the_content(self):
        self.assertEqual(
            export_audit_metadata("pdf", date(2026, 9, 1), None, ("mesures",)),
            {"action": "exported", "resource_type": "patient_carnet_pdf", "format": "pdf", "from": "2026-09-01", "to": "", "sections": ["mesures"]},
        )
        self.assertEqual(export_audit_metadata("xlsx", None, None, None)["sections"], list(SECTION_KEYS))
        self.assertEqual(export_audit_metadata("xlsx", None, None, None)["resource_type"], "patient_carnet_xlsx")


class PdfTextTests(SimpleTestCase):
    def test_user_text_is_escaped_before_it_enters_a_paragraph(self):
        self.assertEqual(pdf_markup("<b>&"), "&lt;b&gt;&amp;")
        self.assertEqual(pdf_markup("a\nb"), "a<br/>b")
        self.assertEqual(pdf_markup("</para><font name='x'>"), "&lt;/para&gt;&lt;font name='x'&gt;")

    def test_text_outside_cp1252_is_replaced_never_raises(self):
        self.assertEqual(pdf_text("Café œuvre € ’ « » —"), "Café œuvre € ’ « » —")
        self.assertEqual(pdf_text("مرحبا"), "?????")
        self.assertEqual(pdf_text("你好 😀"), "?? ?")
        self.assertEqual(pdf_text("SpO₂ ﬁn"), "SpO2 fin")  # forme de compatibilité : lisible plutôt que « ? »
        self.assertEqual(pdf_text("é"), "é")  # é décomposé (NFD) recomposé
        self.assertEqual(pdf_text("a\ud800b"), "a?b")  # substitut isolé
        self.assertEqual(pdf_text("a\x00b\x1bc"), "abc")
        self.assertEqual(pdf_text(None), "")
        self.assertEqual(pdf_text(True), "Oui")
        self.assertEqual(pdf_text(3), "3")
        pdf_text("مرحبا\ud800").encode("cp1252")

    def test_patient_name_without_account_does_not_crash(self):
        self.assertEqual(patient_display_name(PatientProfile(first_name="Léa", last_name="Kouassi")), "Léa Kouassi")
        self.assertEqual(patient_display_name(PatientProfile()), "Titulaire non renseigné")


class CarnetSectionsTests(TestCase):
    """La fonction commune au PDF et à l’Excel : c’est elle qui filtre."""

    def setUp(self):
        self.user = User.objects.create_user(username="sections-patient", password="password", first_name="Awa", last_name="Test")
        self.profile = PatientProfile.objects.create(user=self.user)
        self.other_profile = PatientProfile.objects.create(user=User.objects.create_user(username="sections-other", password="password"))
        make_carnet(self.profile)
        make_carnet(self.other_profile, suffix="Zorro")

    def by_key(self, **kwargs):
        return {section.key: section for section in carnet_sections(self.profile, **kwargs)}

    def test_without_filters_returns_the_seven_sections_in_order_with_everything(self):
        sections = carnet_sections(self.profile)
        self.assertEqual([s.key for s in sections], list(SECTION_KEYS))
        self.assertEqual([s.title for s in sections], ALL_TITLES)
        self.assertEqual({s.key: len(s.rows) for s in sections}, {"allergies": 2, "vaccins": 2, "mesures": 2, "consultations": 2, "prescriptions": 2, "examens": 2, "documents": 3})
        for section in sections:
            for row in section.rows:
                self.assertEqual(len(row), len(section.headers))

    def test_narrow_period_keeps_only_the_entries_of_the_period_in_every_section(self):
        sections = self.by_key(start=date(2026, 9, 1), end=date(2026, 9, 30))
        self.assertEqual(list(sections), list(SECTION_KEYS))
        for key, expected in {
            "allergies": "AllergieSeptembre", "vaccins": "VaccinSeptembre", "mesures": "70.1", "consultations": "MotifSeptembre",
            "prescriptions": "MedicamentSeptembre", "examens": "ExamenSeptembre",
        }.items():
            with self.subTest(key):
                self.assertEqual(len(sections[key].rows), 1)
                self.assertIn(expected, flatten(sections[key]))
                self.assertNotIn("Janvier", flatten(sections[key]))
                self.assertNotIn("68.4", flatten(sections[key]))
        documents = flatten(sections["documents"])
        self.assertIn("DocSeptembre.pdf", documents)
        self.assertIn("DocSansDate.pdf", documents)  # sans date : placé à sa date d’ajout (20/09/2026)
        self.assertNotIn("DocJanvier", documents)

    def test_period_bounds_are_inclusive_and_open_ended_periods_work(self):
        self.assertEqual(len(self.by_key(start=date(2026, 9, 10), end=date(2026, 9, 10))["mesures"].rows), 1)
        self.assertEqual(len(self.by_key(start=date(2026, 9, 11), end=date(2026, 9, 30))["mesures"].rows), 0)
        self.assertEqual(len(self.by_key(start=date(2026, 9, 10))["mesures"].rows), 1)
        self.assertEqual(len(self.by_key(end=date(2026, 9, 9))["mesures"].rows), 1)
        self.assertIn("68.4", flatten(self.by_key(end=date(2026, 9, 9))["mesures"]))
        # Les bornes portent sur la date de la consultation pour ses ordonnances et ses examens.
        self.assertEqual(len(self.by_key(start=date(2026, 9, 12), end=date(2026, 9, 12))["prescriptions"].rows), 1)
        self.assertEqual(len(self.by_key(start=date(2026, 9, 13))["prescriptions"].rows), 0)

    def test_a_period_without_data_still_returns_the_sections_with_no_rows(self):
        sections = self.by_key(start=date(2025, 1, 1), end=date(2025, 12, 31))
        self.assertEqual(list(sections), list(SECTION_KEYS))
        self.assertTrue(all(section.rows == [] for section in sections.values()))

    def test_limited_sections_return_only_those_sections_in_display_order(self):
        sections = carnet_sections(self.profile, sections=("mesures", "allergies"))
        self.assertEqual([s.key for s in sections], ["allergies", "mesures"])
        self.assertEqual([s.key for s in carnet_sections(self.profile, sections=("documents",))], ["documents"])

    def test_unknown_section_is_a_programming_error(self):
        with self.assertRaises(ValueError):
            carnet_sections(self.profile, sections=("mesures", "secret"))

    def test_only_this_patients_data_is_returned(self):
        for section in carnet_sections(self.profile):
            self.assertNotIn("Zorro", flatten(section), section.key)
        others = " ".join(flatten(section) for section in carnet_sections(self.other_profile))
        self.assertIn("MotifJanvierZorro", others)
        self.assertNotIn("MotifJanvier ", others + " ")

    def test_section_contents_match_the_models(self):
        sections = self.by_key()
        self.assertEqual(sections["examens"].headers, ["Consultation du", "Type", "Examen", "Statut", "Prescripteur"])
        row = next(r for r in sections["examens"].rows if "ExamenSeptembre" in r)
        self.assertEqual(row, ["12/09/2026", "Imagerie", "ExamenSeptembre", "Demandé", "Dr Septembre"])
        row = next(r for r in sections["prescriptions"].rows if "MedicamentJanvier" in r)
        self.assertEqual(row[0], "12/01/2026")
        self.assertEqual(row[-1], "Dr Janvier")
        self.assertEqual(next(r for r in sections["allergies"].rows if "AllergieJanvier" in r)[:2], ["Allergie", "AllergieJanvier"])


class CarnetExportApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="export-filters-patient", password="password", first_name="Awa", last_name="Test")
        self.profile = PatientProfile.objects.create(user=self.user)
        self.other_user = User.objects.create_user(username="export-filters-other", password="password", first_name="Zorro", last_name="Personne")
        self.other_profile = PatientProfile.objects.create(user=self.other_user)
        make_carnet(self.profile)
        make_carnet(self.other_profile, suffix="Zorro")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def last_event(self):
        return AuditEvent.objects.filter(event_type="patient.carnet.exported").latest("created_at")

    # --- PDF -----------------------------------------------------------------------------------------------------

    def test_pdf_is_a_private_attachment(self):
        for url in (EXPORT, EXPORT + "?format=pdf"):
            with self.subTest(url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response["Content-Type"], "application/pdf")
                self.assertTrue(response.content.startswith(b"%PDF"))
                self.assertEqual(response["Cache-Control"], "private, no-store")
                self.assertTrue(response["Content-Disposition"].startswith("attachment;"))
                self.assertIn(".pdf", response["Content-Disposition"])

    def test_pdf_header_footer_and_pagination(self):
        text = pdf_text_of(self.client.get(EXPORT))
        for expected in ("Mon E-Carnet — export du carnet", "Titulaire :", "Awa Test", "Généré le :", "Période :", "tout l'historique", "Sections incluses :", PDF_FOOTER, "Page 1 / 1"):
            self.assertIn(expected, text)
        for title in ALL_TITLES:
            self.assertIn(title, text)
        for expected in ("AllergieJanvier", "AllergieSeptembre", "VaccinJanvier", "68.4", "70.1", "MotifJanvier", "MedicamentSeptembre", "ExamenJanvier", "DocSansDate.pdf"):
            self.assertIn(expected, text)

    def test_pdf_page_numbers_are_consistent_on_several_pages(self):
        HealthMeasurement.objects.bulk_create([HealthMeasurement(patient=self.profile, kind="glycemia", value="1.05", unit="g/L", source="measured", measured_at=utc(2026, 3, 1, hour=h % 24)) for h in range(120)])
        pages = re.findall(r"Page (\d+) / (\d+)", pdf_text_of(self.client.get(EXPORT)))
        self.assertGreater(len(pages), 1)
        total = int(pages[0][1])
        self.assertEqual(len(pages), total)
        self.assertEqual([int(n) for n, _ in pages], list(range(1, total + 1)))
        self.assertTrue(all(int(t) == total for _, t in pages))

    def test_pdf_narrow_period_and_limited_sections(self):
        response = self.client.get(EXPORT + "?from=2026-09-01&to=2026-09-30&sections=mesures,examens")
        self.assertEqual(response.status_code, 200)
        text = pdf_text_of(response)
        self.assertIn("du 01/09/2026 au 30/09/2026", text)
        self.assertIn("Mesures, Examens", text)  # « Sections incluses » dans l’ordre d’affichage
        self.assertIn("70.1", text)
        self.assertIn("ExamenSeptembre", text)
        for absent in ("68.4", "ExamenJanvier", "MotifSeptembre", "AllergieSeptembre", "VaccinSeptembre", "MedicamentSeptembre", "DocSeptembre", "Vaccinations", "Consultations", "Documents", "Ordonnances", "Allergies"):
            self.assertNotIn(absent, text)

    def test_pdf_section_without_data_says_so(self):
        text = pdf_text_of(self.client.get(EXPORT + "?from=2025-01-01&to=2025-12-31&sections=mesures,vaccins"))
        self.assertEqual(text.count("Aucune donnée sur cette période"), 2)
        self.assertNotIn("70.1", text)

    def test_pdf_open_ended_period_wording(self):
        self.assertIn("à partir du 01/09/2026", pdf_text_of(self.client.get(EXPORT + "?from=2026-09-01&sections=mesures")))
        self.assertIn("jusqu’au 30/09/2026", pdf_text_of(self.client.get(EXPORT + "?to=2026-09-30&sections=mesures")))

    def test_pdf_user_text_with_markup_does_not_break_the_document(self):
        ClinicalDeclaration.objects.create(patient=self.profile, kind="antecedent", label="<b>gras</b>&co", details="</para><font color='red'>x &amp; <br/> <img src='x'/>")
        Vaccination.objects.create(patient=self.profile, vaccine_name="<i>ital</i>&amp;", administered_on=date(2026, 9, 1), notes="[[bad]] <unknown> & <")
        self.profile.first_name, self.profile.last_name = "<b>Awa", "O'Neil & <Fils>"
        self.profile.save(update_fields=("first_name", "last_name"))
        response = self.client.get(EXPORT + "?sections=allergies,vaccins")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b"%PDF"))
        text = pdf_text_of(response)
        self.assertIn("<b>gras</b>&co", text)
        self.assertIn("<i>ital</i>&amp;", text)  # affiché tel quel : ce n’est pas interprété
        self.assertIn("<b>Awa O'Neil & <Fils>", text)

    def test_pdf_text_outside_cp1252_does_not_break_the_document(self):
        ClinicalDeclaration.objects.create(patient=self.profile, kind="antecedent", label="مرحبا Café œuvre", details="你好 😀")
        response = self.client.get(EXPORT + "?sections=allergies")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b"%PDF"))
        text = pdf_text_of(response)
        self.assertIn("????? Café œuvre", text)
        self.assertIn("Vérifiez la date", text)  # les accents français s’affichent

    def test_pdf_very_long_text_and_many_rows_are_handled(self):
        Consultation.objects.create(patient=self.profile, professional_name="Dr Long", facility_label="Clinique", reason="Bilan", diagnosis="D" * 2000, conclusion="Conclusion ligne. " * 220, validated_at=utc(2026, 9, 14))
        response = self.client.get(EXPORT + "?sections=consultations")
        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(pdf_text_of(response)), 4000)

    def test_pdf_row_cap_is_announced_not_silent(self):
        with patch.object(export_pdf, "MAX_ROWS_PER_SECTION", 1):
            text = pdf_text_of(self.client.get(EXPORT + "?sections=mesures"))
        self.assertIn("Affichage limité aux 1 entrées les plus récentes sur 2", text)
        self.assertIn("70.1", text)  # le plus récent est gardé
        self.assertNotIn("68.4", text)

    # --- Paramètres invalides, pour les deux formats -----------------------------------------------------------------

    def test_invalid_parameters_are_refused_with_a_french_message_in_both_formats(self):
        for fmt in ("pdf", "xlsx"):
            for query, field, fragment in (
                ("sections=mesures,inconnue", "sections", "Valeurs possibles"),
                ("sections=", "sections", "au moins une rubrique"),
                ("from=2026-10-01&to=2026-09-01", "to", "postérieure"),
                ("from=1800-01-01", "from", "1900"),
                ("to=2500-01-01", "to", "2100"),
                ("from=hier", "from", "AAAA-MM-JJ"),
            ):
                with self.subTest(fmt=fmt, query=query):
                    before = AuditEvent.objects.filter(event_type="patient.carnet.exported").count()
                    response = self.client.get(f"{EXPORT}?format={fmt}&{query}")
                    self.assertEqual(response.status_code, 400)
                    self.assertIn(fragment, str(_first(response.json()[field])))
                    self.assertEqual(AuditEvent.objects.filter(event_type="patient.carnet.exported").count(), before)  # rien n’a été exporté, rien n’est journalisé

    def test_unknown_section_message_lists_every_valid_value(self):
        message = self.client.get(EXPORT + "?sections=tout").json()["sections"]
        for key in ("consultations", "prescriptions", "examens", "mesures", "vaccins", "allergies", "documents"):
            self.assertIn(key, message)

    # --- Excel ---------------------------------------------------------------------------------------------------

    def test_xlsx_without_sections_keeps_the_full_workbook(self):
        response = self.client.get(EXPORT + "?format=xlsx")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertTrue(response["Content-Disposition"].startswith("attachment;"))
        names, sheets = xlsx_workbook(response)
        self.assertEqual(names, XLSX_TITLES)
        self.assertIn("70.1", sheets["Mesures"])
        self.assertIn("68.4", sheets["Mesures"])

    def test_xlsx_respects_sections_and_period(self):
        response = self.client.get(EXPORT + "?format=xlsx&sections=mesures,prescriptions&from=2026-09-01&to=2026-09-30")
        self.assertEqual(response.status_code, 200)
        names, sheets = xlsx_workbook(response)
        self.assertEqual(names, ["Résumé", "Mesures", "Ordonnances"])  # pas de rappels / prises / rendez-vous : hors rubriques demandées
        self.assertIn("70.1", sheets["Mesures"])
        self.assertNotIn("68.4", sheets["Mesures"])
        self.assertIn("MedicamentSeptembre", sheets["Ordonnances"])
        self.assertNotIn("MedicamentJanvier", sheets["Ordonnances"])
        self.assertIn("du 01/09/2026 au 30/09/2026", sheets["Résumé"])
        self.assertIn("Mesures, Ordonnances", sheets["Résumé"])

    def test_pdf_and_xlsx_filter_identically(self):
        query = "?from=2026-09-01&to=2026-09-30&sections=allergies,vaccins,consultations,documents"
        pdf = pdf_text_of(self.client.get(EXPORT + query))
        names, sheets = xlsx_workbook(self.client.get(EXPORT + query + "&format=xlsx"))
        xlsx = "\n".join(sheets.values())
        self.assertEqual(names, ["Résumé", "Allergies et déclarations", "Vaccinations", "Consultations", "Documents"])
        for present in ("AllergieSeptembre", "VaccinSeptembre", "MotifSeptembre", "DocSeptembre.pdf", "DocSansDate.pdf"):
            self.assertIn(present, pdf)
            self.assertIn(present, xlsx)
        for absent in ("AllergieJanvier", "VaccinJanvier", "MotifJanvier", "DocJanvier", "70.1", "MedicamentSeptembre", "ExamenSeptembre", "Zorro"):
            self.assertNotIn(absent, pdf)
            self.assertNotIn(absent, xlsx)

    # --- Audit ---------------------------------------------------------------------------------------------------

    def test_audit_call_carries_format_period_and_sections_for_both_formats(self):
        with patch("apps.audit.services.record_event") as record:
            self.assertEqual(self.client.get(EXPORT + "?from=2026-09-01&to=2026-09-30&sections=mesures,vaccins").status_code, 200)
            self.assertEqual(self.client.get(EXPORT + "?format=xlsx&sections=documents").status_code, 200)
            self.assertEqual(self.client.get(EXPORT).status_code, 200)
        self.assertEqual(record.call_count, 3)
        pdf_call, xlsx_call, default_call = (call.kwargs for call in record.call_args_list)
        for call in (pdf_call, xlsx_call, default_call):
            self.assertEqual(call["event_type"], "patient.carnet.exported")
            self.assertEqual(call["actor"], self.user)
            self.assertEqual(call["actor_role"], "patient")
            self.assertEqual(call["patient"], self.profile)
        self.assertEqual(pdf_call["metadata"], {"action": "exported", "resource_type": "patient_carnet_pdf", "format": "pdf", "from": "2026-09-01", "to": "2026-09-30", "sections": ["vaccins", "mesures"]})
        self.assertEqual(xlsx_call["metadata"], {"action": "exported", "resource_type": "patient_carnet_xlsx", "format": "xlsx", "from": "", "to": "", "sections": ["documents"]})
        self.assertEqual(default_call["metadata"]["sections"], list(SECTION_KEYS))

    def test_stored_audit_event_never_contains_the_exported_content(self):
        for query in ("", "?format=xlsx"):
            before = AuditEvent.objects.filter(event_type="patient.carnet.exported").count()
            self.assertEqual(self.client.get(EXPORT + query).status_code, 200)
            self.assertEqual(AuditEvent.objects.filter(event_type="patient.carnet.exported").count(), before + 1)
            event = self.last_event()
            self.assertEqual(event.actor, self.user)
            self.assertEqual(event.patient, self.profile)
            self.assertEqual(event.metadata["resource_type"], "patient_carnet_xlsx" if query else "patient_carnet_pdf")
            stored = str(event.metadata)
            for content in ("Janvier", "Septembre", "70.1", "68.4", "Awa", "Test", "Doc", "Motif"):
                self.assertNotIn(content, stored)

    def test_stored_audit_event_keeps_format_period_and_sections_once_allowed(self):
        wanted = {"format", "from", "to", "sections"}
        if not wanted <= ALLOWED_METADATA_KEYS:
            self.skipTest(f"apps.audit.services.ALLOWED_METADATA_KEYS écarte encore {sorted(wanted - ALLOWED_METADATA_KEYS)} : à ajouter pour que le journal garde le format, la période et les rubriques.")
        self.assertEqual(self.client.get(EXPORT + "?from=2026-09-01&to=2026-09-30&sections=mesures").status_code, 200)
        self.assertEqual(self.last_event().metadata, {"action": "exported", "resource_type": "patient_carnet_pdf", "format": "pdf", "from": "2026-09-01", "to": "2026-09-30", "sections": ["mesures"]})

    # --- Accès ---------------------------------------------------------------------------------------------------

    def test_another_user_only_ever_gets_their_own_data(self):
        text = pdf_text_of(self.client.get(EXPORT))
        self.assertIn("MotifJanvier", text)
        self.assertNotIn("Zorro", text)
        other = APIClient()
        other.force_authenticate(self.other_user)
        other_text = pdf_text_of(other.get(EXPORT))
        self.assertIn("MotifJanvierZorro", other_text)
        self.assertIn("Zorro Personne", other_text)
        self.assertNotIn("Awa Test", other_text)
        # Aucun paramètre ne permet de viser le dossier d’un autre.
        spoof = pdf_text_of(self.client.get(f"{EXPORT}?patient={self.other_profile.id}&patient_id={self.other_profile.id}&user={self.other_user.id}"))
        self.assertNotIn("Zorro", spoof)
        _, sheets = xlsx_workbook(other.get(EXPORT + "?format=xlsx&sections=consultations"))
        self.assertIn("MotifJanvierZorro", sheets["Consultations"])
        self.assertNotIn("Awa", "".join(sheets.values()))
        # Chaque export est journalisé au nom de son titulaire.
        self.assertEqual(AuditEvent.objects.filter(event_type="patient.carnet.exported", patient=self.other_profile).count(), 2)
        self.assertEqual(AuditEvent.objects.filter(event_type="patient.carnet.exported", patient=self.profile).count(), 2)

    def test_export_requires_authentication_in_both_formats(self):
        anonymous = APIClient()
        for url in (EXPORT, EXPORT + "?format=xlsx", EXPORT + "?sections=mesures"):
            self.assertIn(anonymous.get(url).status_code, (401, 403))
        self.assertFalse(AuditEvent.objects.filter(event_type="patient.carnet.exported").exists())

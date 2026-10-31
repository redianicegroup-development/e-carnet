"""Export Excel du carnet du patient (PAT-09) : tout le carnet, sur la période choisie.

Le classeur est écrit avec la bibliothèque standard (zipfile + XML) : aucune dépendance supplémentaire à verrouiller.
Principes : une feuille par rubrique, texte brut (aucune formule), pas de fichier joint (les documents sont listés, pas copiés),
en-têtes figés, une feuille « Résumé » qui rappelle le périmètre et la prudence à avoir avec le fichier.
"""
from __future__ import annotations

import io
import re
import zipfile
from datetime import date, datetime
from decimal import Decimal
from xml.sax.saxutils import escape

XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MAX_CELL_CHARS = 2000
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_INVALID_SHEET_CHARS = re.compile(r"[\[\]:*?/\\]")
_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")

Sheet = tuple[str, list[str], list[list]]


def _column(index: int) -> str:
    """0 → A, 25 → Z, 26 → AA."""
    name = ""
    index += 1
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return name


def _safe_text(value) -> str:
    """Texte sans caractère de contrôle ; une cellule qui commencerait par = + - @ serait lue comme une formule : on la neutralise."""
    text = _CONTROL.sub("", str(value))[:MAX_CELL_CHARS]
    return "'" + text if text.startswith(_FORMULA_START) else text


def _cell(ref: str, value, style: int = 0) -> str:
    if value is None or value == "":
        return f'<c r="{ref}" s="{style}"/>'
    if isinstance(value, bool):
        return f'<c r="{ref}" t="inlineStr" s="{style}"><is><t>{"Oui" if value else "Non"}</t></is></c>'
    if isinstance(value, (int, float, Decimal)):
        return f'<c r="{ref}" s="{style}"><v>{value}</v></c>'
    return f'<c r="{ref}" t="inlineStr" s="{style}"><is><t xml:space="preserve">{escape(_safe_text(value))}</t></is></c>'


def _sheet_title(title: str, used: set[str]) -> str:
    base = _INVALID_SHEET_CHARS.sub(" ", title).strip()[:31] or "Feuille"
    name, counter = base, 2
    while name.lower() in used:
        suffix = f" {counter}"
        name, counter = base[: 31 - len(suffix)] + suffix, counter + 1
    used.add(name.lower())
    return name


def _worksheet_xml(headers: list[str], rows: list[list]) -> str:
    widths = [min(60, max(10, len(str(h)) + 2)) for h in headers]
    for row in rows:
        for i, value in enumerate(row[: len(widths)]):
            widths[i] = min(60, max(widths[i], min(len(str(value or "")), 60) + 2))
    cols = "".join(f'<col min="{i + 1}" max="{i + 1}" width="{w}" customWidth="1"/>' for i, w in enumerate(widths))
    body = ['<row r="1">' + "".join(_cell(f"{_column(i)}1", h, 1) for i, h in enumerate(headers)) + "</row>"]
    for number, row in enumerate(rows, start=2):
        body.append(f'<row r="{number}">' + "".join(_cell(f"{_column(i)}{number}", v, 2) for i, v in enumerate(row[: len(headers)])) + "</row>")
    dimension = f"A1:{_column(max(len(headers) - 1, 0))}{len(rows) + 1}"
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<dimension ref="{dimension}"/>'
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        '<sheetFormatPr defaultRowHeight="15"/>'
        f"<cols>{cols}</cols><sheetData>{''.join(body)}</sheetData></worksheet>"
    )


_STYLES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFE3B3"/><bgColor indexed="64"/></patternFill></fill></fills>'
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>'
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
)


def build_xlsx(sheets: list[Sheet]) -> bytes:
    """Assemble un classeur .xlsx (SpreadsheetML minimal, valide pour Excel, LibreOffice et Numbers)."""
    if not sheets:
        raise ValueError("Au moins une feuille est nécessaire.")
    used: set[str] = set()
    titles = [_sheet_title(title, used) for title, _, _ in sheets]
    overrides = "".join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(1, len(sheets) + 1))
    workbook_sheets = "".join(f'<sheet name="{escape(t, {chr(34): "&quot;"})}" sheetId="{i}" r:id="rId{i}"/>' for i, t in enumerate(titles, start=1))
    rels = "".join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(1, len(sheets) + 1))
    rels += f'<Relationship Id="rId{len(sheets) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + overrides + "</Types>")
        archive.writestr("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        archive.writestr("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + workbook_sheets + "</sheets></workbook>")
        archive.writestr("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + "</Relationships>")
        archive.writestr("xl/styles.xml", _STYLES)
        for i, (_, headers, rows) in enumerate(sheets, start=1):
            archive.writestr(f"xl/worksheets/sheet{i}.xml", _worksheet_xml(headers, rows))
    return buffer.getvalue()


# ---------------------------------------------------------------------------------------------------------------------
# Contenu du carnet
# ---------------------------------------------------------------------------------------------------------------------

def parse_period(params) -> tuple[date | None, date | None]:
    """Lit ?from=AAAA-MM-JJ&to=AAAA-MM-JJ (les deux facultatifs). Lève une ValidationError DRF si la période est incohérente."""
    from rest_framework.exceptions import ValidationError

    def one(name: str) -> date | None:
        raw = str(params.get(name, "") or "").strip()
        if not raw:
            return None
        try:
            return date.fromisoformat(raw)
        except ValueError:
            raise ValidationError({name: "Date attendue au format AAAA-MM-JJ."})

    start, end = one("from"), one("to")
    if start and end and start > end:
        raise ValidationError({"to": "La date de fin doit être égale ou postérieure à la date de début."})
    return start, end


def _when(value) -> str:
    if not value:
        return ""
    if isinstance(value, datetime):
        from django.utils import timezone

        if timezone.is_aware(value):
            value = timezone.localtime(value)
        return value.strftime("%d/%m/%Y %H:%M")
    return value.strftime("%d/%m/%Y")


def _label(obj, name: str):
    getter = getattr(obj, f"get_{name}_display", None)
    return getter() if callable(getter) else getattr(obj, name, "")


def carnet_sheets(patient, start: date | None, end: date | None, *, exported_by: str, now: datetime) -> list[Sheet]:
    """Feuilles du carnet du patient. Uniquement SES données ; les consultations non validées et les fichiers joints sont exclus."""
    from django.db.models import Q

    from apps.patients.models import ClinicalDeclaration

    from .models import Appointment, Consultation, HealthMeasurement, MedicalDocument, MedicationIntake, MedicationReminder, Vaccination

    def within(qs, field: str, *, datetime_field: bool = False):
        suffix = "__date" if datetime_field else ""
        if start:
            qs = qs.filter(**{f"{field}{suffix}__gte": start})
        if end:
            qs = qs.filter(**{f"{field}{suffix}__lte": end})
        return qs

    period = (f"du {start.strftime('%d/%m/%Y')} " if start else "depuis le début ") + (f"au {end.strftime('%d/%m/%Y')}" if end else "jusqu’à aujourd’hui")
    summary: Sheet = ("Résumé", ["Information", "Valeur"], [
        ["Titulaire", patient.user.get_full_name() or patient.user.email],
        ["Période exportée", period],
        ["Exporté le", _when(now)],
        ["Exporté par", exported_by],
        ["Contenu", "Déclarations, vaccinations, mesures, consultations validées, documents (liste seulement), rappels, prises, rendez-vous."],
        ["Attention", "Ce fichier contient des informations de santé et n’est pas chiffré. Rangez-le en lieu sûr, ne l’envoyez que par un canal que vous maîtrisez et supprimez-le quand vous n’en avez plus besoin."],
        ["Provenance", "Les informations déclarées par le patient ne sont pas toutes confirmées par un professionnel : vérifiez la colonne Statut."],
    ])

    declarations = within(ClinicalDeclaration.objects.filter(patient=patient), "created_at", datetime_field=True).order_by("-created_at")
    vaccinations = within(Vaccination.objects.filter(patient=patient), "administered_on").order_by("-administered_on")
    measurements = within(HealthMeasurement.objects.filter(patient=patient), "measured_at", datetime_field=True).order_by("-measured_at")
    consultations = within(Consultation.objects.filter(patient=patient, validated_at__isnull=False), "validated_at", datetime_field=True).order_by("-validated_at")
    documents = MedicalDocument.objects.filter(patient=patient)
    if start or end:
        dated = Q(document_date__isnull=False)
        undated = Q(document_date__isnull=True)
        if start:
            dated &= Q(document_date__gte=start)
            undated &= Q(created_at__date__gte=start)
        if end:
            dated &= Q(document_date__lte=end)
            undated &= Q(created_at__date__lte=end)
        documents = documents.filter(dated | undated)
    reminders = MedicationReminder.objects.filter(patient=patient)
    if end:
        reminders = reminders.filter(starts_on__lte=end)
    if start:
        reminders = reminders.filter(Q(ends_on__isnull=True) | Q(ends_on__gte=start))
    intakes = within(MedicationIntake.objects.filter(reminder__patient=patient).select_related("reminder"), "scheduled_for", datetime_field=True).order_by("-scheduled_for")
    appointments = within(Appointment.objects.filter(patient=patient), "starts_at", datetime_field=True).order_by("-starts_at")

    return [
        summary,
        ("Déclarations", ["Type", "Libellé", "Détails", "Statut", "Ajouté le"],
         [[_label(d, "kind"), d.label, d.details, _label(d, "status"), _when(d.created_at)] for d in declarations]),
        ("Vaccinations", ["Vaccin", "Dose", "Date", "Prochain rappel", "Lieu", "Professionnel", "Statut", "Notes"],
         [[v.vaccine_name, v.dose_number, _when(v.administered_on), _when(v.next_due_on), v.facility, v.professional, _label(v, "status"), v.notes] for v in vaccinations]),
        ("Mesures", ["Mesure", "Valeur", "Unité", "Source", "Date", "Note"],
         [[_label(m, "kind"), m.raw_value or (str(m.value) if m.value is not None else ""), m.unit, _label(m, "source"), _when(m.measured_at), m.note] for m in measurements]),
        ("Consultations", ["Validée le", "Professionnel", "Établissement", "Motif", "Diagnostic", "Conclusion"],
         [[_when(c.validated_at), c.professional_name, c.facility_label, c.reason, c.diagnosis, c.conclusion] for c in consultations]),
        ("Documents", ["Nom du fichier", "Type", "Date du document", "Émetteur", "Vérifié", "Ajouté le"],
         [[d.original_name, _label(d, "document_type"), _when(d.document_date), d.issuer, bool(d.verified), _when(d.created_at)] for d in documents.order_by("-created_at")]),
        ("Rappels médicaments", ["Médicament", "Dosage", "Consignes", "Heures", "Début", "Fin", "Actif"],
         [[r.name, r.dosage, r.instructions, ", ".join(str(t) for t in (r.times or [])), _when(r.starts_on), _when(r.ends_on), bool(r.active)] for r in reminders.order_by("-starts_on")]),
        ("Prises", ["Médicament", "Prévue le", "Statut", "Enregistrée le"],
         [[i.reminder.name, _when(i.scheduled_for), _label(i, "status"), _when(i.recorded_at)] for i in intakes]),
        ("Rendez-vous", ["Date", "Motif", "Statut"],
         [[_when(a.starts_at), a.reason, _label(a, "status")] for a in appointments]),
    ]


def carnet_xlsx_response(request):
    """Réponse HTTP de l'export (GET /patient/care/export/?format=xlsx&from=…&to=…). Journalisé, jamais mis en cache."""
    from django.http import HttpResponse
    from django.utils import timezone

    from apps.audit.services import record_event
    from apps.patients.views import patient_actor_role, profile_for

    patient = profile_for(request.user, request)
    start, end = parse_period(request.query_params)
    now = timezone.now()
    content = build_xlsx(carnet_sheets(patient, start, end, exported_by=request.user.get_full_name() or request.user.email, now=now))
    record_event(
        event_type="patient.carnet.exported",
        actor=request.user,
        actor_role=patient_actor_role(request),
        patient=patient,
        metadata={"action": "exported", "resource_type": "patient_carnet_xlsx", "from": start.isoformat() if start else "", "to": end.isoformat() if end else ""},
    )
    response = HttpResponse(content, content_type=XLSX_CONTENT_TYPE)
    response["Content-Disposition"] = f'attachment; filename="carnet-sante-{timezone.localdate(now).isoformat()}.xlsx"'
    response["Cache-Control"] = "private, no-store"
    return response

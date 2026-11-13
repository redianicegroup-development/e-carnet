"""Export PDF du carnet du patient (PAT-09) : mise en page reportlab platypus, sur la période et les rubriques choisies.

Le contenu des rubriques vient de export_filters.carnet_sections, la même fonction que le classeur Excel : les deux formats filtrent à l’identique.
Principes : polices standard (Helvetica, jeu cp1252 : é è ç œ… s’affichent) ; un caractère hors cp1252 devient « ? » au lieu de faire échouer l’export ;
tout texte venu d’un utilisateur est échappé avant d’entrer dans un Paragraph (un libellé « <b>&… » ne casse pas la mise en page) ;
aucun fichier joint (les documents sont listés), aucune dépendance supplémentaire.
"""
from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime
from io import BytesIO
from xml.sax.saxutils import escape

from .export_filters import ExportSection, carnet_sections, describe_period, export_audit_metadata, format_when, parse_export_filters, patient_display_name

PDF_CONTENT_TYPE = "application/pdf"
PDF_TITLE = "Mon E-Carnet — export du carnet"
PDF_FOOTER = "Document personnel non chiffré. Vérifiez la date et la provenance des informations."
EMPTY_SECTION = "Aucune donnée sur cette période"
# Garde-fou : un PDF de plusieurs milliers de lignes serait illisible et coûteux à produire. Au-delà, on le dit (jamais en silence).
MAX_ROWS_PER_SECTION = 500

_CONTROL = re.compile(r"[\x00-\x09\x0b-\x1f\x7f]")


def pdf_text(value) -> str:
    """Texte que les polices standard savent écrire : NFC, caractères de contrôle retirés, tout caractère hors cp1252 remplacé par « ? »
    (après un essai de forme de compatibilité : « SpO₂ » donne « SpO2 », « ﬁ » donne « fi »). Ne lève jamais d’exception."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Oui" if value else "Non"
    text = unicodedata.normalize("NFC", str(value).replace("\r\n", "\n").replace("\r", "\n").replace("\t", " "))
    text = _CONTROL.sub("", text)
    try:
        text.encode("cp1252")
        return text
    except UnicodeEncodeError:
        pass
    safe = []
    for char in text:
        for candidate in (char, unicodedata.normalize("NFKC", char)):
            try:
                candidate.encode("cp1252")
            except UnicodeEncodeError:
                continue
            safe.append(candidate)
            break
        else:
            safe.append("?")
    return "".join(safe)


def pdf_markup(value) -> str:
    """Texte utilisateur → balisage sûr pour un Paragraph : échappé (& < >), les retours à la ligne deviennent <br/>."""
    return escape(pdf_text(value)).replace("\n", "<br/>")


def _column_widths(headers: list[str], rows: list[list], total: float, font_size: float = 7.5) -> list[float]:
    """Largeurs de colonnes en points : chacune au moins aussi large que le plus long mot de son en-tête (« Établissement » ne se coupe pas) et
    qu’une date ou un statut courant ; le reste de la place est réparti selon la longueur du contenu (plafonnée, pour qu’une colonne de
    texte long n’écrase pas les autres)."""
    from reportlab.pdfbase.pdfmetrics import stringWidth

    padding, glyph = 8, font_size * 0.56
    minimum, wanted = [], []
    for index, header in enumerate(headers):
        texts = [pdf_text(row[index]) for row in rows if index < len(row)]
        word = max((stringWidth(pdf_text(part), "Helvetica-Bold", font_size) for part in header.split()), default=0)
        token = max((len(part) for text in texts for part in text.split()), default=0)
        longest = max((len(text) for text in texts), default=0)
        low = max(word, min(token, 12) * glyph) + padding
        minimum.append(low)
        wanted.append(max(low, min(max(longest, len(header)), 40) * glyph + padding))
    if sum(minimum) >= total:
        return [width * total / sum(minimum) for width in minimum]
    if sum(wanted) <= total:
        return [width * total / sum(wanted) for width in wanted]
    spare, room = total - sum(minimum), sum(wanted) - sum(minimum)
    return [low + spare * (high - low) / room for low, high in zip(minimum, wanted)]


def carnet_pdf_bytes(patient, sections: list[ExportSection], start: date | None, end: date | None, *, now: datetime) -> bytes:
    """Le PDF du carnet : en-tête, un bloc par rubrique (tableau ou « Aucune donnée sur cette période »), pagination « Page x / y » et pied de page."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.platypus import CondPageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    margin = 18 * mm
    ink, muted, accent, rule = colors.HexColor("#1F2933"), colors.HexColor("#5B6770"), colors.HexColor("#FFE3B3"), colors.HexColor("#C9C4BA")
    title_style = ParagraphStyle("Title", fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=ink, spaceAfter=8)
    info_style = ParagraphStyle("Info", fontName="Helvetica", fontSize=9.5, leading=13, textColor=ink)
    heading_style = ParagraphStyle("Heading", fontName="Helvetica-Bold", fontSize=12.5, leading=16, textColor=ink, spaceBefore=6, spaceAfter=5)
    head_cell = ParagraphStyle("HeadCell", fontName="Helvetica-Bold", fontSize=7.5, leading=9, textColor=ink)
    body_cell = ParagraphStyle("BodyCell", fontName="Helvetica", fontSize=7.5, leading=9.5, textColor=ink)
    note_style = ParagraphStyle("Note", fontName="Helvetica-Oblique", fontSize=8.5, leading=11, textColor=muted, spaceBefore=3)

    class NumberedCanvas(canvas.Canvas):
        """Écrit « Page x / y » et le pied de page à la fin, quand le nombre total de pages est connu."""

        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._saved_states = []

        def showPage(self):
            self._saved_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self._saved_states)
            for state in self._saved_states:
                self.__dict__.update(state)
                self.setStrokeColor(rule)
                self.setLineWidth(0.5)
                self.line(margin, 15 * mm, A4[0] - margin, 15 * mm)
                self.setFillColor(muted)
                self.setFont("Helvetica-Oblique", 7.5)
                self.drawString(margin, 10.5 * mm, PDF_FOOTER)
                self.setFont("Helvetica", 8)
                self.drawRightString(A4[0] - margin, 10.5 * mm, f"Page {self._pageNumber} / {total}")
                super().showPage()
            super().save()

    width = A4[0] - 2 * margin
    infos = [
        ("Titulaire", patient_display_name(patient)),
        ("Généré le", f"{format_when(now, date_only=True)} à {format_when(now)[-5:]}"),
        ("Période", describe_period(start, end)),
        ("Sections incluses", ", ".join(section.title for section in sections) or "aucune"),
    ]
    info_table = Table(
        [[Paragraph(f"<b>{pdf_markup(label)} :</b>", info_style), Paragraph(pdf_markup(value), info_style)] for label, value in infos],
        colWidths=[34 * mm, width - 34 * mm],
        style=TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1)]),
        hAlign="LEFT",
    )
    story = [Paragraph(pdf_markup(PDF_TITLE), title_style), info_table, Spacer(1, 4)]

    for section in sections:
        # Pas de titre orphelin en bas de page : sous 40 mm de place restante, la rubrique commence sur la page suivante.
        story.append(CondPageBreak(40 * mm))
        story.append(Paragraph(pdf_markup(section.title), heading_style))
        if not section.rows:
            story.append(Paragraph(pdf_markup(EMPTY_SECTION), note_style))
            continue
        shown = section.rows[:MAX_ROWS_PER_SECTION]
        data = [[Paragraph(pdf_markup(header), head_cell) for header in section.headers]]
        for row in shown:
            data.append([Paragraph(pdf_markup(row[i] if i < len(row) else ""), body_cell) for i in range(len(section.headers))])
        story.append(Table(
            data,
            colWidths=_column_widths(section.headers, shown, width),
            repeatRows=1,
            splitInRow=1,
            hAlign="LEFT",
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), accent),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAF7F2")]),
                ("GRID", (0, 0), (-1, -1), 0.4, rule),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ]),
        ))
        if len(section.rows) > len(shown):
            story.append(Paragraph(pdf_markup(f"Affichage limité aux {len(shown)} entrées les plus récentes sur {len(section.rows)} : réduisez la période pour voir le reste."), note_style))

    buffer = BytesIO()
    SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=margin, rightMargin=margin, topMargin=margin, bottomMargin=22 * mm,
        title=pdf_text(PDF_TITLE), author="Mon E-Carnet", creator="Mon E-Carnet",
    ).build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()


def carnet_pdf_response(request):
    """Réponse HTTP de l'export (GET /patient/care/export/?from=…&to=…&sections=…). Journalisé, jamais mis en cache."""
    from django.http import HttpResponse
    from django.utils import timezone

    from apps.audit.services import record_event
    from apps.patients.views import patient_actor_role, profile_for

    start, end, sections = parse_export_filters(request.query_params)
    patient = profile_for(request.user, request)
    now = timezone.now()
    content = carnet_pdf_bytes(patient, carnet_sections(patient, start, end, sections), start, end, now=now)
    record_event(
        event_type="patient.carnet.exported",
        actor=request.user,
        actor_role=patient_actor_role(request),
        patient=patient,
        metadata=export_audit_metadata("pdf", start, end, sections),
    )
    response = HttpResponse(content, content_type=PDF_CONTENT_TYPE)
    response["Content-Disposition"] = f'attachment; filename="carnet-sante-{timezone.localdate(now).isoformat()}.pdf"'
    response["Cache-Control"] = "private, no-store"
    return response

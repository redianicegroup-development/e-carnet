"""Ordonnance en PDF (A4), dans la même mise en page que la feuille affichée dans le carnet.

Le contenu vient de `build_prescription_context` : le PDF et la feuille ne peuvent pas dire deux choses différentes.
Rien n'est téléchargé ici : les images du cachet et de la signature du médecin sont fournies par l'appelant, et le logo de
l'établissement (une URL saisie dans ses réglages) n'est jamais suivi — à sa place, un monogramme dessiné avec ses initiales.
Le cachet rond de l'établissement est dessiné en vectoriel (comme à l'écran) : il porte le nom, la ville et la date de validation."""
from __future__ import annotations

import math
import re
from datetime import datetime, timezone as dt_timezone
from html import escape
from io import BytesIO
from pathlib import Path

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Flowable, Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

INK = colors.HexColor("#1d2b27")
GREEN = colors.HexColor("#2f6f5c")
DEEP = colors.HexColor("#1e3a34")
MUTED = colors.HexColor("#5b6a65")
SOFT = colors.HexColor("#3d4c47")
RULE = colors.HexColor("#c9d3cf")
DOT = colors.HexColor("#9fb0aa")
SEAL_INK = colors.HexColor("#1f4e8c")
PANEL = colors.HexColor("#f8faf9")
NEXT_PANEL = colors.HexColor("#f1f6f4")

MARGIN_X = 18 * mm
FRAME_WIDTH = A4[0] - 2 * MARGIN_X
SEX_LABELS = {"female": "Femme", "male": "Homme"}
SEAL_NAME_MAX = 34
STOP_WORDS = re.compile(r"^(de|du|des|la|le|les|et)$", re.IGNORECASE)


def register_fonts() -> tuple[str, str]:
    """DejaVu (accents, guillemets, tirets) quand il est installé ; sinon Helvetica, qui couvre aussi le français."""
    font_dir = Path("/usr/share/fonts/truetype/dejavu")
    regular, bold = font_dir / "DejaVuSans.ttf", font_dir / "DejaVuSans-Bold.ttf"
    if regular.exists() and bold.exists():
        known = pdfmetrics.getRegisteredFontNames()
        if "ECarnetSans" not in known:
            pdfmetrics.registerFont(TTFont("ECarnetSans", str(regular)))
        if "ECarnetSans-Bold" not in known:
            pdfmetrics.registerFont(TTFont("ECarnetSans-Bold", str(bold)))
        return "ECarnetSans", "ECarnetSans-Bold"
    return "Helvetica", "Helvetica-Bold"


def monogram(name: str) -> str:
    """Mêmes initiales que le monogramme affiché à l'écran : deux premiers mots utiles du nom."""
    words = [word for word in re.sub(r"[’']", " ", name).split() if (len(word) > 2 or word[:1].isupper()) and not STOP_WORDS.match(word)]
    return ("".join(word[0] for word in words[:2]) or name[:2]).upper()


def french_date(value: datetime) -> str:
    return value.strftime("%d/%m/%Y")


def carnet_date(value: datetime) -> str:
    """« 21/11/26 » : la date courte du carnet papier, comme sur le cachet à l'écran."""
    return value.strftime("%d/%m/%y")


class Monogram(Flowable):
    """Pastille verte avec les initiales de l'établissement (à défaut de logo)."""

    def __init__(self, text: str, size: float, font: str):
        super().__init__()
        self.text, self.size, self.font = text, size, font

    def wrap(self, _width, _height):
        return self.size, self.size

    def draw(self):
        canvas, radius = self.canv, self.size / 2
        canvas.setFillColor(GREEN)
        canvas.circle(radius, radius, radius, stroke=0, fill=1)
        canvas.setFillColor(colors.white)
        font_size = self.size * 0.36
        canvas.setFont(self.font, font_size)
        canvas.drawCentredString(radius, radius - font_size * 0.35, self.text)


class DoubleRule(Flowable):
    """Filet d'en-tête : un trait épais et un trait fin, comme sous le papier à en-tête."""

    def wrap(self, width, _height):
        self.width = width
        return width, 7

    def draw(self):
        canvas = self.canv
        canvas.setStrokeColor(GREEN)
        canvas.setLineWidth(2)
        canvas.line(0, 5.5, self.width, 5.5)
        canvas.setLineWidth(0.6)
        canvas.line(0, 0.6, self.width, 0.6)


class TitleRule(Flowable):
    """« ORDONNANCE MÉDICALE » espacé, centré entre deux filets."""

    def __init__(self, text: str, font: str):
        super().__init__()
        self.text, self.font = text, font

    def wrap(self, width, _height):
        self.width = width
        return width, 16

    def draw(self):
        canvas, size, spacing, gap = self.canv, 9.5, 2.8, 10
        text_width = pdfmetrics.stringWidth(self.text, self.font, size) + spacing * (len(self.text) - 1)
        middle = self.width / 2
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.6)
        canvas.line(0, 5, max(0, middle - text_width / 2 - gap), 5)
        canvas.line(min(self.width, middle + text_width / 2 + gap), 5, self.width, 5)
        text = canvas.beginText(middle - text_width / 2, 2.2)
        text.setFont(self.font, size)
        text.setCharSpace(spacing)
        text.setFillColor(GREEN)
        text.textOut(self.text)
        canvas.drawText(text)


class PinToBottom(Flowable):
    """Ligne de signature collée en bas de la dernière feuille, comme au bas d'une ordonnance papier.
    Elle prend la hauteur restante de la page ; si elle ne tient pas, elle passe d'un seul bloc sur la feuille suivante."""

    def __init__(self, parts: list):
        super().__init__()
        self.parts = parts
        self._sizes: list[tuple[float, float]] = []
        self._need = 0.0
        self._width = 0.0

    def wrap(self, width, height):
        self._width = width
        self._sizes = [part.wrap(width, height) for part in self.parts]
        self._need = sum(size[1] for size in self._sizes)
        return width, (height - 1 if self._need <= height - 1 else self._need)

    def draw(self):
        top = self._need
        for part, (part_width, part_height) in zip(self.parts, self._sizes):
            top -= part_height
            offset = self._width - part_width if getattr(part, "hAlign", "LEFT") == "RIGHT" else 0
            part.drawOn(self.canv, offset, top)


class EstablishmentSealFlowable(Flowable):
    """Cachet électronique de l'établissement : double filet, nom en haut, ville en bas, « VALIDÉ » et la date au centre.
    Même dessin que sur l'écran (repère de 120 unités), à l'encre bleue du cachet."""

    def __init__(self, name: str, city: str, validated_on: datetime, size: float, font: str):
        super().__init__()
        label = (name or "Établissement").strip().upper()
        self.top = label if len(label) <= SEAL_NAME_MAX else label[: SEAL_NAME_MAX - 1].rstrip() + "…"
        self.bottom = (city or "").strip().upper() or "MON E‑CARNET"
        self.date_label = carnet_date(validated_on)
        self.size, self.font = size, font

    def wrap(self, _width, _height):
        return self.size, self.size

    def _arc_text(self, text: str, font_size: float, radius: float, *, top: bool, center: float, unit: float):
        canvas = self.canv
        spacing = 0.6 * unit
        widths = [pdfmetrics.stringWidth(char, self.font, font_size) + spacing for char in text]
        span = sum(widths) / radius
        walked = 0.0
        for char, width in zip(text, widths):
            walked += width / 2
            if top:
                angle = math.pi / 2 + span / 2 - walked / radius
                rotation = math.degrees(angle) - 90
            else:
                angle = 3 * math.pi / 2 - span / 2 + walked / radius
                rotation = math.degrees(angle) + 90
            canvas.saveState()
            canvas.translate(center + radius * math.cos(angle), center + radius * math.sin(angle))
            canvas.rotate(rotation)
            canvas.setFont(self.font, font_size)
            canvas.drawCentredString(0, 0, char)
            canvas.restoreState()
            walked += width / 2

    def draw(self):
        canvas, unit = self.canv, self.size / 120
        center = self.size / 2
        canvas.setStrokeColor(SEAL_INK)
        canvas.setFillColor(SEAL_INK)
        for radius, weight in ((57, 2.4), (52, 0.9), (37, 1.2)):
            canvas.setLineWidth(weight * unit)
            canvas.circle(center, center, radius * unit, stroke=1, fill=0)
        top_size = max(5.2, min(9, 170 / len(self.top))) * unit
        bottom_size = max(5.2, min(8, 120 / len(self.bottom))) * unit
        self._arc_text(self.top, top_size, 40 * unit, top=True, center=center, unit=unit)
        self._arc_text(self.bottom, bottom_size, 50 * unit, top=False, center=center, unit=unit)
        canvas.setFont(self.font, 11.5 * unit)
        canvas.drawCentredString(center, center + 2 * unit, "VALIDÉ")
        canvas.setFont(self.font, 9 * unit)
        canvas.drawCentredString(center, center - 12 * unit, self.date_label)
        canvas.setLineWidth(3 * unit)
        canvas.setLineCap(1)
        canvas.setLineJoin(1)
        check = canvas.beginPath()
        check.moveTo(center + (52 - 60) * unit, center - (41 - 60) * unit)
        check.lineTo(center + (57 - 60) * unit, center - (46 - 60) * unit)
        check.lineTo(center + (68 - 60) * unit, center - (34 - 60) * unit)
        canvas.drawPath(check, stroke=1, fill=0)
        canvas.setFillColor(SEAL_INK)
        for x in (21, 99):
            canvas.circle(center + (x - 60) * unit, center, 1.6 * unit, stroke=0, fill=1)


def paragraph_styles(base: str, bold: str) -> dict[str, ParagraphStyle]:
    def style(name: str, **kwargs) -> ParagraphStyle:
        return ParagraphStyle(name=name, fontName=kwargs.pop("fontName", base), textColor=kwargs.pop("textColor", INK), **kwargs)

    return {
        "name": style("RxName", fontName=bold, fontSize=14, leading=16.5, textColor=DEEP),
        "type": style("RxType", fontName=bold, fontSize=8.5, leading=11, textColor=GREEN),
        "tagline": style("RxTagline", fontSize=8, leading=10.5, textColor=MUTED),
        "contact": style("RxContact", fontSize=8, leading=11, alignment=TA_RIGHT, textColor=SOFT),
        "meta": style("RxMeta", fontSize=9.2, leading=12.6, alignment=TA_LEFT, textColor=SOFT),
        "meta_end": style("RxMetaEnd", fontSize=9.2, leading=12.6, alignment=TA_RIGHT, textColor=SOFT),
        "patient_label": style("RxPatientLabel", fontName=bold, fontSize=7.2, leading=11, textColor=MUTED),
        "patient": style("RxPatient", fontName=bold, fontSize=11, leading=14),
        "facts": style("RxFacts", fontSize=9.2, leading=13, alignment=TA_RIGHT),
        "rp": style("RxRp", fontName="Times-BoldItalic", fontSize=22, leading=24, textColor=GREEN),
        "number": style("RxNumber", fontName=bold, fontSize=10.5, leading=14, textColor=GREEN),
        "drug": style("RxDrug", fontSize=10.8, leading=14.4),
        "how": style("RxHow", fontSize=9.8, leading=13.4),
        "note": style("RxNote", fontSize=8.6, leading=11.6, textColor=MUTED),
        "next": style("RxNext", fontSize=9, leading=12),
        "signed": style("RxSigned", fontSize=7.4, leading=10, textColor=MUTED),
        "caption": style("RxCaption", fontName=bold, fontSize=6.8, leading=8.4, alignment=TA_CENTER, textColor=MUTED),
        "foot": style("RxFoot", fontSize=7.4, leading=9.6, alignment=TA_CENTER, textColor=SOFT),
    }


def build_prescription_pdf(data: dict, images: list[tuple[str, bytes]]) -> bytes:
    """`images` : [("stamp" | "signature", octets PNG)] — ceux figés à la signature, ou à défaut ceux du profil du médecin."""
    base, bold = register_fonts()
    styles = paragraph_styles(base, bold)
    place, prescriber, patient = data["establishment"], data["prescriber"], data["patient"]
    issued = datetime.fromisoformat(data["issued_on"])
    signed_at = datetime.fromisoformat(data["signed_at"]).astimezone(dt_timezone.utc) if data.get("signed_at") else None
    story: list = []

    # En-tête de l'établissement : monogramme, nom, type, texte d'en-tête ; coordonnées à droite.
    identity = [Paragraph(escape(place["name"] or "Établissement"), styles["name"])]
    if place["type"]:
        identity.append(Paragraph(escape(place["type"]), styles["type"]))
    if place["header_text"]:
        identity.append(Paragraph(escape(place["header_text"]).replace("\n", "<br/>"), styles["tagline"]))
    brand = Table([[Monogram(monogram(place["name"] or "Établissement"), 13 * mm, bold), identity]], colWidths=(16 * mm, FRAME_WIDTH * 0.62 - 16 * mm))
    brand.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    contact_lines = [escape(place["address"])] if place["address"] else []
    if place["phone"]:
        contact_lines.append(f"Tél : {escape(place['phone'])}")
    if place["email"]:
        contact_lines.append(escape(place["email"]))
    letterhead = Table([[brand, Paragraph("<br/>".join(contact_lines), styles["contact"]) if contact_lines else ""]], colWidths=(FRAME_WIDTH * 0.62, FRAME_WIDTH * 0.38))
    letterhead.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    story.extend([letterhead, Spacer(1, 8), DoubleRule(), Spacer(1, 8)])

    # Prescripteur à gauche ; lieu, date et numéro à droite.
    title_line = " · ".join(part for part in (prescriber["title"], prescriber["specialty"]) if part)
    left = f"<font name='{bold}' size='10.5' color='#1e3a34'>{escape(prescriber['name'])}</font>"
    if title_line:
        left += f"<br/>{escape(title_line)}"
    if prescriber["order_number"]:
        left += f"<br/>N° d’ordre : {escape(prescriber['order_number'])}"
    place_prefix = f"{escape(place['city'])}, le " if place["city"] else "Le "
    right = f"{place_prefix}{french_date(issued)}<br/>Ordonnance n° {escape(data['reference'])}"
    meta = Table([[Paragraph(left, styles["meta"]), Paragraph(right, styles["meta_end"])]], colWidths=(FRAME_WIDTH * 0.58, FRAME_WIDTH * 0.42))
    meta.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    story.extend([meta, Spacer(1, 9)])

    # Patient : nom, puis âge, sexe et poids (utiles à la dispensation, surtout chez l'enfant).
    facts = []
    if patient["age_years"] is not None:
        facts.append(f"Âge <b>{patient['age_years']} {'ans' if patient['age_years'] > 1 else 'an'}</b>")
    if patient["sex"] in SEX_LABELS:
        facts.append(f"Sexe <b>{SEX_LABELS[patient['sex']]}</b>")
    if patient["weight"]:
        facts.append(f"Poids <b>{escape(patient['weight'])}</b>")
    patient_name = Paragraph(f"<font name='{bold}' size='7.2' color='#5b6a65'>PATIENT</font>&nbsp;&nbsp;{escape(patient['name'])}", styles["patient"])
    patient_row = [[patient_name, Paragraph("&nbsp;&nbsp;·&nbsp;&nbsp;".join(facts), styles["facts"]) if facts else ""]]
    patient_box = Table(patient_row, colWidths=(FRAME_WIDTH * 0.52, FRAME_WIDTH * 0.48))
    patient_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PANEL), ("BOX", (0, 0), (-1, -1), 0.6, RULE), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([patient_box, Spacer(1, 12), TitleRule("ORDONNANCE MÉDICALE", bold), Spacer(1, 4), Paragraph("Rp/", styles["rp"]), Spacer(1, 4)])

    # Lignes numérotées : médicament et dosage en gras, posologie et durée, conseil en italique. Chaque ligne reste d'un seul tenant.
    for index, line in enumerate(data["lines"], 1):
        head = f"<b>{escape(line['drug_name'])}</b>" + (f" · {escape(line['dosage'])}" if line["dosage"] else "")
        content = [Paragraph(head, styles["drug"])]
        how = " — ".join(part for part in (line["posology"], line["duration"]) if part)
        if how:
            content.append(Paragraph(escape(how), styles["how"]))
        if line["instructions"]:
            content.append(Paragraph(f"<i>{escape(line['instructions'])}</i>", styles["note"]))
        row = Table([[Paragraph(str(index), styles["number"]), content]], colWidths=(8 * mm, FRAME_WIDTH - 8 * mm))
        row.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 6), ("LINEBELOW", (0, 0), (-1, -1), 0.6, DOT, 1, (1, 2.5)),
        ]))
        story.extend([row, Spacer(1, 5)])

    if data.get("next_appointment"):
        when = timezone.localtime(datetime.fromisoformat(data["next_appointment"]))
        next_box = Table([[Paragraph(f"<font name='{bold}' color='#2f6f5c'>Prochain rendez-vous</font>&nbsp;&nbsp;{when.strftime('%d/%m/%Y à %H:%M')}", styles["next"])]], colWidths=(FRAME_WIDTH,))
        next_box.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), NEXT_PANEL), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
        story.extend([Spacer(1, 4), next_box])

    # Ligne de signature : cachet de l'établissement, puis cachet et signature du médecin (ou un emplacement vide à remplir à la main).
    when_signed = f" le {signed_at.strftime('%d/%m/%Y à %H:%M')} UTC" if signed_at else ""
    signed_line = Paragraph(f"Signée électroniquement dans Mon E‑Carnet par {escape(prescriber['name'])}{when_signed} · réf. {escape(data['reference'])}", styles["signed"])
    seal_date = signed_at or issued
    mark_height = 30 * mm
    top_row: list = [EstablishmentSealFlowable(place["name"], place["city"], seal_date, mark_height - 2 * mm, bold)]
    captions: list = [Paragraph("Cachet de l’établissement", styles["caption"])]
    for kind, label in (("stamp", "Cachet du médecin"), ("signature", "Signature du médecin")):
        content = next((raw for found, raw in images if found == kind), None)
        if not content:
            continue
        picture = Image(BytesIO(content))
        picture._restrictSize(42 * mm, 24 * mm)
        top_row.append(picture)
        captions.append(Paragraph(label, styles["caption"]))
    if len(top_row) == 1:
        top_row.append("")
        captions.append(Paragraph("Cachet et signature du médecin", styles["caption"]))
    slot_width = 46 * mm
    slots = Table([top_row, captions], colWidths=[slot_width] * len(top_row), rowHeights=[mark_height, None], hAlign="RIGHT")
    slot_style = [("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, 0), "BOTTOM"), ("VALIGN", (0, 1), (-1, 1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, 0), 2), ("TOPPADDING", (0, 1), (-1, 1), 3)]
    slot_style.extend(("LINEBELOW", (column, 0), (column, 0), 0.7, INK) for column in range(1, len(top_row)))
    slots.setStyle(TableStyle(slot_style))
    story.append(PinToBottom([Spacer(1, 14), signed_line, Spacer(1, 6), slots]))

    footer_text = " ".join((place.get("footer_text") or "").split())
    if len(footer_text) > 240:
        footer_text = footer_text[:239].rstrip() + "…"

    def decorate(canvas, document):
        """Pied de page de chaque feuille (texte de l'établissement, origine, numéro) ; rappel du patient et de la référence dès la page 2."""
        canvas.saveState()
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.6)
        canvas.line(MARGIN_X, 22 * mm, A4[0] - MARGIN_X, 22 * mm)
        if footer_text:
            footer_paragraph = Paragraph(escape(footer_text), styles["foot"])
            _, height = footer_paragraph.wrapOn(canvas, FRAME_WIDTH, 12 * mm)
            footer_paragraph.drawOn(canvas, MARGIN_X, 22 * mm - 2 * mm - height)
        canvas.setFont(base, 6.8)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN_X, 8 * mm, "Document généré depuis Mon E‑Carnet — contenu saisi et signé par le prescripteur.")
        canvas.drawRightString(A4[0] - MARGIN_X, 8 * mm, f"Page {document.page}")
        if document.page > 1:
            canvas.setFont(bold, 7.6)
            canvas.drawString(MARGIN_X, A4[1] - 10 * mm, f"Ordonnance n° {data['reference']} — {patient['name']} — {french_date(issued)}")
        canvas.restoreState()

    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=MARGIN_X, rightMargin=MARGIN_X, topMargin=16 * mm, bottomMargin=28 * mm,
        title="Ordonnance médicale", author=place["name"] or "Mon E‑Carnet",
    )
    document.build(story, onFirstPage=decorate, onLaterPages=decorate)
    return buffer.getvalue()

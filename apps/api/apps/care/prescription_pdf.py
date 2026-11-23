"""Ordonnance en PDF (A4), dans la même mise en page que la feuille affichée dans le carnet.

Modèle simple, celui d'une ordonnance papier : logo en haut à gauche, en-tête de l'établissement au centre, ses coordonnées à droite ; nom du patient ;
« ORDONNANCE MÉDICALE » encadré ; les médicaments ; en bas, la signature du professionnel et le cachet de l'établissement, puis le pied de page.
Le contenu vient de `build_prescription_context` : le PDF et la feuille ne peuvent pas dire deux choses différentes.
Rien n'est téléchargé ici : les images (cachet, signature, logo) sont fournies par l'appelant. Sans scan du cachet de l'établissement, le cachet rond
électronique (dessiné en vectoriel, comme à l'écran) porte le nom, la ville et la date de validation ; sans logo, un monogramme avec ses initiales."""
from __future__ import annotations

import math
import re
from datetime import datetime, timezone as dt_timezone
from html import escape
from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Flowable, HRFlowable, Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

INK = colors.HexColor("#1d2b27")
GREEN = colors.HexColor("#2f6f5c")
DEEP = colors.HexColor("#1e3a34")
MUTED = colors.HexColor("#5b6a65")
SOFT = colors.HexColor("#3d4c47")
RULE = colors.HexColor("#c9d3cf")
DOT = colors.HexColor("#9fb0aa")
SEAL_INK = colors.HexColor("#1f4e8c")

MARGIN_X = 18 * mm
FRAME_WIDTH = A4[0] - 2 * MARGIN_X
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
        "name": style("RxName", fontName=bold, fontSize=13, leading=15.5, alignment=TA_CENTER, textColor=DEEP),
        "type": style("RxType", fontName=bold, fontSize=8.5, leading=11, alignment=TA_CENTER, textColor=GREEN),
        "tagline": style("RxTagline", fontSize=8.2, leading=10.8, alignment=TA_CENTER, textColor=MUTED),
        "contact": style("RxContact", fontSize=8, leading=11, alignment=TA_RIGHT, textColor=SOFT),
        "date": style("RxDate", fontSize=9.4, leading=13, alignment=TA_RIGHT, textColor=SOFT),
        "patient": style("RxPatient", fontSize=11.5, leading=15),
        "title": style("RxTitle", fontName=bold, fontSize=14, leading=18, alignment=TA_CENTER, textColor=DEEP),
        "number": style("RxNumber", fontName=bold, fontSize=10.5, leading=14, textColor=GREEN),
        "drug": style("RxDrug", fontSize=10.8, leading=14.4),
        "how": style("RxHow", fontSize=9.8, leading=13.4),
        "note": style("RxNote", fontSize=8.6, leading=11.6, textColor=MUTED),
        "signed": style("RxSigned", fontSize=7.4, leading=10, textColor=MUTED),
        "caption": style("RxCaption", fontName=bold, fontSize=6.8, leading=8.4, alignment=TA_CENTER, textColor=MUTED),
        "who": style("RxWho", fontSize=7.6, leading=10, alignment=TA_CENTER, textColor=SOFT),
        "foot": style("RxFoot", fontSize=7.8, leading=10, alignment=TA_CENTER, textColor=SOFT),
    }


ZERO_PADDING = [("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]


def mark_slot(marks: list, caption: str, details: str, width: float, mark_height: float, styles: dict) -> Table:
    """Un emplacement de la ligne de signature : les marques (images ou cachet dessiné) sur leur ligne, la légende, puis le texte d'identité."""
    cells = marks or [""]
    each = width / len(cells)
    for mark in cells:
        if isinstance(mark, Image):
            mark._restrictSize(each - 6, mark_height - 4)
    strip = Table([cells], colWidths=[each] * len(cells), rowHeights=[mark_height])
    strip.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "BOTTOM"), ("LINEBELOW", (0, 0), (-1, 0), 0.7, INK), *ZERO_PADDING]))
    rows = [[strip], [Paragraph(caption, styles["caption"])]]
    if details:
        rows.append([Paragraph(details, styles["who"])])
    slot = Table(rows, colWidths=[width])
    slot.setStyle(TableStyle([("TOPPADDING", (0, 1), (-1, -1), 3), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    return slot


def build_prescription_pdf(data: dict, images: list[tuple[str, bytes]], logo: bytes | None = None) -> bytes:
    """`images` : [(kind, octets PNG)] avec kind ∈ stamp | signature (le professionnel) et establishment-stamp | establishment-signature (la structure),
    tels que figés à la signature de la consultation. `logo` : PNG du logo de la structure, ou rien (monogramme à la place)."""
    base, bold = register_fonts()
    styles = paragraph_styles(base, bold)
    place, prescriber, patient = data["establishment"], data["prescriber"], data["patient"]
    issued = datetime.fromisoformat(data["issued_on"])
    signed_at = datetime.fromisoformat(data["signed_at"]).astimezone(dt_timezone.utc) if data.get("signed_at") else None
    found = {}
    for kind, raw in images:
        found.setdefault(kind, raw)
    story: list = []

    # En-tête : logo en haut à gauche, identité et texte d'en-tête au centre, coordonnées de la structure à droite.
    if logo:
        logo_mark = Image(BytesIO(logo))
        logo_mark._restrictSize(22 * mm, 22 * mm)
    else:
        logo_mark = Monogram(monogram(place["name"] or "Établissement"), 16 * mm, bold)
    identity = [Paragraph(escape(place["name"] or "Établissement"), styles["name"])]
    if place["type"]:
        identity.append(Paragraph(escape(place["type"]), styles["type"]))
    if place["header_text"]:
        identity.append(Paragraph(escape(place["header_text"]).replace("\n", "<br/>"), styles["tagline"]))
    contact_lines = [escape(place["address"])] if place["address"] else []
    if place["phone"]:
        contact_lines.append(f"Tél : {escape(place['phone'])}")
    if place["email"]:
        contact_lines.append(escape(place["email"]))
    contact = Paragraph("<br/>".join(contact_lines), styles["contact"]) if contact_lines else ""
    side = 26 * mm
    letterhead = Table([[logo_mark, identity, contact]], colWidths=(side, FRAME_WIDTH - side - 50 * mm, 50 * mm))
    letterhead.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (0, 0), (0, 0), "LEFT"), *ZERO_PADDING, ("LEFTPADDING", (1, 0), (1, 0), 6), ("RIGHTPADDING", (1, 0), (1, 0), 6)]))
    story.extend([letterhead, Spacer(1, 7), HRFlowable(width="100%", thickness=1.4, color=GREEN, spaceAfter=0), Spacer(1, 9)])

    # Lieu et date à droite ; puis le nom et le prénom du patient, rien d'autre.
    place_prefix = f"{escape(place['city'])}, le " if place["city"] else "Le "
    story.extend([
        Paragraph(f"{place_prefix}{french_date(issued)}", styles["date"]),
        Spacer(1, 6),
        Paragraph(f"<font name='{bold}' size='8' color='#5b6a65'>NOM DU PATIENT :</font>&nbsp;&nbsp;<font name='{bold}'>{escape(patient['name'])}</font>", styles["patient"]),
        Spacer(1, 14),
    ])

    # Grand titre encadré.
    title_box = Table([[Paragraph("ORDONNANCE MÉDICALE", styles["title"])]], colWidths=(FRAME_WIDTH * 0.7,), hAlign="CENTER")
    title_box.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 1.3, INK), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 7), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8)]))
    story.extend([title_box, Spacer(1, 14)])

    # Médicaments : lignes numérotées (médicament et dosage en gras, posologie et durée, conseil en italique). Chaque ligne reste d'un seul tenant.
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

    # Bas de feuille : à gauche la signature du professionnel, à droite le cachet de l'établissement (scan déposé, sinon cachet électronique).
    when_signed = f" le {signed_at.strftime('%d/%m/%Y à %H:%M')} UTC" if signed_at else ""
    signed_line = Paragraph(f"Signée électroniquement dans Mon E‑Carnet par {escape(prescriber['name'])}{when_signed} · réf. {escape(data['reference'])}", styles["signed"])
    mark_height = 30 * mm
    slot_width = FRAME_WIDTH * 0.46

    def picture(kind: str):
        raw = found.get(kind)
        return Image(BytesIO(raw)) if raw else None

    professional_marks = [mark for mark in (picture("signature"), picture("stamp")) if mark is not None]
    title_line = " · ".join(part for part in (prescriber["title"], prescriber["specialty"]) if part)
    details = f"<font name='{bold}'>{escape(prescriber['name'])}</font>" + (f"<br/>{escape(title_line)}" if title_line else "") + (f"<br/>N° d’ordre : {escape(prescriber['order_number'])}" if prescriber["order_number"] else "")
    seal_date = signed_at or issued
    establishment_marks = [picture("establishment-stamp") or EstablishmentSealFlowable(place["name"], place["city"], seal_date, mark_height - 2 * mm, bold)]
    if found.get("establishment-signature"):
        establishment_marks.append(picture("establishment-signature"))
    left = mark_slot(professional_marks, "Signature du professionnel", details, slot_width, mark_height, styles)
    right = mark_slot(establishment_marks, "Cachet de l’établissement" + (" et signature" if len(establishment_marks) > 1 else ""), "", slot_width, mark_height, styles)
    slots = Table([[left, "", right]], colWidths=(slot_width, FRAME_WIDTH - 2 * slot_width, slot_width))
    slots.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), *ZERO_PADDING]))
    story.append(PinToBottom([Spacer(1, 14), signed_line, Spacer(1, 8), slots]))

    footer_text = " ".join((place.get("footer_text") or "").split())
    if len(footer_text) > 240:
        footer_text = footer_text[:239].rstrip() + "…"

    def decorate(canvas, document):
        """Pied de page de chaque feuille (texte de l'établissement, origine, numéro) ; rappel du patient et de la référence dès la page 2."""
        canvas.saveState()
        canvas.setStrokeColor(INK)
        canvas.setLineWidth(0.8)
        canvas.line(MARGIN_X, 22 * mm, A4[0] - MARGIN_X, 22 * mm)
        if footer_text:
            footer_paragraph = Paragraph(escape(footer_text), styles["foot"])
            _, height = footer_paragraph.wrapOn(canvas, FRAME_WIDTH, 14 * mm)
            footer_paragraph.drawOn(canvas, MARGIN_X, 22 * mm - 2.5 * mm - height)
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

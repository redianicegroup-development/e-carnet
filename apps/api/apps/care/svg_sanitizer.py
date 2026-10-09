"""Sanitation SVG minimale pour les attestations dessinées.

Le format accepté est volontairement réduit à des primitives de tracé. Aucun CSS,
aucune URL, aucun namespace externe, script, animation ou élément média ne peut
être conservé dans la valeur persistée.
"""
from xml.etree import ElementTree
from rest_framework.exceptions import ValidationError

SVG_NS = "http://www.w3.org/2000/svg"
ALLOWED_ELEMENTS = {"svg", "g", "path", "circle", "ellipse", "line", "polyline", "polygon", "rect"}
ROOT_ATTRIBUTES = {"viewBox", "width", "height", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill-rule", "clip-rule"}
DRAW_ATTRIBUTES = ROOT_ATTRIBUTES | {"d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "x2", "y1", "y2", "points", "id"}
FORBIDDEN_MARKERS = ("<!DOCTYPE", "<!ENTITY", "<?xml-stylesheet", "<style", "<script")


def _local_name(tag):
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def sanitize_svg(source: str) -> str:
    if not isinstance(source, str) or not source.strip():
        raise ValidationError("L’attestation SVG est requise.")
    if len(source.encode("utf-8")) > 20_000:
        raise ValidationError("L’attestation SVG est trop volumineuse.")
    if any(marker.lower() in source.lower() for marker in FORBIDDEN_MARKERS):
        raise ValidationError("Le SVG contient une construction XML ou un contenu interdit.")
    try:
        root = ElementTree.fromstring(source)
    except ElementTree.ParseError as exc:
        raise ValidationError("L’attestation doit être un SVG valide.") from exc
    if _local_name(root.tag).lower() != "svg" or (root.tag.startswith("{") and not root.tag.startswith(f"{{{SVG_NS}}}")):
        raise ValidationError("L’attestation doit être un document SVG.")
    for element in root.iter():
        local = _local_name(element.tag).lower()
        if local not in ALLOWED_ELEMENTS:
            raise ValidationError("Le SVG contient un élément non autorisé.")
        allowed = ROOT_ATTRIBUTES if local == "svg" else DRAW_ATTRIBUTES
        for raw_key, value in element.attrib.items():
            key = _local_name(raw_key)
            if raw_key.startswith("{") or key not in allowed:
                raise ValidationError("Le SVG contient un attribut non autorisé.")
            if not isinstance(value, str) or any(token in value.lower() for token in ("javascript:", "data:", "url(", "expression(", "@import", "<", ">")):
                raise ValidationError("Le SVG contient une valeur dangereuse.")
            if key in {"id", "viewBox", "fill", "stroke", "stroke-linecap", "stroke-linejoin", "fill-rule", "clip-rule", "d", "points"} and len(value) > 4000:
                raise ValidationError("Le SVG contient un attribut trop long.")
        if element.text and element.text.strip():
            raise ValidationError("Le SVG ne peut contenir que des primitives graphiques.")
        if element.tail and element.tail.strip():
            raise ValidationError("Le SVG contient du texte hors élément graphique.")
    # Re-serialization removes comments, declarations and any source formatting.
    return ElementTree.tostring(root, encoding="unicode", short_empty_elements=True)

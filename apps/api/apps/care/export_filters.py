"""Filtres communs aux exports du carnet (PAT-09) : période, rubriques et contenu de chaque rubrique.

Le PDF (export_pdf.py) et le classeur Excel (export_xlsx.py) lisent le carnet par la MÊME fonction, `carnet_sections` : ils filtrent donc
de façon identique (mêmes données, même période, mêmes rubriques). Seule la mise en forme diffère.

Correspondance rubrique → modèle (une rubrique par valeur de `?sections=`) :
- allergies      → ClinicalDeclaration : il n'existe pas de modèle « allergie » à part, les allergies sont des déclarations du patient
                   (type « Allergie ») rangées avec ses antécédents, traitements déclarés, groupe sanguin… La rubrique les reprend TOUTES,
                   colonne « Type » incluse : un export « allergies » qui masquerait les antécédents serait plus trompeur qu’utile.
- vaccins        → Vaccination
- mesures        → HealthMeasurement
- consultations  → Consultation (toutes sont validées : `validated_at` est obligatoire)
- prescriptions  → PrescriptionLine (lignes d’ordonnance des consultations du patient)
- examens        → ExamRequest (examens demandés ; « demandé » et « résultat reçu » restent deux états distincts)
- documents      → MedicalDocument (liste seulement : aucun fichier n’est copié)
"""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import NamedTuple

# Ordre d’affichage des rubriques (PDF et classeur). Les cinq premières gardent l’ordre historique des feuilles du classeur.
SECTION_KEYS = ("allergies", "vaccins", "mesures", "consultations", "prescriptions", "examens", "documents")
SECTION_TITLES = {
    "allergies": "Allergies et déclarations",
    "vaccins": "Vaccinations",
    "mesures": "Mesures",
    "consultations": "Consultations",
    "prescriptions": "Ordonnances",
    "examens": "Examens",
    "documents": "Documents",
}
MIN_YEAR, MAX_YEAR = 1900, 2100
_ISO_DATE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")


class ExportSection(NamedTuple):
    """Une rubrique prête à être mise en forme : `rows` contient des valeurs brutes (texte, nombres, booléens) déjà ordonnées."""
    key: str
    title: str
    headers: list[str]
    rows: list[list]

    def as_sheet(self) -> tuple[str, list[str], list[list]]:
        return (self.title, self.headers, self.rows)


# ---------------------------------------------------------------------------------------------------------------------
# Lecture et validation des paramètres
# ---------------------------------------------------------------------------------------------------------------------

def parse_period(params) -> tuple[date | None, date | None]:
    """Lit ?from=AAAA-MM-JJ&to=AAAA-MM-JJ (les deux facultatifs ; sans eux : tout l’historique). Lève une ValidationError DRF (400) si
    une date est mal formée ou hors de 1900–2100, ou si la fin précède le début."""
    from rest_framework.exceptions import ValidationError

    def one(name: str) -> date | None:
        raw = str(params.get(name, "") or "").strip()
        if not raw:
            return None
        if not _ISO_DATE.fullmatch(raw):
            raise ValidationError({name: "Date attendue au format AAAA-MM-JJ."})
        if not MIN_YEAR <= int(raw[:4]) <= MAX_YEAR:
            raise ValidationError({name: f"L’année doit être comprise entre {MIN_YEAR} et {MAX_YEAR}."})
        try:
            return date.fromisoformat(raw)
        except ValueError:
            raise ValidationError({name: "Date attendue au format AAAA-MM-JJ."})

    start, end = one("from"), one("to")
    if start and end and start > end:
        raise ValidationError({"to": "La date de fin doit être égale ou postérieure à la date de début."})
    return start, end


def parse_sections(params) -> tuple[str, ...] | None:
    """Lit ?sections=a,b,c. Absent : None (toutes les rubriques). Présent : les rubriques demandées, dans l’ordre d’affichage et sans doublon.
    Une valeur inconnue, ou une liste vide (`?sections=`), lève une ValidationError DRF (400) qui rappelle les valeurs possibles."""
    from rest_framework.exceptions import ValidationError

    getlist = getattr(params, "getlist", None)
    values = getlist("sections") if getlist else ([params["sections"]] if "sections" in params else [])
    if not values:
        return None
    asked = [token.strip().lower() for value in values for token in str(value or "").split(",") if token.strip()]
    possible = ", ".join(SECTION_KEYS)
    if not asked:
        raise ValidationError({"sections": f"Indiquez au moins une rubrique à exporter. Valeurs possibles : {possible}."})
    unknown = [token for token in dict.fromkeys(asked) if token not in SECTION_TITLES]
    if unknown:
        shown = ", ".join(token[:30] for token in unknown[:5]) + (", …" if len(unknown) > 5 else "")
        raise ValidationError({"sections": f"Rubrique inconnue : {shown}. Valeurs possibles : {possible}."})
    return tuple(key for key in SECTION_KEYS if key in asked)


def parse_export_filters(params) -> tuple[date | None, date | None, tuple[str, ...] | None]:
    """(début, fin, rubriques) lus dans les paramètres de la requête, validés en une fois."""
    start, end = parse_period(params)
    return start, end, parse_sections(params)


def export_audit_metadata(fmt: str, start: date | None, end: date | None, sections) -> dict:
    """Métadonnées du journal d’audit d’un export : ce qui a été demandé, JAMAIS le contenu exporté."""
    return {
        "action": "exported",
        "resource_type": f"patient_carnet_{fmt}",
        "format": fmt,
        "from": start.isoformat() if start else "",
        "to": end.isoformat() if end else "",
        "sections": list(sections if sections is not None else SECTION_KEYS),
    }


# ---------------------------------------------------------------------------------------------------------------------
# Mise en texte (communs aux deux formats)
# ---------------------------------------------------------------------------------------------------------------------

def format_when(value, *, date_only: bool = False) -> str:
    if not value:
        return ""
    if isinstance(value, datetime):
        from django.utils import timezone

        if timezone.is_aware(value):
            value = timezone.localtime(value)
        return value.strftime("%d/%m/%Y" if date_only else "%d/%m/%Y %H:%M")
    return value.strftime("%d/%m/%Y")


def describe_period(start: date | None, end: date | None) -> str:
    if start and end:
        return f"du {format_when(start)} au {format_when(end)}"
    if start:
        return f"à partir du {format_when(start)}"
    if end:
        return f"jusqu’au {format_when(end)}"
    return "tout l'historique"


def patient_display_name(patient) -> str:
    """Nom du titulaire. Un dossier représenté (enfant) n’a pas de compte : on ne suppose donc jamais `patient.user`."""
    name = " ".join(part for part in (patient.display_first_name(), patient.display_last_name()) if part).strip()
    if name:
        return name
    user = patient.user if patient.user_id else None
    name = (user.get_full_name() or user.email) if user else ""
    return name or "Titulaire non renseigné"


def field_label(obj, name: str):
    """Libellé lisible d’un champ à choix (`get_<champ>_display`), sinon la valeur brute."""
    getter = getattr(obj, f"get_{name}_display", None)
    return getter() if callable(getter) else getattr(obj, name, "")


# ---------------------------------------------------------------------------------------------------------------------
# Contenu des rubriques
# ---------------------------------------------------------------------------------------------------------------------

def filter_period(qs, field: str, start: date | None, end: date | None, *, datetime_field: bool = False):
    """Restreint `qs` aux lignes dont `field` tombe dans [start, end] (bornes incluses ; None = pas de borne)."""
    suffix = "__date" if datetime_field else ""
    if start:
        qs = qs.filter(**{f"{field}{suffix}__gte": start})
    if end:
        qs = qs.filter(**{f"{field}{suffix}__lte": end})
    return qs


def _allergies(patient, start, end):
    from apps.patients.models import ClinicalDeclaration

    items = filter_period(ClinicalDeclaration.objects.filter(patient=patient), "created_at", start, end, datetime_field=True).order_by("-created_at")
    return ["Type", "Libellé", "Détails", "Statut", "Ajouté le"], [
        [field_label(d, "kind"), d.label, d.details, field_label(d, "status"), format_when(d.created_at)] for d in items
    ]


def _vaccins(patient, start, end):
    from .models import Vaccination

    items = filter_period(Vaccination.objects.filter(patient=patient), "administered_on", start, end).order_by("-administered_on")
    return ["Vaccin", "Dose", "Date", "Prochain rappel", "Lieu", "Professionnel", "Statut", "Notes"], [
        [v.vaccine_name, v.dose_number, format_when(v.administered_on), format_when(v.next_due_on), v.facility, v.professional, field_label(v, "status"), v.notes] for v in items
    ]


def _mesures(patient, start, end):
    from .models import HealthMeasurement

    items = filter_period(HealthMeasurement.objects.filter(patient=patient), "measured_at", start, end, datetime_field=True).order_by("-measured_at")
    return ["Mesure", "Valeur", "Unité", "Source", "Date", "Note"], [
        [field_label(m, "kind"), m.raw_value or (str(m.value) if m.value is not None else ""), m.unit, field_label(m, "source"), format_when(m.measured_at), m.note] for m in items
    ]


def _consultations(patient, start, end):
    from .models import Consultation

    items = filter_period(Consultation.objects.filter(patient=patient, validated_at__isnull=False), "validated_at", start, end, datetime_field=True).order_by("-validated_at")
    return ["Validée le", "Professionnel", "Établissement", "Motif", "Diagnostic", "Conclusion"], [
        [format_when(c.validated_at), c.professional_name, c.facility_label, c.reason, c.diagnosis, c.conclusion] for c in items
    ]


def _prescriptions(patient, start, end):
    from .models import PrescriptionLine

    items = PrescriptionLine.objects.filter(consultation__patient=patient, consultation__validated_at__isnull=False).select_related("consultation")
    items = filter_period(items, "consultation__validated_at", start, end, datetime_field=True).order_by("-consultation__validated_at", "consultation_id", "position")
    return ["Consultation du", "Médicament", "Dosage", "Posologie", "Durée", "Consignes", "Prescripteur"], [
        [format_when(p.consultation.validated_at, date_only=True), p.drug_name, p.dosage, p.posology, p.duration, p.instructions, p.consultation.professional_name] for p in items
    ]


def _examens(patient, start, end):
    from .models import ExamRequest

    items = ExamRequest.objects.filter(consultation__patient=patient, consultation__validated_at__isnull=False).select_related("consultation")
    items = filter_period(items, "consultation__validated_at", start, end, datetime_field=True).order_by("-consultation__validated_at", "consultation_id", "position")
    return ["Consultation du", "Type", "Examen", "Statut", "Prescripteur"], [
        [format_when(e.consultation.validated_at, date_only=True), field_label(e, "kind"), e.label, field_label(e, "status"), e.consultation.professional_name] for e in items
    ]


def _documents(patient, start, end):
    from django.db.models import Q

    from .models import MedicalDocument

    items = MedicalDocument.objects.filter(patient=patient)
    if start or end:
        # Un document daté se place à sa date ; un document sans date, à sa date d’ajout.
        dated, undated = Q(document_date__isnull=False), Q(document_date__isnull=True)
        if start:
            dated &= Q(document_date__gte=start)
            undated &= Q(created_at__date__gte=start)
        if end:
            dated &= Q(document_date__lte=end)
            undated &= Q(created_at__date__lte=end)
        items = items.filter(dated | undated)
    return ["Nom du fichier", "Type", "Date du document", "Émetteur", "Vérifié", "Ajouté le"], [
        [d.original_name, field_label(d, "document_type"), format_when(d.document_date), d.issuer, bool(d.verified), format_when(d.created_at)] for d in items.order_by("-created_at")
    ]


_BUILDERS = {
    "allergies": _allergies,
    "vaccins": _vaccins,
    "mesures": _mesures,
    "consultations": _consultations,
    "prescriptions": _prescriptions,
    "examens": _examens,
    "documents": _documents,
}


def carnet_sections(patient, start: date | None = None, end: date | None = None, sections=None) -> list[ExportSection]:
    """Rubriques du carnet de `patient`, dans l’ordre d’affichage, restreintes à [start, end] et aux `sections` demandées (None = toutes).

    Uniquement les données de CE patient. Fonction commune au PDF et au classeur Excel : elle ne connaît ni la requête ni le format.
    Une rubrique sans donnée sur la période est quand même renvoyée (lignes vides) : c’est à la mise en forme de le dire.
    """
    wanted = SECTION_KEYS if sections is None else tuple(sections)
    unknown = [key for key in wanted if key not in _BUILDERS]
    if unknown:
        raise ValueError(f"Rubrique inconnue : {', '.join(unknown)}.")
    return [
        ExportSection(key, SECTION_TITLES[key], *_BUILDERS[key](patient, start, end))
        for key in SECTION_KEYS
        if key in wanted
    ]

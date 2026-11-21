"""Contenu d'une ordonnance : une seule source pour la feuille affichée dans le carnet (JSON) et pour le PDF.

L'en-tête vient des réglages de l'établissement (modèle d'ordonnance) ; quand un champ du modèle est vide, la fiche de l'établissement
(adresse, téléphone, e-mail) sert de repli, pour qu'une ordonnance ne parte pas sans coordonnées alors qu'elles sont connues.
Le médecin reste seul responsable du contenu et de la validation de chaque ligne : rien n'est complété ici à sa place."""
from __future__ import annotations

from datetime import date

from django.utils import timezone

from apps.establishments.models import PrescriptionTemplate
from apps.establishments.serializers import logo_for

from .models import Appointment, Consultation

# Un logo n'est repris du modèle que s'il est hébergé par notre stockage d'images : le navigateur du patient ne doit pas aller chercher
# une image sur un serveur quelconque (adresse IP, suivi). À défaut, le logo de la fiche de l'établissement est utilisé.
SAFE_LOGO_PREFIX = "https://res.cloudinary.com/"
SEX_VALUES = {"female", "male"}


def consultation_reference(consultation: Consultation) -> str:
    """Référence courte (8 caractères) : la même sur le sceau, la feuille et le PDF."""
    return str(consultation.id).replace("-", "")[:8].upper()


def age_in_years(birth_date: date | None, today: date) -> int | None:
    if not birth_date or birth_date > today:
        return None
    years = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    return years if 0 <= years <= 130 else None


def weight_label(vitals: dict | None) -> str:
    """« 61 kg » ou « 61,5 kg » à partir de la constante saisie à la consultation ; vide si elle n'a pas été relevée."""
    entry = (vitals or {}).get("weight_kg")
    value = entry.get("value") if isinstance(entry, dict) else entry
    if value in (None, ""):
        return ""
    try:
        number = float(str(value).replace(",", "."))
    except ValueError:
        return ""
    text = f"{number:.1f}".rstrip("0").rstrip(".").replace(".", ",")
    return f"{text} kg"


def build_prescription_context(consultation: Consultation, lines) -> dict:
    """Tout ce qui figure sur l'ordonnance, en données simples (aucune image : elles se lisent à part)."""
    establishment = consultation.establishment if consultation.establishment_id else None
    template = PrescriptionTemplate.objects.filter(establishment=establishment).first() if establishment else None
    professional = consultation.professional
    patient = consultation.patient
    issued_at = consultation.validated_at or timezone.now()

    def pick(field: str) -> str:
        own = (getattr(template, field, "") or "").strip() if template else ""
        return own or ((getattr(establishment, field, "") or "").strip() if establishment else "")

    template_logo = (template.logo_url or "").strip() if template else ""
    logo = template_logo if template_logo.startswith(SAFE_LOGO_PREFIX) else (logo_for(establishment) if establishment else "")
    patient_name = " ".join(part for part in (patient.display_first_name(), patient.display_last_name()) if part).strip() or "Patient non renseigné"
    # Prochain rendez-vous chez le même établissement : un rendez-vous pris ailleurs n'a pas à figurer sur cette ordonnance.
    upcoming = Appointment.objects.filter(patient=patient, starts_at__gte=timezone.now(), status__in=("requested", "confirmed"))
    next_appointment = upcoming.filter(establishment=establishment).order_by("starts_at").first() if establishment else None

    return {
        "consultation_id": str(consultation.id),
        "reference": consultation_reference(consultation),
        "issued_on": issued_at.date().isoformat(),
        "signed_at": consultation.attestation_signed_at.isoformat() if consultation.attestation_signed_at else None,
        "establishment": {
            "name": establishment.name if establishment else consultation.facility_label,
            "type": (establishment.establishment_type or "") if establishment else "",
            "city": (establishment.city or "") if establishment else "",
            "address": pick("address"),
            "phone": pick("phone"),
            "email": pick("email"),
            "logo_url": logo,
            "header_text": (template.header_text or "").strip() if template else "",
            "footer_text": (template.footer_text or "").strip() if template else "",
        },
        "prescriber": {
            "name": consultation.professional_name or "Prescripteur non renseigné",
            "title": (getattr(professional, "professional_title", "") or "") if professional else "",
            "specialty": (getattr(professional, "specialty", "") or "") if professional else "",
            "order_number": (getattr(professional, "professional_identifier", "") or "") if professional else "",
        },
        "patient": {
            "name": patient_name,
            "age_years": age_in_years(patient.birth_date, timezone.localdate()),
            "sex": patient.gender if patient.gender in SEX_VALUES else "",
            "weight": weight_label(consultation.vitals),
        },
        "lines": [
            {"id": str(line.id), "drug_name": line.drug_name, "dosage": line.dosage, "posology": line.posology, "duration": line.duration, "instructions": line.instructions}
            for line in lines
        ],
        "next_appointment": next_appointment.starts_at.isoformat() if next_appointment else None,
        # Les images se lisent par /consultations/<id>/seal/<signature|stamp>/ : seul un booléen sort ici (images figées à la signature).
        "has_signature": bool(consultation.signature_asset_id),
        "has_stamp": bool(consultation.stamp_asset_id),
    }

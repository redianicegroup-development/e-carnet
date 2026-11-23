"""Contenu d'une ordonnance : une seule source pour la feuille affichée dans le carnet (JSON) et pour le PDF.

Modèle simple, celui d'une ordonnance papier : logo, en-tête et coordonnées de l'établissement ; nom et prénom du patient ; titre « ORDONNANCE MÉDICALE » ;
les médicaments ; puis le pied de page, la signature du professionnel et le cachet de l'établissement.
Tout ce qui décrit l'établissement (nom, type, logo, adresse, téléphone, e-mail, cachet, signature) est lu sur SA fiche (« Informations administratives » et
« Coordonnées ») : le modèle d'ordonnance ne garde que l'en-tête et le pied de page, il suit donc toujours la fiche.
Le médecin reste seul responsable du contenu et de la validation de chaque ligne : rien n'est complété ici à sa place."""
from __future__ import annotations

from django.utils import timezone

from apps.establishments.models import PrescriptionTemplate
from apps.establishments.serializers import logo_for

from .models import Consultation


def consultation_reference(consultation: Consultation) -> str:
    """Référence courte (8 caractères) : la même sur le sceau, la feuille et le PDF."""
    return str(consultation.id).replace("-", "")[:8].upper()


def build_prescription_context(consultation: Consultation, lines) -> dict:
    """Tout ce qui figure sur l'ordonnance, en données simples (aucune image : elles se lisent à part)."""
    establishment = consultation.establishment if consultation.establishment_id else None
    template = PrescriptionTemplate.objects.filter(establishment=establishment).first() if establishment else None
    professional = consultation.professional
    patient = consultation.patient
    issued_at = consultation.validated_at or timezone.now()

    def own(field: str) -> str:
        return (getattr(establishment, field, "") or "").strip() if establishment else ""

    patient_name = " ".join(part for part in (patient.display_first_name(), patient.display_last_name()) if part).strip() or "Patient non renseigné"

    return {
        "consultation_id": str(consultation.id),
        "reference": consultation_reference(consultation),
        "issued_on": issued_at.date().isoformat(),
        "signed_at": consultation.attestation_signed_at.isoformat() if consultation.attestation_signed_at else None,
        "establishment": {
            "name": establishment.name if establishment else consultation.facility_label,
            "type": own("establishment_type"),
            "city": own("city"),
            "address": own("address"),
            "phone": own("phone"),
            "email": own("email"),
            "logo_url": logo_for(establishment) if establishment else "",
            "header_text": (template.header_text or "").strip() if template else "",
            "footer_text": (template.footer_text or "").strip() if template else "",
        },
        "prescriber": {
            "name": consultation.professional_name or "Prescripteur non renseigné",
            "title": (getattr(professional, "professional_title", "") or "") if professional else "",
            "specialty": (getattr(professional, "specialty", "") or "") if professional else "",
            "order_number": (getattr(professional, "professional_identifier", "") or "") if professional else "",
        },
        "patient": {"name": patient_name},
        "lines": [
            {"id": str(line.id), "drug_name": line.drug_name, "dosage": line.dosage, "posology": line.posology, "duration": line.duration, "instructions": line.instructions}
            for line in lines
        ],
        # Les images se lisent par /consultations/<id>/seal/<signature|stamp|establishment-stamp|establishment-signature>/ : seuls des booléens sortent ici
        # (images figées à la signature).
        "has_signature": bool(consultation.signature_asset_id),
        "has_stamp": bool(consultation.stamp_asset_id),
        "has_establishment_stamp": bool(consultation.establishment_stamp_asset_id),
        "has_establishment_signature": bool(consultation.establishment_signature_asset_id),
    }

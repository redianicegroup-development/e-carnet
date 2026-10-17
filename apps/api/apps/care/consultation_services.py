from django.db import transaction
from django.utils import timezone
from hashlib import sha256
from xml.etree import ElementTree
from rest_framework.exceptions import ValidationError

from apps.professionals.access import professional_clinical_access_error
from .models import AccessGrant, CareEncounter, Consultation, ConsultationRevision, PreConsultationRevision
from .services import require_scope


@transaction.atomic
def validate_consultation(*, professional, data):
    """Termine la consultation : le médecin signe, et la pré-consultation du patient est clôturée du même geste.

    Le patient (ou la personne qui l’aide, souvent un infirmier sans compte) ne fait que préparer un brouillon. C’est la
    signature du médecin qui clôture ce brouillon, le rattache à l’établissement du médecin et crée la consultation :
    tout se met à jour en une seule transaction, ou rien."""
    access_error = professional_clinical_access_error(professional)
    if access_error:
        raise ValidationError(access_error)
    establishment = professional.active_establishment
    grant = AccessGrant.objects.select_related("patient", "establishment").filter(id=data["access_grant_id"], professional=professional).first()
    if not grant:
        raise ValidationError("AccessGrant introuvable dans votre périmètre.")
    grant.refresh_expiration()
    if grant.status != "active" or grant.establishment_id != establishment.id:
        raise ValidationError("L’AccessGrant n’est plus actif dans votre établissement courant.")
    require_scope(grant, "preconsultation")
    encounter = CareEncounter.objects.select_for_update().filter(id=data["source_encounter_id"], patient=grant.patient).first()
    if not encounter:
        raise ValidationError("Cette pré-consultation n’existe pas pour ce patient.")
    if encounter.status != "draft" or Consultation.objects.filter(source_encounter=encounter).exists():
        raise ValidationError("Cette pré-consultation est déjà clôturée : elle a déjà donné lieu à une consultation.")
    from .svg_sanitizer import sanitize_svg
    attestation = sanitize_svg(data["attestation_svg"].strip())
    signed_at = timezone.now()
    reason = data.get("reason", "").strip() or encounter.reason
    if not reason:
        raise ValidationError("Le motif de consultation est requis.")
    consultation = Consultation.objects.create(
        patient=grant.patient,
        professional=professional,
        establishment=establishment,
        access_grant=grant,
        source_encounter=encounter,
        professional_name=f"{professional.user.first_name} {professional.user.last_name}".strip() or professional.professional_title,
        facility_label=establishment.name,
        reason=reason,
        observations=data.get("observations", "").strip() or encounter.observations,
        conclusion=data.get("conclusion", "").strip(),
        care_plan=data.get("care_plan", "").strip(),
        attestation_svg=attestation,
        attestation_svg_hash=sha256(attestation.encode("utf-8")).hexdigest(),
        attestation_signed_at=signed_at,
        validated_at=signed_at,
    )
    # Clôture par le médecin : l’établissement vient de la session du médecin, jamais d’un choix du patient.
    encounter.status = "closed"
    encounter.closed_at = signed_at
    encounter.establishment = establishment
    encounter.facility_label = establishment.name
    encounter.save(update_fields=("status", "closed_at", "establishment", "facility_label", "updated_at"))
    PreConsultationRevision.objects.create(encounter=encounter, snapshot={"reason": encounter.reason, "observations": encounter.observations, "facility_label": encounter.facility_label, "recorded_with_help": encounter.recorded_with_help, "closed_by": "professional", "professional_id": str(professional.id), "access_grant_id": str(grant.id)})
    ConsultationRevision.objects.create(consultation=consultation, snapshot={"reason": consultation.reason, "observations": consultation.observations, "conclusion": consultation.conclusion, "care_plan": consultation.care_plan, "professional_id": str(professional.id), "establishment_id": str(establishment.id), "access_grant_id": str(grant.id), "source_encounter_id": str(encounter.id)})
    return consultation

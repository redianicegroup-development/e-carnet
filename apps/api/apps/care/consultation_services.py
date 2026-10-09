from django.db import transaction
from django.utils import timezone
from hashlib import sha256
from xml.etree import ElementTree
from rest_framework.exceptions import ValidationError

from apps.professionals.access import professional_clinical_access_error
from .models import AccessGrant, CareEncounter, Consultation, ConsultationRevision


@transaction.atomic
def validate_consultation(*, professional, data):
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
    if "preconsultation" not in grant.scope:
        raise ValidationError("Le périmètre de cet AccessGrant n’autorise pas la pré-consultation.")
    encounter = CareEncounter.objects.filter(id=data["source_encounter_id"], patient=grant.patient, establishment_id=grant.establishment_id).first()
    if not encounter or encounter.status != "closed":
        raise ValidationError("La pré-consultation doit être clôturée par le patient et relever du même établissement que l’autorisation.")
    if Consultation.objects.filter(access_grant=grant, source_encounter=encounter).exists():
        raise ValidationError("Cette pré-consultation a déjà donné lieu à une consultation.")
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
    ConsultationRevision.objects.create(consultation=consultation, snapshot={"reason": consultation.reason, "observations": consultation.observations, "conclusion": consultation.conclusion, "care_plan": consultation.care_plan, "professional_id": str(professional.id), "establishment_id": str(establishment.id), "access_grant_id": str(grant.id), "source_encounter_id": str(encounter.id)})
    return consultation

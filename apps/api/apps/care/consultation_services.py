from django.db import transaction
from django.utils import timezone
from hashlib import sha256
from xml.etree import ElementTree
from rest_framework.exceptions import ValidationError

from apps.professionals.access import professional_clinical_access_error
from .models import AccessGrant, CareEncounter, Consultation, ConsultationRevision, ExamRequest, PreConsultationRevision, PrescriptionLine
from .services import require_scope
from .vitals import build_consultation_vitals


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
    symptoms = data.get("symptoms", "").strip()
    observations = data.get("observations", "").strip()
    # Un client qui ne connaît pas le bloc « symptômes » (clé absente) retrouve la saisie du patient dans les observations.
    if "symptoms" not in data and not observations:
        observations = encounter.observations
    consultation = Consultation.objects.create(
        patient=grant.patient,
        professional=professional,
        establishment=establishment,
        access_grant=grant,
        source_encounter=encounter,
        professional_name=f"{professional.user.first_name} {professional.user.last_name}".strip() or professional.professional_title,
        facility_label=establishment.name,
        reason=reason,
        symptoms=symptoms,
        clinical_exam=data.get("clinical_exam", "").strip(),
        diagnosis=data.get("diagnosis", "").strip(),
        observations=observations,
        vitals=build_consultation_vitals(encounter.vitals, data.get("vitals")),
        conclusion=data.get("conclusion", "").strip(),
        care_plan=data.get("care_plan", "").strip(),
        attestation_svg=attestation,
        attestation_svg_hash=sha256(attestation.encode("utf-8")).hexdigest(),
        attestation_signed_at=signed_at,
        validated_at=signed_at,
    )
    prescription_lines = [
        PrescriptionLine(
            consultation=consultation,
            position=index,
            drug_name=line["drug_name"].strip(),
            dosage=line.get("dosage", "").strip(),
            posology=line["posology"].strip(),
            duration=line.get("duration", "").strip(),
            instructions=line.get("instructions", "").strip(),
        )
        for index, line in enumerate(data.get("prescription_lines", []))
    ]
    exam_requests = [
        ExamRequest(consultation=consultation, position=index, kind=exam["kind"], label=exam["label"].strip())
        for index, exam in enumerate(data.get("requested_exams", []))
    ]
    PrescriptionLine.objects.bulk_create(prescription_lines)
    ExamRequest.objects.bulk_create(exam_requests)
    # Clôture par le médecin : l’établissement vient de la session du médecin, jamais d’un choix du patient.
    encounter.status = "closed"
    encounter.closed_at = signed_at
    encounter.establishment = establishment
    encounter.facility_label = establishment.name
    encounter.save(update_fields=("status", "closed_at", "establishment", "facility_label", "updated_at"))
    PreConsultationRevision.objects.create(encounter=encounter, snapshot={"reason": encounter.reason, "observations": encounter.observations, "vitals": encounter.vitals, "facility_label": encounter.facility_label, "recorded_with_help": encounter.recorded_with_help, "closed_by": "professional", "professional_id": str(professional.id), "access_grant_id": str(grant.id)})
    ConsultationRevision.objects.create(consultation=consultation, snapshot={"reason": consultation.reason, "symptoms": consultation.symptoms, "clinical_exam": consultation.clinical_exam, "diagnosis": consultation.diagnosis, "observations": consultation.observations, "vitals": consultation.vitals, "prescription_lines": [{"drug_name": line.drug_name, "dosage": line.dosage, "posology": line.posology, "duration": line.duration, "instructions": line.instructions} for line in prescription_lines], "requested_exams": [{"kind": exam.kind, "label": exam.label} for exam in exam_requests], "conclusion": consultation.conclusion, "care_plan": consultation.care_plan, "professional_id": str(professional.id), "establishment_id": str(establishment.id), "access_grant_id": str(grant.id), "source_encounter_id": str(encounter.id)})
    return consultation

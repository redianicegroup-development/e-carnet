"""Suppression d'un profil d'enfant, avec motif, par son représentant.

Même règle que la suppression d'un compte (identity.anonymize_and_disable_account) : les données saisies pour l'enfant (documents, vaccins, mesures,
rappels, plans, rendez-vous, notifications, déclarations, carte d'urgence, photo) sont effacées, l'identité est vidée et les accès ouverts sont
révoqués. Seul l'ancrage opaque du dossier reste, parce que le journal d'audit et les consultations signées par les professionnels sont conservés et
y font référence. La suppression est définitive : le lien devient « deleted » et ne peut plus être réactivé.
"""
from django.utils import timezone

from apps.cloudinary_storage import destroy as cloudinary_destroy

from .avatars import clear_child_avatar
from .models import ClinicalDeclaration, PatientEmergencyCard, PatientProfile, RepresentationTransferRequest

# Mêmes motifs que la suppression d'un compte (identity.AccountActionRequest.REASONS) ; « Autre motif » demande une précision.
DELETION_REASONS = ("not_needed", "duplicate", "privacy", "experience", "other")
MAX_DETAILS = 1200


def clean_deletion_request(data) -> tuple[str, str]:
    """Valide le motif envoyé par l'application ; lève ValueError avec un message lisible."""
    if data.get("confirm") is not True:
        raise ValueError("Confirmez la suppression définitive du profil.")
    reason = str(data.get("reason") or "").strip()
    if reason not in DELETION_REASONS:
        raise ValueError("Choisissez un motif.")
    details = str(data.get("details") or "").strip()
    if reason == "other" and not details:
        raise ValueError("Précisez votre autre motif.")
    if len(details) > MAX_DETAILS:
        raise ValueError("La précision du motif est trop longue.")
    return reason, details if reason == "other" else ""


def anonymize_child_profile(patient: PatientProfile) -> None:
    """Efface les données de l'enfant et vide son identité. À appeler dans une transaction : un refus Cloudinary (RuntimeError) l'annule."""
    from apps.care.models import AccessGrant, Appointment, CareEncounter, FollowUpPlan, HealthMeasurement, MedicalDocument, MedicationReminder, PatientNotification, PreConsultationRevision, PendingConsultation, Vaccination

    now = timezone.now()
    documents = list(MedicalDocument.objects.filter(patient=patient))
    for document in documents:
        if document.cloudinary_public_id:
            try:
                cloudinary_destroy(document.cloudinary_public_id, resource_type=document.cloudinary_resource_type or "image")
            except Exception as exc:
                raise RuntimeError("La suppression des documents de l’enfant a échoué ; le profil est conservé.") from exc
    for document in documents:
        if document.file:
            document.file.delete(save=False)
    MedicalDocument.objects.filter(patient=patient).delete()
    Vaccination.objects.filter(patient=patient).delete()
    HealthMeasurement.objects.filter(patient=patient).delete()
    MedicationReminder.objects.filter(patient=patient).delete()
    FollowUpPlan.objects.filter(patient=patient).delete()
    Appointment.objects.filter(patient=patient).delete()
    PatientNotification.objects.filter(patient=patient).delete()
    ClinicalDeclaration.objects.filter(patient=patient).delete()
    PatientEmergencyCard.objects.filter(patient=patient).delete()
    PreConsultationRevision.objects.filter(encounter__patient=patient).delete()
    CareEncounter.objects.filter(patient=patient).update(facility_label="", reason="", observations="", recorded_with_help="", status="closed", closed_at=now, vitals={})
    AccessGrant.objects.filter(patient=patient, status__in=("pending", "active")).update(status="revoked", revoked_at=now)
    PendingConsultation.objects.filter(patient=patient).exclude(status="completed").update(draft={}, status="cancelled", qr_expires_at=now)
    RepresentationTransferRequest.objects.filter(representation__patient=patient, status="pending").update(status="rejected")
    clear_child_avatar(patient)
    PatientProfile.objects.filter(pk=patient.pk).update(
        first_name="", last_name="", phone="", birth_date=None, gender="", address="", profession="",
        coverage_provider="", coverage_number="", coverage_expiry=None, updated_at=now,
    )

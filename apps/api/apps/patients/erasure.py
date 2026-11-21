"""Effacement IMMÉDIAT et IRRÉVERSIBLE des données d'un patient (carnet enfant supprimé par son représentant, compte patient supprimé).

Tout ce qui est propre au patient est réellement supprimé de la base (DELETE, pas un marquage) : documents et leurs fichiers distants, vaccins, mesures,
rappels, rendez-vous, notifications, déclarations (avec attestations, partages et pièces jointes), plans de suivi et leurs révisions, consultations en
attente, consultations « invité », révisions et lignes d'ordonnance, examens demandés, QR, carte d'urgence, préférences, révisions de pré-consultation.

Une seule chose ne peut pas disparaître sans casser le journal d'audit : les lignes que ce journal référence par clé étrangère. Le journal d'audit est protégé
(événements immuables, déclencheurs de base de données qui refusent UPDATE, DELETE et TRUNCATE, clés étrangères PROTECT). Ces lignes restent donc, mais
VIDÉES de tout contenu : le profil patient (identifiant technique sans nom, date de naissance, téléphone, adresse, couverture, photo), les consultations
(contenu, ordonnance, signature et attestation effacés), les prises en charge (motif, observations, constantes effacés) et les accès (révoqués). Elles ne
permettent plus de retrouver ni de reconnaître la personne.
Fonction à appeler dans une transaction : un refus du service de fichiers (RuntimeError) l'annule en entier, rien n'est alors effacé.
"""
from django.utils import timezone

from apps.cloudinary_storage import destroy as cloudinary_destroy

from .avatars import clear_child_avatar


def erase_patient_records(patient) -> None:
    from apps.attestations.models import DeclarationAttestation
    from apps.care.models import (
        AccessGrant, Appointment, CareEncounter, Consultation, ConsultationRevision, EmergencyAccessRequest, ExamRequest, FollowUpPlan, FollowUpPlanRevision,
        GuestConsultation, HealthMeasurement, MedicalDocument, MedicationReminder, PatientAccessQrToken, PatientNotification, PendingConsultation,
        PreConsultationRevision, PrescriptionLine, Vaccination,
    )
    from apps.referrals.models import CareReferral

    from .models import ClinicalDeclaration, PatientAccessSummaryPreference, PatientEmergencyCard, PatientProfile

    now = timezone.now()

    # 1) Les fichiers distants d'abord : un refus annule toute la transaction avant qu'une ligne ne disparaisse.
    documents = list(MedicalDocument.objects.filter(patient=patient))
    for document in documents:
        if document.cloudinary_public_id:
            try:
                cloudinary_destroy(document.cloudinary_public_id, resource_type=document.cloudinary_resource_type or "image")
            except Exception as exc:
                raise RuntimeError("La suppression des documents a échoué : rien n’a été effacé.") from exc
    for document in documents:
        if document.file:
            document.file.delete(save=False)

    # 2) Suppression réelle des lignes (ordre imposé par les clés étrangères PROTECT).
    DeclarationAttestation.objects.filter(share__declaration__patient=patient).delete()
    ClinicalDeclaration.objects.filter(patient=patient).delete()
    PendingConsultation.objects.filter(patient=patient).delete()
    GuestConsultation.objects.filter(patient=patient).delete()
    ConsultationRevision.objects.filter(consultation__patient=patient).delete()
    PrescriptionLine.objects.filter(consultation__patient=patient).delete()
    ExamRequest.objects.filter(consultation__patient=patient).delete()
    FollowUpPlanRevision.objects.filter(plan__patient=patient).delete()
    FollowUpPlan.objects.filter(patient=patient).delete()
    MedicalDocument.objects.filter(patient=patient).delete()
    Vaccination.objects.filter(patient=patient).delete()
    HealthMeasurement.objects.filter(patient=patient).delete()
    MedicationReminder.objects.filter(patient=patient).delete()
    Appointment.objects.filter(patient=patient).delete()
    PatientNotification.objects.filter(patient=patient).delete()
    PatientAccessQrToken.objects.filter(patient=patient).delete()
    PatientAccessSummaryPreference.objects.filter(patient=patient).delete()
    PatientEmergencyCard.objects.filter(patient=patient).delete()
    PreConsultationRevision.objects.filter(encounter__patient=patient).delete()

    # 3) Lignes qui doivent rester (clés étrangères du journal d'audit) : on efface tout leur contenu.
    Consultation.objects.filter(patient=patient).update(
        professional_name="", facility_label="", reason="", observations="", symptoms="", clinical_exam="", diagnosis="", vitals={}, conclusion="", care_plan="",
        attestation_svg="", attestation_svg_hash="", attestation_signed_at=None, signature_asset_id="", stamp_asset_id="",
    )
    CareEncounter.objects.filter(patient=patient).update(
        facility_label="", reason="", observations="", recorded_with_help="", vitals={}, template_responses={}, status="closed", closed_at=now,
    )
    AccessGrant.objects.filter(patient=patient, status__in=("pending", "active")).update(status="revoked", revoked_at=now)
    EmergencyAccessRequest.objects.filter(patient=patient).update(reason_note="")
    CareReferral.objects.filter(patient=patient).update(reason_note="")

    # 4) Le profil : identité, coordonnées, couverture et photo vidés (l'identifiant technique reste, sans rien d'identifiant).
    clear_child_avatar(patient)
    PatientProfile.objects.filter(pk=patient.pk).update(
        first_name="", last_name="", phone="", birth_date=None, gender="", address="", profession="",
        coverage_provider="", coverage_number="", coverage_expiry=None, avatar_url="", avatar_data="", updated_at=now,
    )

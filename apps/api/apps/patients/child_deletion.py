"""Suppression d'un profil d'enfant, avec motif, par son représentant.

La suppression est IMMÉDIATE et IRRÉVERSIBLE : toutes les données de l'enfant sont effacées de la base (voir erasure.py), la photo est détruite chez le
prestataire de fichiers, les accès ouverts sont révoqués et le lien de représentation passe à « deleted » (il ne peut plus être réactivé). Ne restent que les
lignes que le journal d'audit protégé référence, vidées de tout contenu (profil sans identité, consultations et prises en charge sans contenu).
"""
from .erasure import erase_patient_records
from .models import PatientProfile, RepresentationTransferRequest

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
    """Efface les données de l'enfant (nom conservé pour compatibilité des appels). À appeler dans une transaction : un refus du service de fichiers l'annule."""
    erase_patient_records(patient)
    RepresentationTransferRequest.objects.filter(representation__patient=patient, status="pending").update(status="rejected")

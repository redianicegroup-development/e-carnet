"""Déclarations avec justificatifs, partagées avec un établissement et attestées par un professionnel habilité.
Principes : le patient décide (chaque partage est explicite et retirable) ; seul un professionnel attesté-habilité peut attester ;
une attestation par partage (le premier gagne) ; le contenu attesté est figé ; rien ici n'ouvre le reste du carnet."""
import hashlib
import os
import uuid
import zipfile
from datetime import date
from io import BytesIO

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.audit.services import record_event
from apps.care.models import AccessGrant, Consultation
from apps.care.notifications import notify_patient
from apps.establishments.models import Establishment
from apps.patients.models import ClinicalDeclaration
from apps.professionals.access import professional_clinical_access_error

from .models import AttestationEvent, DeclarationAttachment, DeclarationAttestation, DeclarationShare

NEW_KINDS = ("allergy", "antecedent", "surgery", "implant", "other_medical")
MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES, MAX_SHARES = 5, 8 * 1024 * 1024, 20 * 1024 * 1024, 5
DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
STATUS_LABELS = {"pending": "À attester", "info_requested": "Informations demandées", "attested": "Attestée", "revoked": "Retirée"}
WAITING_MESSAGE = "En attente de la première consultation du patient dans votre établissement."


class AttestationError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def setting(name, default=""):
    value = getattr(settings, name, None)
    return os.environ.get(name, default) if value is None else value


def sniff(data, extension):
    """Extension ET signature réelle doivent correspondre. Les .docx sont inspectés (archive, pas de macros, pas de bombe)."""
    if extension == ".pdf" and data.startswith(b"%PDF-"):
        return "application/pdf"
    if extension == ".png" and data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if extension in (".jpg", ".jpeg") and data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if extension == ".docx" and data.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(BytesIO(data)) as archive:
                names = archive.namelist()
                if "[Content_Types].xml" not in names or not any(name.startswith("word/") for name in names) or any(name.lower().endswith("vbaproject.bin") for name in names):
                    return None
                if len(names) > 2000 or sum(info.file_size for info in archive.infolist()) > 100 * 1024 * 1024:
                    return None
        except (zipfile.BadZipFile, OSError):
            return None
        return DOCX_TYPE
    return None


def read_attachment(upload):
    name = upload.name.rsplit("/", 1)[-1].replace("\\", "_")[:180]
    extension = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if upload.size > MAX_FILE_BYTES:
        raise AttestationError(f"« {name} » dépasse 8 Mo.")
    data = upload.read()
    content_type = sniff(data, extension)
    if not content_type:
        raise AttestationError(f"« {name} » : format refusé. Utilisez un PDF, un PNG, un JPG ou un DOCX valide.")
    return {"name": name, "content_type": content_type, "data": data, "sha256": hashlib.sha256(data).hexdigest(), "size": len(data)}


def clean_declaration(payload):
    kind = str(payload.get("kind", ""))
    if kind not in NEW_KINDS:
        raise AttestationError("Choisissez une catégorie : allergie, antécédent, intervention, implant ou autre.")
    label = str(payload.get("label", "")).strip()
    if not 3 <= len(label) <= 160:
        raise AttestationError("Le titre doit faire entre 3 et 160 caractères.")
    details = str(payload.get("details", "")).strip()[:2000]
    raw_date = str(payload.get("event_date", "") or "").strip()
    event_date = None
    if raw_date:
        try:
            event_date = date.fromisoformat(raw_date)
        except ValueError:
            raise AttestationError("Date invalide.")
        if event_date > timezone.localdate():
            raise AttestationError("La date ne peut pas être dans le futur.")
    return kind, label, details, event_date


def log(declaration, kind, actor_label="", detail=""):
    return AttestationEvent.objects.create(declaration=declaration, kind=kind, actor_label=actor_label[:160], detail=detail[:300])


def patient_seen(patient, establishment):
    """Le patient a déjà été reçu : un accès ouvert (même terminé) ou une consultation dans cet établissement."""
    return AccessGrant.objects.filter(patient=patient, establishment=establishment, starts_at__isnull=False).exists() or Consultation.objects.filter(patient=patient, establishment=establishment).exists()


def eligible_establishments(ids):
    ids = list(dict.fromkeys(str(value) for value in ids if value))
    if len(ids) > MAX_SHARES:
        raise AttestationError(f"Vous pouvez partager avec {MAX_SHARES} établissements au plus.")
    try:
        ids = [str(uuid.UUID(value)) for value in ids]
    except ValueError:
        raise AttestationError("Établissement invalide.")
    found = list(Establishment.objects.filter(pk__in=ids, status="active", is_laboratory=False))
    if len(found) != len(ids):
        raise AttestationError("Choisissez uniquement des établissements actifs.")
    return found


def share_declaration(declaration, establishments, patient_user=None):
    created = []
    for establishment in establishments:
        if DeclarationShare.objects.filter(declaration=declaration, establishment=establishment).exclude(status="revoked").exists():
            raise AttestationError(f"Cette déclaration est déjà partagée avec {establishment.name}.")
        share = DeclarationShare.objects.create(declaration=declaration, establishment=establishment)
        log(declaration, "shared", "Patient", f"Partagée avec {establishment.name}")
        if patient_user is not None:
            record_event(event_type="declaration.shared", actor=patient_user, actor_role="patient", patient=declaration.patient, establishment=establishment, metadata={"declaration_id": str(declaration.id), "resource_type": "declaration_share", "resource_id": str(share.id)})
        created.append(share)
    return created


@transaction.atomic
def create_declaration(patient, payload, uploads, establishment_ids, patient_user):
    kind, label, details, event_date = clean_declaration(payload)
    if len(uploads) > MAX_FILES:
        raise AttestationError(f"{MAX_FILES} justificatifs au plus.")
    files = [read_attachment(upload) for upload in uploads]
    if sum(item["size"] for item in files) > MAX_TOTAL_BYTES:
        raise AttestationError("Les justificatifs dépassent 20 Mo au total.")
    establishments = eligible_establishments(establishment_ids)
    if ClinicalDeclaration.objects.filter(patient=patient, kind=kind, label=label).exists():
        raise AttestationError("Une déclaration avec le même type et le même titre existe déjà. Changez le titre.")
    declaration = ClinicalDeclaration.objects.create(patient=patient, kind=kind, label=label, details=details, event_date=event_date)
    for item in files:
        DeclarationAttachment.objects.create(declaration=declaration, original_name=item["name"], content_type=item["content_type"], size_bytes=item["size"], sha256=item["sha256"], data=item["data"])
    log(declaration, "created", "Patient", f"{len(files)} justificatif(s)")
    share_declaration(declaration, establishments, patient_user)
    return declaration


@transaction.atomic
def share_existing(declaration, establishment_ids, patient_user):
    if declaration.status != "declared" or declaration.kind not in NEW_KINDS:
        raise AttestationError("Cette déclaration ne peut pas être partagée.")
    return share_declaration(declaration, eligible_establishments(establishment_ids), patient_user)


@transaction.atomic
def revoke_share(share, patient_user):
    if share.status == "revoked":
        return share
    share.status, share.revoked_at = "revoked", timezone.now()
    share.save(update_fields=["status", "revoked_at"])
    log(share.declaration, "share_revoked", "Patient", f"Partage retiré pour {share.establishment.name}")
    record_event(event_type="declaration.share_revoked", actor=patient_user, actor_role="patient", patient=share.declaration.patient, establishment=share.establishment, metadata={"declaration_id": str(share.declaration_id), "resource_type": "declaration_share", "resource_id": str(share.id)})
    return share


@transaction.atomic
def report_error(share, message, patient_user):
    message = str(message or "").strip()
    if share.status != "attested":
        raise AttestationError("Seule une déclaration attestée peut faire l’objet d’un signalement.")
    if not 5 <= len(message) <= 300:
        raise AttestationError("Décrivez l’erreur en 5 à 300 caractères.")
    share.error_message, share.error_reported_at = message, timezone.now()
    share.save(update_fields=["error_message", "error_reported_at"])
    log(share.declaration, "error_reported", "Patient", message)
    return share


def attest_policy_error(profile, declaration):
    """Habilitation V1, volontairement prudente. À remplacer par la grille validée avec le référent médical (catégorie par profession)."""
    if profile.active_establishment.is_laboratory:
        return "Les laboratoires n’attestent pas encore les déclarations."
    if declaration.patient.user_id and declaration.patient.user_id == profile.user_id:
        return "Vous ne pouvez pas attester vos propres déclarations."
    allowed = [title.strip().lower() for title in str(setting("ATTESTATION_ALLOWED_TITLES", "")).split(",") if title.strip()]
    if allowed and profile.professional_title.strip().lower() not in allowed:
        return "Votre profil professionnel n’est pas habilité à attester une déclaration."
    if not (profile.signature_cloudinary_public_id or profile.stamp_cloudinary_public_id):
        return "Ajoutez votre signature ou votre cachet à votre profil pour attester."
    return None


def professional_name(profile):
    user = profile.user
    full = (user.get_full_name() or "").strip() if hasattr(user, "get_full_name") else ""
    return full or profile.professional_title


def snapshot_of(declaration):
    return {"kind": declaration.kind, "kind_label": declaration.get_kind_display(), "label": declaration.label, "details": declaration.details,
            "event_date": declaration.event_date.isoformat() if declaration.event_date else None, "declared_at": declaration.created_at.isoformat(),
            "attachments": [{"name": item.original_name, "sha256": item.sha256, "size_bytes": item.size_bytes} for item in declaration.attachments.defer("data")]}


def _gate(profile):
    error = professional_clinical_access_error(profile)
    if error:
        raise AttestationError(error, 403)


@transaction.atomic
def attest(share_id, profile):
    _gate(profile)
    share = DeclarationShare.objects.select_for_update().select_related("declaration__patient", "establishment").filter(pk=share_id, establishment_id=profile.active_establishment_id).first()
    if share is None:
        raise AttestationError("Déclaration introuvable pour votre établissement.", 404)
    declaration = share.declaration
    if share.status == "attested":
        existing = share.attestation
        raise AttestationError(f"Déjà attestée par {existing.professional_name}.", 409)
    if share.status == "revoked" or declaration.status != "declared":
        raise AttestationError("Le patient a retiré cette déclaration.", 409)
    policy = attest_policy_error(profile, declaration)
    if policy:
        raise AttestationError(policy, 403)
    if not patient_seen(declaration.patient, share.establishment):
        raise AttestationError(WAITING_MESSAGE, 409)
    fingerprint = hashlib.sha256(f"{profile.signature_cloudinary_public_id}:{profile.signature_cloudinary_version}:{profile.stamp_cloudinary_public_id}:{profile.stamp_cloudinary_version}".encode()).hexdigest()
    try:
        with transaction.atomic():
            attestation = DeclarationAttestation.objects.create(share=share, professional=profile.user, professional_name=professional_name(profile), professional_title=profile.professional_title, professional_specialty=profile.specialty, professional_identifier=profile.professional_identifier, signature_fingerprint=fingerprint, snapshot=snapshot_of(declaration))
    except IntegrityError:
        raise AttestationError("Cette déclaration vient d’être attestée par un autre professionnel.", 409)
    share.status, share.info_message = "attested", ""
    share.save(update_fields=["status", "info_message"])
    log(declaration, "attested", attestation.professional_name, f"{attestation.professional_title}, {share.establishment.name}")
    record_event(event_type="declaration.attested", actor=profile.user, actor_role="professional", patient=declaration.patient, establishment=share.establishment, metadata={"declaration_id": str(declaration.id), "resource_type": "declaration_share", "resource_id": str(share.id)})
    patient, title = declaration.patient, f"{attestation.professional_name} a attesté « {declaration.label} »"
    transaction.on_commit(lambda: _notify(patient, "declaration_attested", "Déclaration attestée", title, declaration))
    return attestation


@transaction.atomic
def request_info(share_id, profile, message):
    _gate(profile)
    message = str(message or "").strip()
    if not 5 <= len(message) <= 300:
        raise AttestationError("Précisez ce qu’il manque en 5 à 300 caractères.")
    share = DeclarationShare.objects.select_for_update().select_related("declaration__patient").filter(pk=share_id, establishment_id=profile.active_establishment_id).first()
    if share is None:
        raise AttestationError("Déclaration introuvable pour votre établissement.", 404)
    if share.status not in ("pending", "info_requested") or share.declaration.status != "declared":
        raise AttestationError("Cette déclaration n’est plus à traiter.", 409)
    share.status, share.info_message = "info_requested", message
    share.save(update_fields=["status", "info_message"])
    log(share.declaration, "info_requested", professional_name(profile), message)
    declaration, patient = share.declaration, share.declaration.patient
    transaction.on_commit(lambda: _notify(patient, "declaration_info_requested", "Informations demandées", f"Votre établissement demande une précision sur « {declaration.label} » : {message}", declaration))
    return share


def _notify(patient, kind, title, body, declaration):
    try:
        notify_patient(patient, kind, title, body, metadata={"declaration_id": str(declaration.id)})
    except Exception:  # la notification ne doit jamais défaire une attestation déjà enregistrée
        pass

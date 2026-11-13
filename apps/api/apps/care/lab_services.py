"""PRO-21 — dépôt d'un résultat par un laboratoire. Le laboratoire ne lit rien : il reconnaît la personne, puis dépose un PDF."""
import uuid
from datetime import date

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditEvent
from apps.audit.services import record_event
from apps.cloudinary_storage import CLOUDINARY_CONFIGURED, upload as cloudinary_upload

from .models import MedicalDocument, PendingExam
from .notifications import notify_patient
from .pdf_compression import compress_pdf_lossless
from .pending_services import DISABLED_MESSAGE, lab_enabled, refresh_pending_status, resolve_exam_qr

# Même message partout : un QR inconnu, périmé, révoqué ou d'une attente terminée ne se distinguent pas.
QR_INVALID_MESSAGE = "Ce QR d’examen est invalide, expiré ou n’attend plus de résultat."
EXAM_KIND_TO_DOCUMENT_TYPE = {"analysis": "analysis", "imaging": "imaging", "other": "other"}


def _read_pdf(uploaded):
    from .views import DOCUMENT_MAX_SIZE, _document_signature  # import tardif : `views` n'importe jamais ce module au chargement

    if not uploaded:
        raise ValidationError({"file": "Sélectionnez le résultat au format PDF."})
    filename = uploaded.name.rsplit("/", 1)[-1].replace("\\", "_")[:180]
    extension = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension != ".pdf":
        raise ValidationError({"file": "Seul le format PDF est accepté pour un résultat de laboratoire."})
    try:
        uploaded.seek(0, 2)
        size = uploaded.tell()
        uploaded.seek(0)
    except (AttributeError, OSError):
        size = uploaded.size
    if size > DOCUMENT_MAX_SIZE:
        raise ValidationError({"file": "Le fichier ne doit pas dépasser 10 MiB."})
    # L'extension ne suffit pas : la signature réelle du fichier doit être celle d'un PDF.
    if _document_signature(uploaded, extension) != "application/pdf":
        raise ValidationError({"file": "Ce fichier n’est pas un PDF valide."})
    uploaded.seek(0)
    original = uploaded.read()
    optimized = compress_pdf_lossless(original)
    content = optimized if len(optimized) < len(original) else original
    return filename, content


@transaction.atomic
def deposit_lab_result(*, user, lab, token, exam_id, uploaded, identity_confirmed, document_date=None):
    """Dépose le PDF d'un examen. Le laboratoire doit avoir confirmé l'identité (nom + date de naissance affichés au scan).

    Un second dépôt pour le même examen, par le MÊME laboratoire et tant que la consultation n'est pas signée, est une correction :
    l'ancien PDF reste lisible, marqué « remplacé ». Un résultat d'un autre laboratoire n'est jamais écrasé."""
    if not lab_enabled():
        raise ValidationError(DISABLED_MESSAGE)
    if identity_confirmed is not True:
        raise ValidationError("Confirmez que la personne présente correspond au nom et à la date de naissance affichés.")
    pending = resolve_exam_qr(token, lock=True)
    if not pending:
        raise ValidationError(QR_INVALID_MESSAGE)
    exam = PendingExam.objects.select_for_update().filter(pk=exam_id, pending=pending).first()
    if not exam:
        raise ValidationError("Cet examen ne fait pas partie de cette demande.")
    if exam.status == "abandoned":
        raise ValidationError("Cet examen a été abandonné par le médecin : aucun résultat n’est attendu.")
    previous = None
    if exam.status == "result_received":
        previous = MedicalDocument.objects.filter(pending_exam=exam, lab_depositor__isnull=False, superseded_by__isnull=True).order_by("-created_at").first()
        if previous and previous.establishment_id != lab.id:
            raise ValidationError("Un résultat a déjà été déposé pour cet examen par un autre laboratoire.")
    if document_date:
        try:
            date.fromisoformat(str(document_date))
        except ValueError:
            raise ValidationError({"document_date": "Date invalide."})
    filename, content = _read_pdf(uploaded)

    now = timezone.now()
    values = dict(
        patient=pending.patient, establishment=lab, professional=None, lab_depositor=user, validated_at=now, verified=True,
        pending_exam=exam, original_name=filename, document_type=EXAM_KIND_TO_DOCUMENT_TYPE.get(exam.kind, "other"),
        document_date=document_date or None, issuer=lab.name[:180], content_type="application/pdf", size_bytes=len(content),
    )
    if CLOUDINARY_CONFIGURED:
        result = cloudinary_upload(ContentFile(content, name=filename), folder="medical-documents", public_id=f"{pending.patient_id}/{uuid.uuid4()}", resource_type="raw")
        values.update(cloudinary_public_id=result["public_id"], cloudinary_resource_type="raw", cloudinary_version=result.get("version"))
    elif settings.DEBUG or getattr(settings, "RUNNING_TESTS", False):
        values["file"] = ContentFile(content, name=filename)
    else:
        raise ValidationError({"file": "Le stockage Cloudinary n’est pas configuré."})
    document = MedicalDocument.objects.create(**values)
    if previous:
        previous.superseded_by = document
        previous.save(update_fields=("superseded_by",))
    exam.status, exam.lab_establishment, exam.result_received_at = "result_received", lab, now
    exam.save(update_fields=("status", "lab_establishment", "result_received_at"))
    record_event(
        event_type="lab_result.deposited", actor=user, actor_role="laboratory", patient=pending.patient, establishment=lab,
        metadata={"action": "replaced" if previous else "deposited", "resource_type": "medical_document", "resource_id": str(document.id), "status": exam.status},
    )
    notify_patient(
        pending.patient, kind="lab.result_received", title="Résultat d’examen reçu",
        body=f"{lab.name} a déposé le résultat de « {exam.label} » dans votre carnet.",
        metadata={"pending_consultation_id": str(pending.id), "document_id": str(document.id)},
    )
    refresh_pending_status(pending)
    return document


# ---------- historique des dépôts du laboratoire ----------
HISTORY_LIMIT = 200  # lignes par source (dépôts, examens abandonnés) ; au-delà, `truncated` le dit
HISTORY_STATUSES = ("deposited", "replaced", "abandoned")
HISTORY_QR_SCAN = 500  # derniers QR d'examen lus par ce laboratoire, d'où l'on retrouve les examens abandonnés qui le concernaient


def _history_initials(patient):
    first, last = (patient.display_first_name() or "").strip(), (patient.display_last_name() or "").strip()
    return " ".join(f"{part[0].upper()}." for part in (first, last) if part)


def lab_history(*, lab, status=None, date_from=None, date_to=None):
    """Ce que le laboratoire peut relire de son activité : examen, type, statut, initiales + année de naissance, date. Jamais le nom
    complet ni le contenu d'un PDF.

    Statuts : `deposited` (résultat déposé), `replaced` (remplacé par une version corrigée), `abandoned` (le médecin a renoncé à
    l'examen : seuls les examens des QR que CE laboratoire a lus remontent ; le motif du médecin n'est jamais montré). `date_from`
    et `date_to` (inclusives) portent sur la date du dépôt, ou de l'abandon. `counts` ignore le filtre de statut, pour que les puces
    d'interface affichent leurs effectifs."""
    documents = MedicalDocument.objects.filter(establishment=lab, lab_depositor__isnull=False).select_related("patient", "pending_exam")
    if date_from:
        documents = documents.filter(created_at__date__gte=date_from)
    if date_to:
        documents = documents.filter(created_at__date__lte=date_to)
    documents = list(documents.order_by("-created_at")[:HISTORY_LIMIT])
    items = [{
        "id": str(document.id),
        "status": "replaced" if document.superseded_by_id else "deposited",
        "exam_label": document.pending_exam.label if document.pending_exam_id else "",
        "exam_kind": document.pending_exam.kind if document.pending_exam_id else "",
        "original_name": document.original_name,
        "patient_initials": _history_initials(document.patient),
        "birth_year": document.patient.birth_date.year if document.patient.birth_date else None,
        "occurred_at": document.created_at,
        "created_at": document.created_at,
    } for document in documents]

    resolved = set()
    for metadata in AuditEvent.objects.filter(event_type="lab_exam_qr.resolved", establishment=lab).order_by("-created_at").values_list("metadata", flat=True)[:HISTORY_QR_SCAN]:
        pending_id = (metadata or {}).get("resource_id")
        if pending_id:
            resolved.add(str(pending_id))
    abandoned = PendingExam.objects.filter(status="abandoned", pending_id__in=resolved, abandoned_at__isnull=False).select_related("pending__patient")
    if date_from:
        abandoned = abandoned.filter(abandoned_at__date__gte=date_from)
    if date_to:
        abandoned = abandoned.filter(abandoned_at__date__lte=date_to)
    abandoned = list(abandoned.order_by("-abandoned_at")[:HISTORY_LIMIT])
    items += [{
        "id": str(exam.id), "status": "abandoned", "exam_label": exam.label, "exam_kind": exam.kind, "original_name": "",
        "patient_initials": _history_initials(exam.pending.patient),
        "birth_year": exam.pending.patient.birth_date.year if exam.pending.patient.birth_date else None,
        "occurred_at": exam.abandoned_at, "created_at": exam.abandoned_at,
    } for exam in abandoned]

    counts = {key: sum(1 for item in items if item["status"] == key) for key in HISTORY_STATUSES}
    counts["all"] = len(items)
    if status:
        items = [item for item in items if item["status"] == status]
    items.sort(key=lambda item: item["occurred_at"], reverse=True)
    return {"items": items[:HISTORY_LIMIT], "counts": counts, "truncated": len(documents) >= HISTORY_LIMIT or len(abandoned) >= HISTORY_LIMIT}

"""PRO-21 — consultation en attente de résultats : règles métier (sans HTTP).

Parcours : le médecin demande un ou plusieurs examens et clique « Attendre les résultats » → `create_pending_consultation`
(son accès se ferme, la consultation ne peut plus être signée) → le patient montre son QR d'examen au laboratoire → le
laboratoire dépose un PDF par examen (`lab_services.deposit_lab_result`) → quand plus aucun examen n'est « demandé », la
consultation passe à « à reprendre » → le médecin, avec un NOUVEAU QR d'accès du patient, reprend, relit les résultats et signe
(`consultation_services.validate_consultation`, qui rattache examens et PDF à la vraie consultation).

Rien ici ne donne au laboratoire de lecture clinique : il ne reçoit jamais plus que ce que `lab_view_of` expose."""
import hashlib
import hmac
import json
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.audit.services import record_event
from apps.professionals.access import professional_clinical_access_error

from .models import AccessGrant, CareEncounter, MedicalDocument, PendingConsultation, PendingExam
from .notifications import notify_patient
from .services import END_REASON_WAITING_RESULTS, SELF_ACCESS_MESSAGE, end_access_grant, is_own_patient_file, require_scope

QR_PREFIX = "EXQ1"
ABANDON_REASON_MAX = 240

# Champs de la saisie du médecin conservés dans le brouillon de la consultation en attente (jamais l'attestation : on signe à la reprise).
DRAFT_FIELDS = ("reason", "symptoms", "clinical_exam", "diagnosis", "observations", "vitals", "prescription_lines", "conclusion", "care_plan")

DISABLED_MESSAGE = "Cette fonction n’est pas activée."
BLOCKED_BY_PENDING_MESSAGE = "Une consultation est en attente de résultats pour cette pré-consultation : elle doit être reprise ou annulée avant de signer."
WAITING_MESSAGE = "Cette consultation attend encore des résultats d’examens. Attendez-les, ou abandonnez l’examen manquant en indiquant le motif."


def lab_enabled():
    return bool(getattr(settings, "ECARNET_LAB_ENABLED", False))


# ---------------------------------------------------------------- QR d'examen

def _mac(pending):
    message = f"exam-qr:{pending.id}:{pending.qr_version}".encode("utf-8")
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()[:40]


def exam_qr_token(pending):
    """Jeton du QR d'examen : opaque, lié à CETTE consultation, recalculable donc jamais stocké (le patient peut l'afficher ou le masquer
    à volonté). Il ne contient ni nom, ni donnée de santé."""
    return f"{QR_PREFIX}.{pending.id.hex}.{_mac(pending)}"


def exam_qr_is_valid(pending):
    return pending.status in PendingConsultation.OPEN_STATUSES and pending.qr_expires_at > timezone.now()


def resolve_exam_qr(raw, *, lock=False):
    """Consultation en attente désignée par ce QR, ou None. Signature, version, expiration et état sont vérifiés ; aucun message ne dit
    LAQUELLE de ces vérifications a échoué (un QR périmé, forgé ou révoqué ne se distinguent pas)."""
    parts = str(raw or "").strip().split(".")
    if len(parts) != 3 or parts[0] != QR_PREFIX or len(parts[1]) != 32:
        return None
    try:
        import uuid as _uuid
        pending_id = _uuid.UUID(hex=parts[1])
    except ValueError:
        return None
    query = PendingConsultation.objects.select_for_update() if lock else PendingConsultation.objects
    pending = query.filter(pk=pending_id).first()
    if not pending or not hmac.compare_digest(parts[2], _mac(pending)) or not exam_qr_is_valid(pending):
        return None
    return pending


def renew_exam_qr(pending, *, actor, actor_role="patient"):
    """Nouveau QR : l'ancien cesse de fonctionner (changement de version) et la durée de vie repart."""
    if pending.status not in PendingConsultation.OPEN_STATUSES:
        raise ValidationError("Cette consultation n’attend plus de résultats.")
    pending.qr_version += 1
    pending.qr_expires_at = timezone.now() + timedelta(days=settings.ECARNET_EXAM_QR_TTL_DAYS)
    pending.save(update_fields=("qr_version", "qr_expires_at", "updated_at"))
    record_event(event_type="exam_qr.renewed", actor=actor, actor_role=actor_role, patient=pending.patient, establishment=pending.establishment, metadata={"action": "renewed", "resource_type": "pending_consultation", "resource_id": str(pending.id)})
    return pending


def revoke_exam_qr(pending, *, actor, actor_role="patient"):
    """Le patient retire le QR : plus aucun laboratoire ne peut le résoudre tant qu'il n'en demande pas un nouveau."""
    pending.qr_version += 1
    pending.qr_expires_at = timezone.now()
    pending.save(update_fields=("qr_version", "qr_expires_at", "updated_at"))
    record_event(event_type="exam_qr.revoked", actor=actor, actor_role=actor_role, patient=pending.patient, establishment=pending.establishment, metadata={"action": "revoked", "resource_type": "pending_consultation", "resource_id": str(pending.id)})
    return pending


# ---------------------------------------------------------------- création de l'attente

def _jsonable(value):
    return json.loads(json.dumps(value, default=str))


@transaction.atomic
def create_pending_consultation(*, professional, data):
    """« Attendre les résultats » : enregistre la saisie du médecin sans la signer, ferme son accès, ouvre l'attente.

    `data` est la sortie validée de `PendingConsultationCreateSerializer`. Mêmes garde-fous que la signature : accès actif dans
    l'établissement courant, périmètre `preconsultation`, jamais son propre dossier, pré-consultation encore en brouillon."""
    if not lab_enabled():
        raise ValidationError(DISABLED_MESSAGE)
    access_error = professional_clinical_access_error(professional)
    if access_error:
        raise ValidationError(access_error)
    establishment = professional.active_establishment
    grant = AccessGrant.objects.select_related("patient", "establishment").filter(id=data["access_grant_id"], professional=professional).first()
    if not grant:
        raise ValidationError("AccessGrant introuvable dans votre périmètre.")
    if is_own_patient_file(professional, grant.patient):
        raise ValidationError(SELF_ACCESS_MESSAGE)
    grant.refresh_expiration()
    if grant.status != "active" or grant.establishment_id != establishment.id:
        raise ValidationError("L’AccessGrant n’est plus actif dans votre établissement courant.")
    require_scope(grant, "preconsultation")
    encounter = CareEncounter.objects.select_for_update().filter(id=data["source_encounter_id"], patient=grant.patient).first()
    if not encounter:
        raise ValidationError("Cette pré-consultation n’existe pas pour ce patient.")
    if encounter.status != "draft":
        raise ValidationError("Cette pré-consultation est déjà clôturée.")
    if PendingConsultation.objects.filter(source_encounter=encounter, status__in=PendingConsultation.OPEN_STATUSES).exists():
        raise ValidationError(BLOCKED_BY_PENDING_MESSAGE)
    exams = data.get("requested_exams") or []
    if not exams:
        raise ValidationError("Demandez au moins un examen avant d’attendre des résultats.")

    draft = {key: _jsonable(data[key]) for key in DRAFT_FIELDS if key in data}
    draft.setdefault("reason", encounter.reason)
    pending = PendingConsultation.objects.create(
        patient=grant.patient, professional=professional, establishment=establishment, source_encounter=encounter, draft=draft,
        qr_expires_at=timezone.now() + timedelta(days=settings.ECARNET_EXAM_QR_TTL_DAYS),
    )
    used_proofs = set()
    rows = []
    for index, exam in enumerate(exams):
        proof = None
        proof_id = exam.get("proof_document_id")
        if proof_id:
            # Même règle qu'à la signature : photo envoyée par ce médecin, pour ce patient, jamais déjà utilisée.
            proof = MedicalDocument.objects.filter(id=proof_id, patient=grant.patient, professional=professional, exam_request_proofs__isnull=True, pending_exam_proofs__isnull=True).first()
            if not proof or proof_id in used_proofs:
                raise ValidationError("La photo de la demande d’examen est introuvable ou déjà utilisée.")
            used_proofs.add(proof_id)
        label = (exam.get("label") or "").strip() or "Examen (voir la photo jointe)"
        rows.append(PendingExam(pending=pending, position=index, kind=exam["kind"], label=label, proof_document=proof))
    PendingExam.objects.bulk_create(rows)
    record_event(
        event_type="pending_consultation.created", actor=professional.user, actor_role="professional", patient=grant.patient, establishment=establishment, access_grant=grant,
        metadata={"action": "created", "resource_type": "pending_consultation", "resource_id": str(pending.id), "resource_count": len(rows), "encounter_id": str(encounter.id)},
    )
    # L'accès se ferme (le patient est libre d'aller voir quelqu'un d'autre) et le patient en est prévenu, avec la marche à suivre.
    end_access_grant(grant, actor=professional.user, reason=END_REASON_WAITING_RESULTS)
    return pending


# ---------------------------------------------------------------- vie de l'attente

def refresh_pending_status(pending):
    """Plus aucun examen « demandé » : la consultation est à reprendre (résultats reçus, ou examens abandonnés)."""
    if pending.status != "waiting_results":
        return pending
    if not pending.exams.filter(status="requested").exists():
        pending.status = "to_resume"
        pending.save(update_fields=("status", "updated_at"))
        notify_patient(
            pending.patient, kind="exam.results_ready", title="Résultats d’examens reçus",
            body="Vos résultats sont dans votre carnet. Montrez votre QR d’accès à votre médecin pour qu’il reprenne votre consultation.",
            metadata={"pending_consultation_id": str(pending.id)},
        )
        _push_professional(pending, "Consultation à reprendre", "Les résultats attendus sont arrivés : reprenez la consultation lorsque le patient présente son QR.")
    return pending


def _push_professional(pending, title, body):
    user_id = getattr(pending.professional, "user_id", None)
    if not user_id:
        return
    from .push import send_push_to_user

    transaction.on_commit(lambda: send_push_to_user(user_id, kind="exam.results_ready", title=title, body=body, url="/professionnel/consultations", data={"pending_consultation_id": str(pending.id)}))


@transaction.atomic
def abandon_exam(*, professional, pending_id, exam_id, reason):
    """Sortie de secours du blocage : le médecin renonce à un examen, avec un motif écrit et audité."""
    if not lab_enabled():
        raise ValidationError(DISABLED_MESSAGE)
    reason = " ".join(str(reason or "").split())
    if len(reason) < 5:
        raise ValidationError("Indiquez le motif de l’abandon (5 caractères minimum).")
    if len(reason) > ABANDON_REASON_MAX:
        raise ValidationError(f"Le motif est limité à {ABANDON_REASON_MAX} caractères.")
    pending = PendingConsultation.objects.select_for_update().filter(pk=pending_id, professional=professional, status="waiting_results").first()
    if not pending:
        raise ValidationError("Consultation en attente introuvable.")
    exam = PendingExam.objects.select_for_update().filter(pk=exam_id, pending=pending, status="requested").first()
    if not exam:
        raise ValidationError("Cet examen n’est plus en attente de résultat.")
    exam.status, exam.abandon_reason, exam.abandoned_at = "abandoned", reason, timezone.now()
    exam.save(update_fields=("status", "abandon_reason", "abandoned_at"))
    record_event(event_type="pending_exam.abandoned", actor=professional.user, actor_role="professional", patient=pending.patient, establishment=pending.establishment, metadata={"action": "abandoned", "resource_type": "pending_exam", "resource_id": str(exam.id), "reason_category": "professional_decision"})
    refresh_pending_status(pending)
    return pending


@transaction.atomic
def cancel_pending_consultation(*, patient, pending_id, actor, actor_role="patient"):
    """Le patient annule l'attente (il ne fera pas l'examen, ou veut voir un autre médecin). Le brouillon du médecin n'est pas perdu
    pour autant : la ligne reste, au statut « annulée »."""
    if not lab_enabled():
        raise ValidationError(DISABLED_MESSAGE)
    pending = PendingConsultation.objects.select_for_update().filter(pk=pending_id, patient=patient, status__in=PendingConsultation.OPEN_STATUSES).first()
    if not pending:
        raise ValidationError("Consultation en attente introuvable.")
    pending.status = "cancelled"
    pending.qr_expires_at = timezone.now()
    pending.save(update_fields=("status", "qr_expires_at", "updated_at"))
    record_event(event_type="pending_consultation.cancelled", actor=actor, actor_role=actor_role, patient=patient, establishment=pending.establishment, metadata={"action": "cancelled", "resource_type": "pending_consultation", "resource_id": str(pending.id), "reason_category": "patient_decision"})
    _push_professional(pending, "Attente annulée", "Le patient a annulé l’attente de résultats.")
    return pending


# ---------------------------------------------------------------- lien avec la signature

def open_pending_for_encounter(encounter, *, lock=False):
    query = PendingConsultation.objects.select_for_update() if lock else PendingConsultation.objects
    return query.filter(source_encounter=encounter, status__in=PendingConsultation.OPEN_STATUSES).first()


def pending_for_signature(*, encounter, professional, pending_id):
    """Appelée par `validate_consultation`. Renvoie la consultation en attente à finaliser, ou None s'il n'y en a pas.

    - aucune attente ouverte → None (parcours habituel, inchangé) ;
    - une attente ouverte mais ni demandée ni au nom de ce médecin → refus (personne ne signe « par-dessus ») ;
    - toujours en attente de résultats → refus : c'est le blocage voulu ;
    - à reprendre → la consultation en attente."""
    pending = open_pending_for_encounter(encounter, lock=True)
    if not pending:
        return None
    if pending.professional_id != professional.id or not pending_id or str(pending.id) != str(pending_id):
        raise ValidationError(BLOCKED_BY_PENDING_MESSAGE)
    if pending.status == "waiting_results":
        raise ValidationError(WAITING_MESSAGE)
    return pending


def attach_pending_to_consultation(pending, consultation, *, now):
    """À la signature : chaque examen devient un `ExamRequest` de la vraie consultation, les PDF reçus lui sont rattachés."""
    from .models import ExamRequest

    for exam in pending.exams.all():
        request_status = "result_received" if exam.status == "result_received" else "requested"
        exam_request = ExamRequest.objects.create(consultation=consultation, position=exam.position, kind=exam.kind, label=exam.label, status=request_status, proof_document=exam.proof_document)
        MedicalDocument.objects.filter(pending_exam=exam).update(exam_request=exam_request)
    pending.status, pending.consultation, pending.completed_at = "completed", consultation, now
    pending.save(update_fields=("status", "consultation", "completed_at", "updated_at"))


# ---------------------------------------------------------------- vues de données

def lab_view_of(pending):
    """Tout ce qu'un laboratoire voit d'un QR d'examen : de quoi reconnaître la personne, et les examens à faire. Rien d'autre."""
    patient = pending.patient
    return {
        "pending_consultation_id": str(pending.id),
        "patient": {
            "first_name": patient.display_first_name(),
            "last_name": patient.display_last_name(),
            "birth_date": patient.birth_date.isoformat() if patient.birth_date else None,
        },
        "exams": [{"id": str(exam.id), "kind": exam.kind, "label": exam.label, "status": exam.status} for exam in pending.exams.all()],
        "expires_at": pending.qr_expires_at,
    }

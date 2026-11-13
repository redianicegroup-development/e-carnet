"""PRO-21 — routes HTTP : consultation en attente (patient, professionnel) et espace laboratoire.

Chaque vue commence par le drapeau `ECARNET_LAB_ENABLED` (éteint par défaut). Le laboratoire n'a AUCUNE route de lecture clinique :
il résout un QR d'examen (nom + date de naissance + examens demandés) et dépose des PDF, rien d'autre."""
from datetime import date

from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event
from apps.identity.throttles import WriteScopedThrottle
from apps.patients.views import patient_actor_role, profile_for
from apps.professionals.access import professional_clinical_access_error

from .lab_services import HISTORY_STATUSES, QR_INVALID_MESSAGE, deposit_lab_result, lab_history
from .models import AccessGrant, MedicalDocument, PendingConsultation
from .pending_services import (
    DISABLED_MESSAGE,
    abandon_exam,
    cancel_pending_consultation,
    create_pending_consultation,
    exam_qr_is_valid,
    exam_qr_token,
    lab_enabled,
    lab_view_of,
    renew_exam_qr,
    resolve_exam_qr,
    revoke_exam_qr,
)
from .serializers import PendingConsultationCreateSerializer
from .services import is_own_patient_file, require_scope


def _disabled():
    return Response({"success": False, "message": DISABLED_MESSAGE}, status=404)


def _message(exc):
    detail = exc.detail
    if isinstance(detail, list):
        detail = detail[0]
    if isinstance(detail, dict):
        detail = next(iter(detail.values()))
        if isinstance(detail, list):
            detail = detail[0]
    return str(detail)


def _initials(patient):
    first, last = (patient.display_first_name() or "").strip(), (patient.display_last_name() or "").strip()
    return " ".join(f"{part[0].upper()}." for part in (first, last) if part)


def _documents_of(exam, *, grant_id=None):
    rows = []
    for document in exam.result_documents.all().order_by("created_at"):
        url = f"/api/v1/patient/care/documents/{document.id}/download/" if grant_id is None else f"/api/v1/patient/care/professional/access-grants/{grant_id}/documents/{document.id}/download/"
        rows.append({
            "id": str(document.id), "original_name": document.original_name, "created_at": document.created_at, "issuer": document.issuer,
            "replaced": document.superseded_by_id is not None, "download_url": url,
        })
    return rows


def _exam_payload(exam, *, grant_id=None, with_documents=True):
    return {
        "id": str(exam.id), "kind": exam.kind, "label": exam.label, "status": exam.status, "status_label": exam.get_status_display(),
        "abandon_reason": exam.abandon_reason, "result_received_at": exam.result_received_at,
        "documents": _documents_of(exam, grant_id=grant_id) if with_documents else [],
    }


# ---------------------------------------------------------------- patient

class PatientPendingConsultationListView(APIView):
    """Les consultations du patient qui attendent des résultats (ou qui sont à reprendre)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not lab_enabled():
            return _disabled()
        patient = profile_for(request.user, request)
        items = PendingConsultation.objects.filter(patient=patient, status__in=PendingConsultation.OPEN_STATUSES).select_related("professional__user", "establishment").prefetch_related("exams__result_documents")
        data = []
        for pending in items:
            data.append({
                "id": str(pending.id), "status": pending.status, "status_label": pending.get_status_display(),
                "professional_name": f"{pending.professional.user.first_name} {pending.professional.user.last_name}".strip() or pending.professional.professional_title,
                "facility_label": pending.establishment.name, "reason": pending.draft.get("reason", ""),
                "created_at": pending.created_at, "qr_expires_at": pending.qr_expires_at, "qr_active": exam_qr_is_valid(pending),
                "exams": [_exam_payload(exam) for exam in pending.exams.all()],
            })
        return Response({"success": True, "data": data})


class PatientExamQrView(APIView):
    """QR d'examen : le patient l'affiche (GET), en demande un nouveau (POST, l'ancien cesse de fonctionner) ou le retire (DELETE)."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "qr_create"

    def _pending(self, request, pk):
        patient = profile_for(request.user, request)
        return PendingConsultation.objects.filter(pk=pk, patient=patient, status__in=PendingConsultation.OPEN_STATUSES).first()

    def get(self, request, pk):
        if not lab_enabled():
            return _disabled()
        pending = self._pending(request, pk)
        if not pending:
            return Response({"success": False, "message": "Consultation en attente introuvable."}, status=404)
        if not exam_qr_is_valid(pending):
            return Response({"success": False, "code": "qr_inactive", "message": "Ce QR est expiré ou a été retiré : générez-en un nouveau."}, status=404)
        return Response({"success": True, "data": {"token": exam_qr_token(pending), "expires_at": pending.qr_expires_at}})

    @transaction.atomic
    def post(self, request, pk):
        if not lab_enabled():
            return _disabled()
        pending = PendingConsultation.objects.select_for_update().filter(pk=pk, patient=profile_for(request.user, request), status__in=PendingConsultation.OPEN_STATUSES).first()
        if not pending:
            return Response({"success": False, "message": "Consultation en attente introuvable."}, status=404)
        try:
            renew_exam_qr(pending, actor=request.user, actor_role=patient_actor_role(request))
        except ValidationError as exc:
            return Response({"success": False, "message": _message(exc)}, status=400)
        return Response({"success": True, "data": {"token": exam_qr_token(pending), "expires_at": pending.qr_expires_at}}, status=201)

    @transaction.atomic
    def delete(self, request, pk):
        if not lab_enabled():
            return _disabled()
        pending = PendingConsultation.objects.select_for_update().filter(pk=pk, patient=profile_for(request.user, request), status__in=PendingConsultation.OPEN_STATUSES).first()
        if not pending:
            return Response({"success": False, "message": "Consultation en attente introuvable."}, status=404)
        revoke_exam_qr(pending, actor=request.user, actor_role=patient_actor_role(request))
        return Response({"success": True, "data": {"revoked": True}})


class PatientPendingCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not lab_enabled():
            return _disabled()
        try:
            pending = cancel_pending_consultation(patient=profile_for(request.user, request), pending_id=pk, actor=request.user, actor_role=patient_actor_role(request))
        except ValidationError as exc:
            return Response({"success": False, "message": _message(exc)}, status=400)
        return Response({"success": True, "data": {"id": str(pending.id), "status": pending.status}})


# ---------------------------------------------------------------- professionnel

class ProfessionalPendingConsultationView(APIView):
    """GET : mes attentes ouvertes (sans identité du patient, seulement ses initiales). POST : « Attendre les résultats »."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not lab_enabled():
            return _disabled()
        profile = getattr(request.user, "professional_profile", None)
        access_error = professional_clinical_access_error(profile)
        if access_error:
            return Response({"success": False, "message": access_error}, status=403)
        items = PendingConsultation.objects.filter(professional=profile, status__in=PendingConsultation.OPEN_STATUSES).select_related("patient").prefetch_related("exams")
        data = [{
            "id": str(pending.id), "status": pending.status, "status_label": pending.get_status_display(), "patient_initials": _initials(pending.patient),
            "reason": pending.draft.get("reason", ""), "created_at": pending.created_at,
            "exams_total": len(pending.exams.all()), "exams_waiting": sum(1 for exam in pending.exams.all() if exam.status == "requested"),
        } for pending in items]
        return Response({"success": True, "data": data})

    @transaction.atomic
    def post(self, request):
        if not lab_enabled():
            return _disabled()
        profile = getattr(request.user, "professional_profile", None)
        if not profile:
            return Response({"success": False, "message": "Le profil professionnel n’est pas disponible."}, status=403)
        serializer = PendingConsultationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            pending = create_pending_consultation(professional=profile, data=serializer.validated_data)
        except ValidationError as exc:
            return Response({"success": False, "message": _message(exc)}, status=400)
        except PermissionDenied as exc:
            return Response({"success": False, "message": str(exc.detail)}, status=403)
        return Response({"success": True, "data": {"id": str(pending.id), "status": pending.status}}, status=201)


class ProfessionalPendingForGrantView(APIView):
    """À la reprise : l'attente de CE patient (celui qui vient de présenter un nouveau QR), avec brouillon et résultats.

    Passe par `require_scope` comme toute lecture clinique. Les PDF ne sont listés que si le patient a accordé le périmètre
    `documents` ; sans lui, le médecin voit l'état des examens mais pas les fichiers."""
    permission_classes = [IsAuthenticated]

    def get(self, request, grant_id):
        if not lab_enabled():
            return _disabled()
        profile = getattr(request.user, "professional_profile", None)
        access_error = professional_clinical_access_error(profile)
        if access_error:
            return Response({"success": False, "message": access_error}, status=403)
        grant = AccessGrant.objects.filter(pk=grant_id, professional=profile, establishment=profile.active_establishment).select_related("patient", "establishment").first()
        if not grant:
            return Response({"success": False, "message": "AccessGrant introuvable dans votre périmètre."}, status=404)
        if is_own_patient_file(profile, grant.patient):
            return Response({"success": False, "code": "self_access", "message": "Vous ne pouvez pas reprendre une consultation sur votre propre dossier."}, status=403)
        try:
            require_scope(grant, "preconsultation")
        except PermissionDenied as exc:
            return Response({"success": False, "message": str(exc.detail)}, status=403)
        pending = PendingConsultation.objects.filter(patient=grant.patient, professional=profile, status__in=PendingConsultation.OPEN_STATUSES).prefetch_related("exams__result_documents").first()
        if not pending:
            return Response({"success": True, "data": None})
        documents_allowed = "documents" in (grant.scope or [])
        record_event(event_type="clinical_data.read", actor=request.user, actor_role="professional", patient=grant.patient, establishment=grant.establishment, access_grant=grant, metadata={"action": "read_pending_consultation", "resource_type": "pending_consultation", "resource_id": str(pending.id), "resource_count": len(pending.exams.all())})
        return Response({"success": True, "data": {
            "id": str(pending.id), "status": pending.status, "status_label": pending.get_status_display(), "source_encounter_id": str(pending.source_encounter_id),
            "draft": pending.draft, "documents_allowed": documents_allowed, "created_at": pending.created_at,
            "exams": [_exam_payload(exam, grant_id=grant.id, with_documents=documents_allowed) for exam in pending.exams.all()],
        }})


class ProfessionalPendingExamAbandonView(APIView):
    """Sortie de secours : abandonner un examen dont le résultat n'arrivera pas (motif écrit, audité)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, exam_id):
        if not lab_enabled():
            return _disabled()
        profile = getattr(request.user, "professional_profile", None)
        access_error = professional_clinical_access_error(profile)
        if access_error:
            return Response({"success": False, "message": access_error}, status=403)
        try:
            pending = abandon_exam(professional=profile, pending_id=pk, exam_id=exam_id, reason=request.data.get("reason"))
        except ValidationError as exc:
            return Response({"success": False, "message": _message(exc)}, status=400)
        return Response({"success": True, "data": {"id": str(pending.id), "status": pending.status}})


# ---------------------------------------------------------------- laboratoire

def lab_establishment_for(user):
    """Le laboratoire dont cet utilisateur est l'administrateur actif, ou None. Un administrateur d'établissement ordinaire n'est PAS un laboratoire."""
    from apps.establishments.models import EstablishmentAdministrator

    # Requête directe sur les laboratoires : un compte qui administre aussi un établissement de soin ne doit pas perdre son laboratoire.
    admin = EstablishmentAdministrator.objects.filter(user=user, status="active", establishment__status="active", establishment__is_laboratory=True).select_related("establishment").first()
    return admin.establishment if admin else None


def _lab_or_403(request):
    lab = lab_establishment_for(request.user)
    if not lab:
        return None, Response({"success": False, "message": "Cet espace est réservé à l’administrateur d’un laboratoire actif."}, status=403)
    return lab, None


class LabExamQrResolveView(APIView):
    """Le laboratoire scanne le QR d'examen : il reçoit le nom, la date de naissance et les examens demandés. Aucun autre accès."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "lab_qr"

    def post(self, request):
        if not lab_enabled():
            return _disabled()
        lab, error = _lab_or_403(request)
        if error:
            return error
        pending = resolve_exam_qr(request.data.get("token"))
        if not pending:
            return Response({"success": False, "message": QR_INVALID_MESSAGE}, status=404)
        record_event(event_type="lab_exam_qr.resolved", actor=request.user, actor_role="laboratory", patient=pending.patient, establishment=lab, metadata={"action": "resolved", "resource_type": "pending_consultation", "resource_id": str(pending.id)})
        return Response({"success": True, "data": lab_view_of(pending)})


class LabResultDepositView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "lab_deposit"

    def post(self, request):
        if not lab_enabled():
            return _disabled()
        lab, error = _lab_or_403(request)
        if error:
            return error
        try:
            document = deposit_lab_result(
                user=request.user, lab=lab, token=request.data.get("token"), exam_id=request.data.get("exam_id"),
                uploaded=request.FILES.get("file"), identity_confirmed=str(request.data.get("identity_confirmed", "")).lower() == "true",
                document_date=request.data.get("document_date") or None,
            )
        except ValidationError as exc:
            return Response({"success": False, "message": _message(exc)}, status=400)
        return Response({"success": True, "data": {"id": str(document.id), "original_name": document.original_name, "created_at": document.created_at}}, status=201)


class LabDepositHistoryView(APIView):
    """Historique de CE laboratoire : examen, type, statut (déposé, remplacé, abandonné), initiales + année de naissance, date. Jamais le
    nom complet ni le contenu du fichier. Filtres facultatifs : `status`, `from` et `to` (AAAA-MM-JJ, inclusifs)."""
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _day(request, name):
        raw = request.query_params.get(name)
        if not raw:
            return None
        try:
            return date.fromisoformat(raw)
        except ValueError:
            raise ValidationError(f"Date invalide pour « {name} » : utilisez AAAA-MM-JJ.")

    def get(self, request):
        if not lab_enabled():
            return _disabled()
        lab, error = _lab_or_403(request)
        if error:
            return error
        try:
            status = request.query_params.get("status") or None
            if status and status not in HISTORY_STATUSES:
                raise ValidationError("Statut inconnu : deposited, replaced ou abandoned.")
            date_from, date_to = self._day(request, "from"), self._day(request, "to")
            if date_from and date_to and date_from > date_to:
                raise ValidationError("La date de début doit précéder la date de fin.")
        except ValidationError as exc:
            return Response({"success": False, "message": _message(exc)}, status=400)
        return Response({"success": True, "data": lab_history(lab=lab, status=status, date_from=date_from, date_to=date_to)})

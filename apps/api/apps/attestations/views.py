import uuid

from django.db.models import Prefetch, Q
from django.http import HttpResponse
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event
from apps.care.models import AccessGrant, Consultation
from apps.establishments.models import Establishment
from apps.identity.throttles import WriteScopedThrottle
from apps.patients.models import ClinicalDeclaration
from apps.patients.views import patient_actor_role, profile_for
from apps.professionals.access import professional_clinical_access_error
from apps.professionals.models import ProfessionalProfile

from . import services
from .models import DeclarationAttachment, DeclarationShare
from .services import NEW_KINDS, STATUS_LABELS, WAITING_MESSAGE, AttestationError

def no_data():
    return DeclarationAttachment.objects.defer("data")


def ok(data, status=200):
    return Response({"success": True, "data": data}, status=status)


def fail(message, status=400):
    return Response({"success": False, "message": message}, status=status)


def attachment_row(item):
    return {"id": str(item.id), "name": item.original_name, "content_type": item.content_type, "size_bytes": item.size_bytes}


def patient_name(patient):
    return f"{patient.first_name} {patient.last_name}".strip() or "Patient"


def kind_label(kind):
    return dict(ClinicalDeclaration.KIND_CHOICES).get(kind, kind)


def share_row(share):
    attestation = getattr(share, "attestation", None)
    return {"id": str(share.id), "establishment_id": str(share.establishment_id), "establishment_name": share.establishment.name, "status": share.status, "status_label": STATUS_LABELS[share.status],
            "info_message": share.info_message, "error_message": share.error_message, "error_reported_at": share.error_reported_at, "created_at": share.created_at,
            "attestation": {"professional_name": attestation.professional_name, "professional_title": attestation.professional_title, "attested_at": attestation.attested_at} if attestation else None}


def declaration_row(declaration):
    return {"id": str(declaration.id), "kind": declaration.kind, "kind_label": kind_label(declaration.kind), "label": declaration.label, "details": declaration.details, "event_date": declaration.event_date,
            "created_at": declaration.created_at, "attachments": [attachment_row(item) for item in declaration.attachments.all()],
            "shares": [share_row(share) for share in declaration.shares.all() if share.status != "revoked"],
            "events": [{"kind": event.kind, "actor": event.actor_label, "detail": event.detail, "created_at": event.created_at} for event in list(declaration.attestation_events.all())[:8]]}


def list_args():
    return ("shares__establishment", "shares__attestation", "attestation_events", Prefetch("attachments", queryset=no_data()))


def serve(attachment):
    response = HttpResponse(bytes(attachment.data), content_type=attachment.content_type)
    safe = attachment.original_name.replace('"', "").replace("\r", "").replace("\n", "")
    response["Content-Disposition"] = f'attachment; filename="{safe}"'
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, no-store"
    return response


class PatientDeclarationsView(APIView):
    """Le patient déclare, joint ses justificatifs et choisit l'établissement qui les recevra. Tout est facultatif sauf catégorie et titre."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "documents_upload"

    def get(self, request):
        patient = profile_for(request.user, request)
        items = ClinicalDeclaration.objects.filter(patient=patient, kind__in=NEW_KINDS, status="declared").prefetch_related(*list_args()).order_by("-created_at")[:100]
        return ok([declaration_row(item) for item in items])

    def post(self, request):
        patient = profile_for(request.user, request)
        try:
            declaration = services.create_declaration(patient, request.data, request.FILES.getlist("files"), request.data.getlist("establishment_ids") if hasattr(request.data, "getlist") else request.data.get("establishment_ids", []), request.user)
        except AttestationError as error:
            return fail(str(error), error.status)
        declaration = ClinicalDeclaration.objects.prefetch_related(*list_args()).get(pk=declaration.pk)
        return ok(declaration_row(declaration), 201)


class PatientShareDeclarationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, declaration_id):
        patient = profile_for(request.user, request)
        declaration = ClinicalDeclaration.objects.filter(pk=declaration_id, patient=patient).first()
        if declaration is None:
            return fail("Déclaration introuvable.", 404)
        try:
            services.share_existing(declaration, request.data.get("establishment_ids", []), request.user)
        except AttestationError as error:
            return fail(str(error), error.status)
        return ok(declaration_row(ClinicalDeclaration.objects.prefetch_related(*list_args()).get(pk=declaration.pk)))


class PatientShareActionView(APIView):
    permission_classes = [IsAuthenticated]
    action = ""

    def post(self, request, share_id):
        patient = profile_for(request.user, request)
        share = DeclarationShare.objects.select_related("declaration", "establishment").filter(pk=share_id, declaration__patient=patient).first()
        if share is None:
            return fail("Partage introuvable.", 404)
        try:
            if self.action == "revoke":
                services.revoke_share(share, request.user)
            else:
                services.report_error(share, request.data.get("message", ""), request.user)
        except AttestationError as error:
            return fail(str(error), error.status)
        return ok(declaration_row(ClinicalDeclaration.objects.prefetch_related(*list_args()).get(pk=share.declaration_id)))


class PatientRevokeShareView(PatientShareActionView):
    action = "revoke"


class PatientReportErrorView(PatientShareActionView):
    action = "report"


class PatientEstablishmentsView(APIView):
    """Établissements proposés : ceux qui ont déjà reçu le patient en premier, puis les autres établissements actifs. Jamais un laboratoire."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        patient = profile_for(request.user, request)
        query = str(request.query_params.get("q", "")).strip()
        recent = set(AccessGrant.objects.filter(patient=patient, starts_at__isnull=False).values_list("establishment_id", flat=True)) | set(Consultation.objects.filter(patient=patient, establishment__isnull=False).values_list("establishment_id", flat=True))
        items = Establishment.objects.filter(status="active", is_laboratory=False)
        if query:
            items = items.filter(Q(name__icontains=query) | Q(city__icontains=query))
        rows = [{"id": str(item.id), "name": item.name, "city": item.city, "recent": item.id in recent} for item in items.order_by("name")[:200]]
        rows.sort(key=lambda row: (not row["recent"], row["name"].lower()))
        return ok(rows[:50])


class PatientAttachmentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, attachment_id):
        patient = profile_for(request.user, request)
        attachment = DeclarationAttachment.objects.filter(pk=attachment_id, declaration__patient=patient).first()
        return serve(attachment) if attachment else fail("Justificatif introuvable.", 404)


# ---- Professionnels : seuls eux attestent, dans leur établissement actif ----

def professional_context(request):
    profile = ProfessionalProfile.objects.select_related("active_establishment", "user").filter(user=request.user).first()
    error = professional_clinical_access_error(profile)
    return (None, error) if error else (profile, None)


def visible_shares(profile, statuses):
    return DeclarationShare.objects.filter(establishment_id=profile.active_establishment_id, status__in=statuses, declaration__status="declared").select_related("declaration__patient", "establishment")


def seen_patient_ids(profile, patient_ids):
    establishment = profile.active_establishment_id
    return set(AccessGrant.objects.filter(establishment_id=establishment, patient_id__in=patient_ids, starts_at__isnull=False).values_list("patient_id", flat=True)) | set(Consultation.objects.filter(establishment_id=establishment, patient_id__in=patient_ids).values_list("patient_id", flat=True))


def professional_row(share, seen, profile):
    declaration = share.declaration
    policy = services.attest_policy_error(profile, declaration)
    return {"id": str(share.id), "patient_name": patient_name(declaration.patient), "kind": declaration.kind, "kind_label": kind_label(declaration.kind), "label": declaration.label, "details": declaration.details,
            "event_date": declaration.event_date, "shared_at": share.created_at, "status": share.status, "info_message": share.info_message, "patient_seen": seen,
            "can_attest": seen and policy is None, "blocked_reason": policy or ("" if seen else WAITING_MESSAGE),
            "attachments": [attachment_row(item) for item in declaration.attachments.all()]}


class ProfessionalDeclarationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, error = professional_context(request)
        if error:
            return fail(error, 403)
        shares = list(visible_shares(profile, ("pending", "info_requested")).prefetch_related(Prefetch("declaration__attachments", queryset=no_data())).order_by("created_at")[:100])
        seen = seen_patient_ids(profile, {share.declaration.patient_id for share in shares})
        rows = [professional_row(share, share.declaration.patient_id in seen, profile) for share in shares]
        reported = visible_shares(profile, ("attested",)).filter(error_reported_at__isnull=False).select_related("attestation").order_by("-error_reported_at")[:20]
        return ok({"to_attest": [row for row in rows if row["patient_seen"]], "waiting": [row for row in rows if not row["patient_seen"]],
                   "reported": [{"id": str(share.id), "patient_name": patient_name(share.declaration.patient), "label": share.declaration.label, "error_message": share.error_message, "error_reported_at": share.error_reported_at, "attested_by": share.attestation.professional_name} for share in reported]})


class ProfessionalSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, error = professional_context(request)
        if error:
            return ok({"allowed": False, "to_attest": 0, "waiting": 0})
        shares = list(visible_shares(profile, ("pending", "info_requested")))
        seen = seen_patient_ids(profile, {share.declaration.patient_id for share in shares})
        ready = sum(1 for share in shares if share.declaration.patient_id in seen)
        return ok({"allowed": True, "to_attest": ready, "waiting": len(shares) - ready})


class ProfessionalReminderView(APIView):
    """Rappel pendant une consultation : déclarations du patient en cours d'accès, à faire attester dans l'établissement actif."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, error = professional_context(request)
        if error:
            return ok({"count": 0, "items": []})
        try:
            grant_id = uuid.UUID(str(request.query_params.get("grant", "")))
        except ValueError:
            return ok({"count": 0, "items": []})
        grant = AccessGrant.objects.filter(pk=grant_id, professional=profile, status="active").first()
        if grant is None:
            return ok({"count": 0, "items": []})
        shares = visible_shares(profile, ("pending", "info_requested")).filter(declaration__patient=grant.patient)
        rows = [{"id": str(share.id), "label": share.declaration.label, "kind_label": kind_label(share.declaration.kind)} for share in shares]
        return ok({"count": len(rows), "items": rows})


class ProfessionalAttestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, share_id):
        profile, error = professional_context(request)
        if error:
            return fail(error, 403)
        try:
            attestation = services.attest(share_id, profile)
        except AttestationError as failure:
            return fail(str(failure), failure.status)
        return ok({"share_id": str(attestation.share_id), "professional_name": attestation.professional_name, "attested_at": attestation.attested_at}, 201)


class ProfessionalRequestInfoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, share_id):
        profile, error = professional_context(request)
        if error:
            return fail(error, 403)
        try:
            share = services.request_info(share_id, profile, request.data.get("message", ""))
        except AttestationError as failure:
            return fail(str(failure), failure.status)
        return ok({"share_id": str(share.id), "status": share.status})


class ProfessionalAttachmentView(APIView):
    """Un justificatif n'est lisible que par un professionnel de l'établissement destinataire, tant que le patient n'a pas retiré le partage. Chaque lecture est tracée."""
    permission_classes = [IsAuthenticated]

    def get(self, request, attachment_id):
        profile, error = professional_context(request)
        if error:
            return fail(error, 403)
        attachment = DeclarationAttachment.objects.select_related("declaration__patient").filter(pk=attachment_id, declaration__status="declared", declaration__shares__establishment_id=profile.active_establishment_id, declaration__shares__status__in=("pending", "info_requested", "attested")).first()
        if attachment is None:
            return fail("Justificatif introuvable.", 404)
        record_event(event_type="declaration.attachment_read", actor=request.user, actor_role="professional", patient=attachment.declaration.patient, establishment=profile.active_establishment, metadata={"declaration_id": str(attachment.declaration_id), "resource_type": "declaration_attachment", "resource_id": str(attachment.id)})
        return serve(attachment)

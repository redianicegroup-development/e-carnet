from django.db import transaction
from django.db.models import Q
from uuid import UUID
from django.utils import timezone
from apps.identity.throttles import WriteScopedThrottle
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.patients.views import patient_actor_role, profile_for
from apps.establishments.models import Establishment
from apps.professionals.access import professional_clinical_access_error
from apps.professionals.models import ProfessionalProfile
from apps.audit.models import AuditEvent
from apps.audit.services import record_event
from .models import AccessGrant, CareEncounter, Consultation, PreConsultationRevision
from .serializers import AccessGrantSerializer, CareEncounterSerializer, ConsultationSerializer, ProfessionalAccessGrantSerializer, ProfessionalConsultationCreateSerializer
from .services import QR_TOKEN_TTL_SECONDS, create_patient_qr_token, create_professional_grant
from .consultation_services import validate_consultation


class EncounterListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        items = CareEncounter.objects.filter(patient=profile_for(request.user, request))
        return Response({"success": True, "data": CareEncounterSerializer(items, many=True).data})
    @transaction.atomic
    def post(self, request):
        serializer = CareEncounterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        establishment_id = request.data.get("establishment_id")
        try:
            establishment_id = UUID(str(establishment_id))
            establishment = Establishment.objects.filter(id=establishment_id, status="active").first()
        except (ValueError, TypeError, AttributeError):
            establishment = None
        if not establishment:
            return Response({"success": False, "message": "Choisissez un établissement actif pour associer cette pré-consultation."}, status=400)
        item = CareEncounter.objects.create(patient=profile_for(request.user, request), establishment=establishment, facility_label=establishment.name, **serializer.validated_data)
        record_event(event_type="preconsultation.created", actor=request.user, actor_role=patient_actor_role(request), patient=item.patient, metadata={"action": "created", "encounter_id": str(item.id), "status": item.status})
        return Response({"success": True, "data": CareEncounterSerializer(item).data}, status=status.HTTP_201_CREATED)


class EncounterDetailView(APIView):
    permission_classes = [IsAuthenticated]
    def get_object(self, request, pk):
        return CareEncounter.objects.filter(pk=pk, patient=profile_for(request.user, request)).first()
    def get(self, request, pk):
        item = self.get_object(request, pk)
        if not item:
            return Response({"success": False, "message": "Prise en charge introuvable."}, status=404)
        return Response({"success": True, "data": CareEncounterSerializer(item).data})
    @transaction.atomic
    def patch(self, request, pk):
        item = self.get_object(request, pk)
        if not item:
            return Response({"success": False, "message": "Prise en charge introuvable."}, status=404)
        if item.status == "closed":
            return Response({"success": False, "message": "Cette pré-consultation est clôturée et conservée."}, status=409)
        serializer = CareEncounterSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_event(event_type="preconsultation.updated", actor=request.user, actor_role=patient_actor_role(request), patient=item.patient, metadata={"action": "updated", "encounter_id": str(item.id), "status": item.status})
        return Response({"success": True, "data": serializer.data})
    @transaction.atomic
    def post(self, request, pk):
        item = self.get_object(request, pk)
        if not item:
            return Response({"success": False, "message": "Prise en charge introuvable."}, status=404)
        if item.status != "closed":
            item.status = "closed"
            item.closed_at = timezone.now()
            item.save(update_fields=("status", "closed_at", "updated_at"))
            PreConsultationRevision.objects.create(encounter=item, snapshot={"reason": item.reason, "observations": item.observations, "facility_label": item.facility_label, "recorded_with_help": item.recorded_with_help})
            record_event(event_type="preconsultation.closed", actor=request.user, actor_role=patient_actor_role(request), patient=item.patient, metadata={"action": "closed", "encounter_id": str(item.id), "status": item.status})
        return Response({"success": True, "data": CareEncounterSerializer(item).data})


class PatientAccessGrantListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        items = AccessGrant.objects.filter(patient=profile_for(request.user, request))
        for item in items:
            item.refresh_expiration()
        return Response({"success": True, "data": AccessGrantSerializer(items, many=True).data})


class PatientAccessQrCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "qr_create"

    def post(self, request):
        raw = create_patient_qr_token(patient=profile_for(request.user, request))
        return Response({"success": True, "data": {"token": raw, "expires_in_seconds": QR_TOKEN_TTL_SECONDS, "scope": ["preconsultation", "declarations"]}})


class PatientAccessAuditView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        events = (
            AuditEvent.objects.filter(patient=profile_for(request.user, request)).filter(Q(event_type__startswith="access_grant.") | Q(event_type="clinical_data.read"))
            .select_related("access_grant")
            .order_by("-created_at")[:100]
        )
        data = []
        for event in events:
            grant = event.access_grant
            metadata = event.metadata or {}
            data.append({
                "id": str(event.id),
                "event_type": event.event_type,
                "action": metadata.get("action", event.event_type.rsplit(".", 1)[-1]),
                "status": metadata.get("status"),
                "resource_type": metadata.get("resource_type"),
                "resource_count": metadata.get("resource_count"),
                "extension_count": metadata.get("extension_count"),
                "authorized_until": metadata.get("authorized_until"),
                "access_duration_minutes": metadata.get("access_duration_minutes"),
                "professional_name": grant.professional_name if grant else "Professionnel",
                "facility_label": grant.facility_label if grant else "Établissement",
                "created_at": event.created_at,
            })
        return Response({"success": True, "data": data})


class PatientAccessGrantActionView(APIView):
    permission_classes = [IsAuthenticated]
    @transaction.atomic
    def post(self, request, pk, action):
        # Serialize the whole state transition. A stale extend must never rewrite a concurrent revoke.
        item = AccessGrant.objects.select_for_update(of=("self",)).select_related("patient", "establishment").filter(pk=pk, patient=profile_for(request.user, request)).first()
        if not item:
            return Response({"success": False, "message": "Demande d’accès introuvable."}, status=404)
        now = timezone.now()
        if item.status in ("pending", "active") and item.expires_at and item.expires_at <= now:
            item.status = "expired"
            item.save(update_fields=("status",))
            AuditEvent.objects.create(event_type="access_grant.expired", actor=None, actor_role="system", patient=item.patient, establishment=item.establishment, access_grant=item, metadata={"action": "expired", "status": "expired"})
            return Response({"success": False, "message": "Cette autorisation a expiré."}, status=409)
        update_fields = []
        if action == "accept" and item.status == "pending":
            item.status, item.starts_at, item.expires_at = "active", now, now + timezone.timedelta(hours=2)
            update_fields = ["status", "starts_at", "expires_at"]
        elif action == "refuse" and item.status == "pending":
            item.status, item.refused_at = "refused", now
            update_fields = ["status", "refused_at"]
        elif action == "revoke" and item.status == "active":
            item.status, item.revoked_at = "revoked", now
            update_fields = ["status", "revoked_at"]
        elif action == "extend" and item.status == "active":
            if item.extension_count >= 2 or not item.expires_at:
                return Response({"success": False, "message": "La durée maximale de quatre heures est atteinte."}, status=409)
            item.extension_count += 1
            item.expires_at = item.expires_at + timezone.timedelta(hours=1)
            update_fields = ["extension_count", "expires_at"]
        else:
            return Response({"success": False, "message": "Cette action n’est pas disponible pour cet état."}, status=409)
        item.save(update_fields=update_fields)
        record_event(event_type=f"access_grant.{action}", actor=request.user, actor_role=patient_actor_role(request), patient=item.patient, establishment=item.establishment, access_grant=item, metadata={"action": action, "status": item.status, "extension_count": item.extension_count})
        return Response({"success": True, "data": AccessGrantSerializer(item).data})


class PatientConsultationListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        items = Consultation.objects.filter(patient=profile_for(request.user, request))
        return Response({"success": True, "data": ConsultationSerializer(items, many=True).data})


class ProfessionalAccessGrantListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "grant_request"

    def get(self, request):
        profile = getattr(request.user, "professional_profile", None)
        access_error = professional_clinical_access_error(profile)
        if access_error:
            return Response({"success": False, "message": access_error}, status=403)
        items = AccessGrant.objects.filter(professional=profile, establishment=profile.active_establishment).select_related("patient", "establishment")
        for item in items:
            item.refresh_expiration()
        return Response({"success": True, "data": ProfessionalAccessGrantSerializer(items, many=True).data})

    @transaction.atomic
    def post(self, request):
        profile = getattr(request.user, "professional_profile", None)
        if not profile:
            return Response({"success": False, "message": "Le profil professionnel n’est pas disponible."}, status=403)
        try:
            item = create_professional_grant(professional=profile, qr_token=request.data.get("qr_token"), scope=request.data.get("scope"))
        except ValidationError as exc:
            detail = exc.detail
            message = detail[0] if isinstance(detail, list) else detail
            return Response({"success": False, "message": str(message)}, status=400)
        record_event(event_type="access_grant.requested", actor=request.user, actor_role="professional", patient=item.patient, establishment=item.establishment, access_grant=item, metadata={"action": "requested", "scope": item.scope, "status": item.status})
        return Response({"success": True, "data": ProfessionalAccessGrantSerializer(item).data}, status=status.HTTP_201_CREATED)


class ProfessionalConsultationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "professional_profile", None)
        access_error = professional_clinical_access_error(profile)
        if access_error:
            return Response({"success": False, "message": access_error}, status=403)
        items = list(Consultation.objects.filter(professional=profile, establishment=profile.active_establishment).select_related("establishment", "source_encounter", "patient", "access_grant"))
        for item in items:
            grant = item.access_grant
            duration = int(round((grant.expires_at - grant.starts_at).total_seconds() / 60)) if grant and grant.starts_at and grant.expires_at else None
            record_event(event_type="clinical_data.read", actor=request.user, actor_role="professional", patient=item.patient, establishment=item.establishment, access_grant=grant, consultation=item, metadata={"action": "read_consultation", "resource_type": "consultation", "resource_id": str(item.id), "resource_count": 1, "authorized_until": grant.expires_at.isoformat() if grant and grant.expires_at else None, "access_duration_minutes": duration})
        return Response({"success": True, "data": ConsultationSerializer(items, many=True).data})

    @transaction.atomic
    def post(self, request):
        profile = getattr(request.user, "professional_profile", None)
        if not profile:
            return Response({"success": False, "message": "Le profil professionnel n’est pas disponible."}, status=403)
        serializer = ProfessionalConsultationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            consultation = validate_consultation(professional=profile, data=serializer.validated_data)
        except ValidationError as exc:
            detail = exc.detail
            message = detail[0] if isinstance(detail, list) else detail
            return Response({"success": False, "message": str(message)}, status=400)
        record_event(event_type="consultation.validated", actor=request.user, actor_role="professional", patient=consultation.patient, establishment=consultation.establishment, access_grant=consultation.access_grant, consultation=consultation, metadata={"action": "validated", "source_type": "preconsultation"})
        return Response({"success": True, "data": ConsultationSerializer(consultation).data}, status=status.HTTP_201_CREATED)


class ProfessionalAuthorizedEncounterListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        profile = getattr(request.user, "professional_profile", None)
        access_error = professional_clinical_access_error(profile)
        if access_error:
            return Response({"success": False, "message": access_error}, status=403)
        grant = AccessGrant.objects.filter(id=pk, professional=profile, establishment=profile.active_establishment).select_related("establishment").first()
        if not grant:
            return Response({"success": False, "message": "AccessGrant introuvable dans votre périmètre."}, status=404)
        grant.refresh_expiration()
        if grant.status != "active" or grant.establishment_id != getattr(profile.active_establishment, "id", None) or "preconsultation" not in grant.scope:
            return Response({"success": False, "message": "Cette pré-consultation n’est pas accessible avec l’autorisation courante."}, status=403)
        items = list(CareEncounter.objects.filter(patient=grant.patient, establishment_id=grant.establishment_id, status="closed").order_by("-closed_at"))
        duration = int(round((grant.expires_at - grant.starts_at).total_seconds() / 60)) if grant.starts_at and grant.expires_at else None
        record_event(event_type="clinical_data.read", actor=request.user, actor_role="professional", patient=grant.patient, establishment=grant.establishment, access_grant=grant, metadata={"action": "read_preconsultations", "resource_type": "preconsultation", "resource_count": len(items), "authorized_until": grant.expires_at.isoformat() if grant.expires_at else None, "access_duration_minutes": duration})
        return Response({"success": True, "data": CareEncounterSerializer(items, many=True).data})

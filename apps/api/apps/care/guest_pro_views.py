"""Mode invité, médecin sans téléphone : écrans de l'espace patient (le médecin écrit sur le téléphone du patient) et de l'espace professionnel
(il relit, confirme ou rejette plus tard, sur son propre téléphone). La confirmation elle-même passe par la signature ordinaire."""
from django.db import transaction
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event
from apps.identity.throttles import WriteScopedThrottle
from apps.patients.views import patient_actor_role, profile_for
from apps.professionals.access import professional_clinical_access_error

from .guest_access import (
    CONFIRMATION_TTL,
    GUEST_METHOD,
    GUEST_SCOPES,
    GuestLookupLocked,
    find_guest_professional,
    start_guest_professional_grant,
)
from .guest_consultation_services import AWAITING, expire_overdue, reject_guest_consultation, save_guest_consultation
from .guest_views import GuestLookupSerializer, GuestStartSerializer
from .models import AccessGrant, GuestConsultation
from .serializers import CareEncounterSerializer, MAX_ORDER_LINES, PrescriptionLineInputSerializer, VitalsField, account_avatar_url
from .services import AUTO_GRANT_DURATION, SelfAccessRefused


def _message(exc):
    detail = exc.detail
    return str(detail[0] if isinstance(detail, list) else detail)


class GuestConsultationInputSerializer(serializers.Serializer):
    """Ce que le médecin écrit sur le téléphone du patient. Les examens demandés ne sont pas saisis ici : il les ajoute à la confirmation."""
    reason = serializers.CharField(max_length=240)
    symptoms = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    clinical_exam = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    diagnosis = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    observations = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    vitals = VitalsField(required=False)
    prescription_lines = PrescriptionLineInputSerializer(many=True, required=False, max_length=MAX_ORDER_LINES)
    conclusion = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    care_plan = serializers.CharField(max_length=4000, required=False, allow_blank=True)


def _professional_card(professional):
    user = professional.user
    return {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "photo_url": account_avatar_url(user) or None,
        "title": professional.professional_title,
        "establishment_name": professional.active_establishment.name if professional.active_establishment else "",
    }


def _patient_name(patient):
    return f"{patient.display_first_name()} {patient.display_last_name()}".strip()


def _for_patient(item):
    return {
        "id": str(item.id), "status": item.status, "professional_name": item.access_grant.professional_name, "facility_label": item.access_grant.facility_label,
        "reason": (item.draft or {}).get("reason", ""), "written_at": item.created_at.isoformat(), "expires_at": item.expires_at.isoformat(),
    }


def _for_professional(item):
    patient = item.patient
    return {
        "id": str(item.id), "status": item.status, "access_grant_id": str(item.access_grant_id), "source_encounter_id": str(item.source_encounter_id),
        "patient_name": _patient_name(patient), "patient_avatar": (account_avatar_url(patient.user) if patient.user_id else "") or "",
        "facility_label": item.access_grant.facility_label, "draft": item.draft, "encounter": CareEncounterSerializer(item.source_encounter).data,
        "written_at": item.created_at.isoformat(), "expires_at": item.expires_at.isoformat(),
    }


class PatientGuestProfessionalLookupView(APIView):
    """Étape 1 (téléphone du patient) : nom + date de naissance + téléphone DU MÉDECIN → son profil, à comparer avec la personne présente."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "guest_lookup"

    def post(self, request):
        patient = profile_for(request.user, request)
        serializer = GuestLookupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = patient_actor_role(request)
        try:
            professional, token = find_guest_professional(patient=patient, **serializer.validated_data)
        except GuestLookupLocked as exc:
            record_event(event_type="access_grant.guest_lookup_locked", actor=request.user, actor_role=role, metadata={"action": "guest_lookup", "status": "refused", "method": GUEST_METHOD})
            return Response({"success": False, "code": "guest_lookup_locked", "message": str(exc)}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except SelfAccessRefused as exc:
            return Response({"success": False, "code": "self_access", "message": _message(exc)}, status=403)
        except ValidationError as exc:
            record_event(event_type="access_grant.guest_lookup_failed", actor=request.user, actor_role=role, metadata={"action": "guest_lookup", "status": "refused", "method": GUEST_METHOD})
            return Response({"success": False, "message": _message(exc)}, status=400)
        return Response({"success": True, "data": {
            "confirmation_token": token, "expires_in_seconds": int(CONFIRMATION_TTL.total_seconds()),
            "professional": _professional_card(professional), "scope": list(GUEST_SCOPES),
        }})


class PatientGuestProfessionalStartView(APIView):
    """Étape 2 : le patient a comparé le profil avec le médecin devant lui et confirme → session limitée (2 h) pour écrire la consultation."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "guest_start"

    @transaction.atomic
    def post(self, request):
        patient = profile_for(request.user, request)
        serializer = GuestStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = patient_actor_role(request)
        try:
            grant = start_guest_professional_grant(patient=patient, confirmation_token=serializer.validated_data["confirmation_token"])
        except SelfAccessRefused as exc:
            return Response({"success": False, "code": "self_access", "message": _message(exc)}, status=403)
        except ValidationError as exc:
            return Response({"success": False, "message": _message(exc)}, status=400)
        record_event(event_type="access_grant.requested", actor=request.user, actor_role=role, patient=patient, establishment=grant.establishment, access_grant=grant, metadata={"action": "requested", "scope": grant.scope, "status": "active", "method": GUEST_METHOD})
        record_event(event_type="access_grant.accept", actor=request.user, actor_role=role, patient=patient, establishment=grant.establishment, access_grant=grant, metadata={"action": "accept", "status": "active", "method": GUEST_METHOD, "authorized_until": grant.expires_at.isoformat(), "access_duration_minutes": int(AUTO_GRANT_DURATION.total_seconds() // 60)})
        return Response({"success": True, "data": {
            "grant_id": str(grant.id), "expires_at": grant.expires_at.isoformat(),
            "professional_name": grant.professional_name, "facility_label": grant.facility_label,
        }}, status=status.HTTP_201_CREATED)


class PatientGuestConsultationSaveView(APIView):
    """Étape 3 : le médecin a écrit la consultation sur le téléphone du patient. Elle est enregistrée SANS signature, en attente de sa confirmation."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "guest_start"

    @transaction.atomic
    def post(self, request, grant_id):
        patient = profile_for(request.user, request)
        serializer = GuestConsultationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            item = save_guest_consultation(patient=patient, actor=request.user, actor_role=patient_actor_role(request), grant_id=grant_id, data=serializer.validated_data)
        except ValidationError as exc:
            return Response({"success": False, "message": _message(exc)}, status=400)
        return Response({"success": True, "data": _for_patient(item)}, status=status.HTTP_201_CREATED)


class PatientGuestConsultationListView(APIView):
    """Ce que le patient voit : les consultations saisies sur son téléphone qui ne sont PAS (ou pas encore) signées."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        patient = profile_for(request.user, request)
        expire_overdue(patient=patient)
        items = GuestConsultation.objects.filter(patient=patient).exclude(status="confirmed").select_related("access_grant").order_by("-created_at")[:20]
        return Response({"success": True, "data": [_for_patient(item) for item in items]})


class ProfessionalGuestConsultationListView(APIView):
    """Les consultations écrites en son nom sur le téléphone d'un patient, à relire puis confirmer (signature) ou rejeter."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "professional_profile", None)
        access_error = professional_clinical_access_error(profile)
        if access_error:
            return Response({"success": False, "message": access_error}, status=403)
        expire_overdue(professional=profile)
        items = GuestConsultation.objects.filter(professional=profile, status=AWAITING, establishment=profile.active_establishment).select_related("patient__user__account_profile", "access_grant", "source_encounter").order_by("created_at")
        return Response({"success": True, "data": [_for_professional(item) for item in items]})


class ProfessionalGuestConsultationRejectView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        profile = getattr(request.user, "professional_profile", None)
        if not profile:
            return Response({"success": False, "message": "Le profil professionnel n’est pas disponible."}, status=403)
        try:
            item = reject_guest_consultation(professional=profile, pk=pk, actor=request.user)
        except ValidationError as exc:
            return Response({"success": False, "message": _message(exc)}, status=400)
        return Response({"success": True, "data": {"id": str(item.id), "status": item.status}})

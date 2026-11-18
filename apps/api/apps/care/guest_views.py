from django.db import transaction
from django.db.models import Q
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event
from apps.identity.throttles import WriteScopedThrottle
from apps.patients.models import PatientProfile
from apps.professionals.access import professional_clinical_access_error

from .guest_access import (
    CONFIRMATION_TTL,
    GUEST_METHOD,
    GUEST_SCOPES,
    GuestLookupLocked,
    find_guest_patient,
    start_guest_grant,
)
from .models import AccessGrant, CareEncounter
from .notifications import notify_patient
from .serializers import CareEncounterSerializer, ProfessionalAccessGrantSerializer, account_avatar_url
from .services import AUTO_GRANT_DURATION, SelfAccessRefused, require_scope

NO_PROFILE_MESSAGE = "Le profil professionnel n’est pas disponible."


class GuestLookupSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=80)
    last_name = serializers.CharField(max_length=80)
    birth_date = serializers.DateField()
    phone = serializers.CharField(max_length=32)


class GuestStartSerializer(serializers.Serializer):
    confirmation_token = serializers.CharField(max_length=200)


def _message(exc):
    detail = exc.detail
    return str(detail[0] if isinstance(detail, list) else detail)


class ProfessionalGuestLookupView(APIView):
    """Étape 1 : nom + date de naissance + téléphone → le profil à comparer avec la personne présente (photo, nom). Aucune donnée médicale."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "guest_lookup"

    def post(self, request):
        profile = getattr(request.user, "professional_profile", None)
        if not profile:
            return Response({"success": False, "message": NO_PROFILE_MESSAGE}, status=403)
        serializer = GuestLookupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        establishment = profile.active_establishment
        try:
            patient, token = find_guest_patient(professional=profile, **serializer.validated_data)
        except GuestLookupLocked as exc:
            record_event(event_type="access_grant.guest_lookup_locked", actor=request.user, actor_role="professional", establishment=establishment, metadata={"action": "guest_lookup", "status": "refused", "method": GUEST_METHOD})
            return Response({"success": False, "code": "guest_lookup_locked", "message": str(exc)}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except SelfAccessRefused as exc:
            record_event(event_type="access_grant.self_refused", actor=request.user, actor_role="professional", establishment=establishment, metadata={"action": "self_access_refused", "status": "refused", "method": GUEST_METHOD})
            return Response({"success": False, "code": "self_access", "message": _message(exc)}, status=403)
        except ValidationError as exc:
            # L'échec est déjà compté par le service. Il n'est pas rattaché à un patient : on ne sait pas s'il en existe un.
            record_event(event_type="access_grant.guest_lookup_failed", actor=request.user, actor_role="professional", establishment=establishment, metadata={"action": "guest_lookup", "status": "refused", "method": GUEST_METHOD})
            return Response({"success": False, "message": _message(exc)}, status=400)
        # Trace sans patient : le patient n'est averti qu'à l'ouverture de l'accès, pas à une simple recherche (le journal d'audit garde le lien via l'empreinte).
        record_event(event_type="access_grant.guest_lookup_matched", actor=request.user, actor_role="professional", establishment=establishment, metadata={"action": "guest_lookup", "status": "matched", "method": GUEST_METHOD})
        photo_url = account_avatar_url(patient.user) if patient.user_id else ""
        return Response({"success": True, "data": {
            "confirmation_token": token,
            "expires_in_seconds": int(CONFIRMATION_TTL.total_seconds()),
            "patient": {"first_name": patient.display_first_name(), "last_name": patient.display_last_name(), "photo_url": photo_url or None},
            "scope": list(GUEST_SCOPES),
        }})


class ProfessionalGuestStartView(APIView):
    """Étape 2 : le professionnel a comparé le profil à la personne présente → l'accès invité s'ouvre (périmètre minimal, 2 h, un seul professionnel à la fois)."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "guest_start"

    @transaction.atomic
    def post(self, request):
        profile = getattr(request.user, "professional_profile", None)
        if not profile:
            return Response({"success": False, "message": NO_PROFILE_MESSAGE}, status=403)
        serializer = GuestStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            grant = start_guest_grant(professional=profile, confirmation_token=serializer.validated_data["confirmation_token"])
        except SelfAccessRefused as exc:
            return Response({"success": False, "code": "self_access", "message": _message(exc)}, status=403)
        except ValidationError as exc:
            return Response({"success": False, "message": _message(exc)}, status=400)
        record_event(event_type="access_grant.requested", actor=request.user, actor_role="professional", patient=grant.patient, establishment=grant.establishment, access_grant=grant, metadata={"action": "requested", "scope": grant.scope, "status": "active", "method": GUEST_METHOD})
        record_event(event_type="access_grant.accept", actor=request.user, actor_role="professional", patient=grant.patient, establishment=grant.establishment, access_grant=grant, metadata={"action": "accept", "status": "active", "method": GUEST_METHOD, "authorized_until": grant.expires_at.isoformat(), "access_duration_minutes": int(AUTO_GRANT_DURATION.total_seconds() // 60)})
        notify_patient(grant.patient, kind="access.opened", title="Accès ouvert en mode invité", body=f"{grant.professional_name} de {grant.facility_label} a ouvert votre dossier en mode invité (nom, date de naissance, téléphone) pour 2 h. Si ce n’était pas vous, mettez fin à l’accès depuis votre espace patient.", metadata={"access_grant_id": str(grant.id), "method": GUEST_METHOD})
        return Response({"success": True, "data": ProfessionalAccessGrantSerializer(grant).data}, status=status.HTTP_201_CREATED)


class GuestPreconsultationSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=240)
    observations = serializers.CharField(max_length=4000, required=False, allow_blank=True, default="")


class ProfessionalGuestPreconsultationView(APIView):
    """Patient sans téléphone : personne n'a préparé sa pré-consultation, le médecin la crée lui-même sur son accès invité.

    C'est le même brouillon que celui d'un patient ou d'un infirmier, rattaché à l'établissement du médecin. S'il en existe déjà un
    en préparation (un infirmier l'a rempli), il est renvoyé tel quel : on n'en crée jamais un second."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "guest_start"

    @transaction.atomic
    def post(self, request, pk):
        profile = getattr(request.user, "professional_profile", None)
        access_error = professional_clinical_access_error(profile)
        if access_error:
            return Response({"success": False, "message": access_error}, status=403)
        grant = AccessGrant.objects.select_related("patient", "establishment").filter(pk=pk, professional=profile, establishment=profile.active_establishment, access_mode="guest").first()
        if not grant:
            return Response({"success": False, "message": "Accès invité introuvable dans votre périmètre."}, status=404)
        try:
            require_scope(grant, "preconsultation")
        except PermissionDenied as exc:
            return Response({"success": False, "message": str(exc.detail)}, status=403)
        serializer = GuestPreconsultationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Même règle que pour le patient : un seul brouillon à la fois. Le verrou sérialise deux créations simultanées.
        PatientProfile.objects.select_for_update().get(pk=grant.patient_id)
        draft = CareEncounter.objects.filter(patient=grant.patient, status="draft").order_by("-updated_at", "-created_at").first()
        if draft:
            if draft.establishment_id and draft.establishment_id != grant.establishment_id:
                return Response({"success": False, "message": "Une pré-consultation est déjà en préparation pour un autre établissement."}, status=status.HTTP_409_CONFLICT)
            return Response({"success": True, "data": CareEncounterSerializer(draft).data})
        encounter = CareEncounter.objects.create(
            patient=grant.patient,
            establishment=grant.establishment,
            facility_label=grant.establishment.name,
            reason=serializer.validated_data["reason"].strip(),
            observations=serializer.validated_data["observations"].strip(),
            recorded_with_help=grant.professional_name,
        )
        record_event(event_type="preconsultation.created", actor=request.user, actor_role="professional", patient=grant.patient, establishment=grant.establishment, access_grant=grant, metadata={"action": "created", "encounter_id": str(encounter.id), "status": encounter.status, "resource_type": "preconsultation", "method": GUEST_METHOD})
        return Response({"success": True, "data": CareEncounterSerializer(encounter).data}, status=status.HTTP_201_CREATED)

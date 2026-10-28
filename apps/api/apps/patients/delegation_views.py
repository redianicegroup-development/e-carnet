import hashlib
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.audit.services import record_event
from apps.care.notifications import notify_patient
from apps.identity.throttles import IpScopedThrottle
from .models import PatientProfile, TrustedContactDelegation

logger = logging.getLogger(__name__)
INVITATION_TTL = timedelta(hours=72)
ALLOWED_DURATIONS = {30, 90, 365}
SCOPE = TrustedContactDelegation.SCOPE_EMERGENCY_CARD


def enabled_response():
    return Response({"success": False, "message": "Les proches de confiance ne sont pas encore activés."}, status=404)


def ensure_enabled():
    return bool(getattr(settings, "ECARNET_TRUSTED_CONTACTS_ENABLED", False))


def normalize_email(value):
    email = str(value or "").strip().lower()
    try:
        validate_email(email)
    except DjangoValidationError:
        return ""
    return email


def expire_if_needed(item):
    if item.status == "active" and item.expires_at and item.expires_at <= timezone.now():
        item.status = "expired"
        item.save(update_fields=("status", "updated_at"))
    return item


def display_name(user):
    return (user.get_full_name() or user.email or user.username).strip()


def delegation_payload(item, *, selected=False, include_email=False):
    expire_if_needed(item)
    data = {
        "id": str(item.id),
        "status": item.status,
        "relationship_label": item.relationship_label,
        "scopes": list(item.scopes or []),
        "invitation_expires_at": item.invitation_expires_at.isoformat(),
        "accepted_at": item.accepted_at.isoformat() if item.accepted_at else None,
        "expires_at": item.expires_at.isoformat() if item.expires_at else None,
        "is_selected": selected,
    }
    if include_email:
        data["invited_email"] = item.invited_email
    if item.delegate_id:
        data["delegate_name"] = display_name(item.delegate)
    return data


def patient_for_owner(user):
    return PatientProfile.objects.filter(user=user).first()


class PatientDelegationListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "trusted_contact_changes"

    def get(self, request):
        if not ensure_enabled():
            return enabled_response()
        patient = patient_for_owner(request.user)
        if not patient:
            return Response({"success": True, "data": []})
        items = TrustedContactDelegation.objects.filter(patient=patient).select_related("delegate")
        return Response({"success": True, "data": [delegation_payload(item, include_email=True) for item in items]})

    @transaction.atomic
    def post(self, request):
        if not ensure_enabled():
            return enabled_response()
        patient = patient_for_owner(request.user)
        if not patient:
            return Response({"success": False, "message": "Le compte patient doit être initialisé avant d’inviter un proche."}, status=409)
        email = normalize_email(request.data.get("email"))
        relationship = str(request.data.get("relationship_label", "")).strip()
        duration = request.data.get("duration_days", 30)
        if not email:
            return Response({"success": False, "message": "Une adresse e-mail valide est requise."}, status=400)
        if relationship not in dict(TrustedContactDelegation.RELATION_CHOICES):
            return Response({"success": False, "message": "Choisissez le lien avec votre proche."}, status=400)
        try:
            duration = int(duration)
        except (TypeError, ValueError):
            duration = 0
        if duration not in ALLOWED_DURATIONS:
            return Response({"success": False, "message": "La durée doit être de 30, 90 ou 365 jours."}, status=400)
        if email == (request.user.email or "").strip().lower():
            return Response({"success": False, "message": "Vous ne pouvez pas vous déléguer votre propre fiche."}, status=400)
        if TrustedContactDelegation.objects.filter(patient=patient, status="active", expires_at__lte=timezone.now()).update(status="expired", updated_at=timezone.now()):
            pass
        if TrustedContactDelegation.objects.filter(patient=patient, status="active").count() >= 3:
            return Response({"success": False, "message": "Vous pouvez avoir au maximum trois proches de confiance actifs."}, status=409)
        if TrustedContactDelegation.objects.filter(patient=patient, invited_email=email, status__in=("pending", "active")).exists():
            return Response({"success": False, "message": "Une invitation ou une délégation existe déjà pour cette adresse."}, status=409)
        raw_token = "ECM-PROCHE-" + secrets.token_urlsafe(10).upper()
        now = timezone.now()
        item = TrustedContactDelegation.objects.create(
            patient=patient,
            invited_email=email,
            relationship_label=relationship,
            scopes=[SCOPE],
            requested_duration_days=duration,
            token_hash=TrustedContactDelegation.digest(raw_token),
            invitation_expires_at=now + INVITATION_TTL,
        )
        record_event(event_type="delegation.invited", actor=request.user, actor_role="patient", patient=patient, metadata={"delegation_id": str(item.id), "action": "invited"})
        data = delegation_payload(item, include_email=True)
        data["join_code"] = raw_token
        return Response({"success": True, "data": data}, status=201)


class DelegationJoinCodeRedeemView(APIView):
    """Le proche saisit le mot remis par le patient depuis son propre compte."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [IpScopedThrottle]
    throttle_scope = "trusted_contact_accept"

    @transaction.atomic
    def post(self, request):
        if not ensure_enabled():
            return enabled_response()
        if not PatientProfile.objects.filter(user=request.user).exists():
            return Response({"success": False, "message": "Complétez d’abord votre profil patient."}, status=409)
        raw_code = str(request.data.get("code", "")).strip().upper()
        item = TrustedContactDelegation.objects.select_for_update().select_related("patient", "patient__user").filter(
            token_hash=TrustedContactDelegation.digest(raw_code), status="pending"
        ).first()
        if not item or item.invitation_expires_at <= timezone.now():
            if item and item.status == "pending":
                item.status = "expired"
                item.save(update_fields=("status", "updated_at"))
            return Response({"success": False, "message": "Ce mot de rattachement est invalide, expiré ou déjà utilisé."}, status=404)
        if item.patient.user_id == request.user.id:
            return Response({"success": False, "message": "Vous ne pouvez pas rattacher votre propre compte."}, status=400)
        if TrustedContactDelegation.objects.filter(patient=item.patient, status="active", expires_at__gt=timezone.now()).count() >= 3:
            return Response({"success": False, "message": "Le patient a déjà atteint la limite de trois proches actifs."}, status=409)
        item.delegate = request.user
        item.status = "active"
        item.accepted_at = timezone.now()
        item.expires_at = timezone.now() + timedelta(days=item.requested_duration_days)
        item.save(update_fields=("delegate", "status", "accepted_at", "expires_at", "updated_at"))
        record_event(event_type="delegation.accepted", actor=request.user, actor_role="delegate", patient=item.patient, metadata={"delegation_id": str(item.id), "action": "accepted"})
        notify_patient(item.patient, kind="delegation.accepted", title="Votre proche a accepté", body="Votre invitation comme proche de confiance a été acceptée.", metadata={"delegation_id": str(item.id)}, coalesce_key=f"delegation-accepted:{item.id}")
        return Response({"success": True, "data": delegation_payload(item)})


class PatientDelegationActionView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "trusted_contact_changes"

    def _owned(self, request, pk, lock=False):
        query = TrustedContactDelegation.objects
        if lock:
            query = query.select_for_update()
        return query.filter(pk=pk, patient__user=request.user).select_related("patient", "delegate").first()

    @transaction.atomic
    def post(self, request, pk, action):
        if not ensure_enabled():
            return enabled_response()
        item = self._owned(request, pk, lock=True)
        if not item:
            return Response({"success": False, "message": "Délégation introuvable."}, status=404)
        now = timezone.now()
        if action == "revoke":
            if item.status not in ("pending", "active"):
                return Response({"success": False, "message": "Cette délégation n’est plus active."}, status=409)
            item.status = "revoked"
            item.revoked_at = now
            item.save(update_fields=("status", "revoked_at", "updated_at"))
            record_event(event_type="delegation.revoked", actor=request.user, actor_role="patient", patient=item.patient, metadata={"delegation_id": str(item.id), "action": "revoked"})
        elif action == "renew":
            if item.status != "active":
                return Response({"success": False, "message": "Seule une délégation active peut être renouvelée."}, status=409)
            expire_if_needed(item)
            if item.status != "active":
                return Response({"success": False, "message": "Cette délégation est expirée."}, status=409)
            item.expires_at = now + timedelta(days=item.requested_duration_days)
            item.save(update_fields=("expires_at", "updated_at"))
            record_event(event_type="delegation.renewed", actor=request.user, actor_role="patient", patient=item.patient, metadata={"delegation_id": str(item.id), "action": "renewed"})
        else:
            return Response({"success": False, "message": "Action inconnue."}, status=400)
        return Response({"success": True, "data": delegation_payload(item, include_email=True)})


class DelegationInvitationPreviewView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if not ensure_enabled():
            return enabled_response()
        raw_token = str(request.query_params.get("token", "")).strip()
        item = TrustedContactDelegation.objects.filter(token_hash=TrustedContactDelegation.digest(raw_token)).select_related("patient", "patient__user").first()
        if not item or item.status != "pending" or item.invitation_expires_at <= timezone.now():
            return Response({"success": False, "message": "Cette invitation est invalide, expirée ou déjà utilisée."}, status=404)
        return Response({"success": True, "data": {"id": str(item.id), "invited_email": item.invited_email, "inviter_name": display_name(item.patient.user), "patient_first_name": item.patient.display_first_name(), "relationship_label": item.relationship_label, "scopes": list(item.scopes), "requested_duration_days": item.requested_duration_days, "invitation_expires_at": item.invitation_expires_at.isoformat()}})


class DelegationInvitationDecisionView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [IpScopedThrottle]
    throttle_scope = "trusted_contact_accept"

    @transaction.atomic
    def post(self, request, action):
        if not ensure_enabled():
            return enabled_response()
        raw_token = str(request.data.get("token", "")).strip()
        item = TrustedContactDelegation.objects.select_for_update().filter(token_hash=TrustedContactDelegation.digest(raw_token)).select_related("patient", "patient__user").first()
        if not item or item.status != "pending" or item.invitation_expires_at <= timezone.now():
            return Response({"success": False, "message": "Cette invitation est invalide, expirée ou déjà utilisée."}, status=404)
        if (request.user.email or "").strip().lower() != item.invited_email:
            return Response({"success": False, "message": "Connectez-vous avec le compte correspondant à l’adresse invitée."}, status=403)
        if item.patient.user_id == request.user.id:
            return Response({"success": False, "message": "Vous ne pouvez pas accepter votre propre invitation."}, status=400)
        if action == "decline":
            item.status = "declined"
            item.save(update_fields=("status", "updated_at"))
            record_event(event_type="delegation.declined", actor=request.user, actor_role="delegate", patient=item.patient, metadata={"delegation_id": str(item.id), "action": "declined"})
            return Response({"success": True, "data": {"status": item.status}})
        if action != "accept":
            return Response({"success": False, "message": "Décision inconnue."}, status=400)
        if TrustedContactDelegation.objects.filter(patient=item.patient, status="active", expires_at__gt=timezone.now()).count() >= 3:
            return Response({"success": False, "message": "Le patient a déjà atteint la limite de trois proches actifs."}, status=409)
        item.delegate = request.user
        item.status = "active"
        item.accepted_at = timezone.now()
        item.expires_at = timezone.now() + timedelta(days=item.requested_duration_days)
        item.save(update_fields=("delegate", "status", "accepted_at", "expires_at", "updated_at"))
        record_event(event_type="delegation.accepted", actor=request.user, actor_role="delegate", patient=item.patient, metadata={"delegation_id": str(item.id), "action": "accepted"})
        notify_patient(item.patient, kind="delegation.accepted", title="Votre proche a accepté", body="Votre invitation comme proche de confiance a été acceptée.", metadata={"delegation_id": str(item.id)}, coalesce_key=f"delegation-accepted:{item.id}")
        return Response({"success": True, "data": delegation_payload(item)})


class MyDelegationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not ensure_enabled():
            return enabled_response()
        selected = request.session.get("active_delegation_id")
        items = TrustedContactDelegation.objects.filter(delegate=request.user, status="active").select_related("patient", "patient__user")
        result = []
        for item in items:
            expire_if_needed(item)
            if item.status == "active":
                payload = delegation_payload(item, selected=str(item.id) == str(selected))
                payload.update({"patient_first_name": item.patient.display_first_name(), "patient_last_name": item.patient.display_last_name(), "patient_id": str(item.patient_id)})
                result.append(payload)
        return Response({"success": True, "data": result})


class SelectDelegationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not ensure_enabled():
            return enabled_response()
        item = TrustedContactDelegation.objects.filter(pk=pk, delegate=request.user, status="active").first()
        if not item:
            return Response({"success": False, "message": "Cette délégation n’est plus active."}, status=404)
        expire_if_needed(item)
        if item.status != "active":
            return Response({"success": False, "message": "Cette délégation est expirée."}, status=403)
        request.session["active_delegation_id"] = str(item.id)
        request.session.pop("active_patient_profile_id", None)
        return Response({"success": True, "data": delegation_payload(item, selected=True)})

    def delete(self, request, pk):
        request.session.pop("active_delegation_id", None)
        return Response({"success": True, "data": None})

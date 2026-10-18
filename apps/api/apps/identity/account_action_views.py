import uuid

from django.contrib.auth import get_user_model, logout
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .admin_views import IsSuperuserOnly
from .models import AccountActionRequest, AccountContext, AccountProfile, AuthIdentity, ThemePreference
from apps.cloudinary_storage import destroy as cloudinary_destroy


SUSPENSION_DAYS = {1, 7, 14, 30, 60, 90}
OPEN_STATUSES = ("new", "in_review")


class AccountActionRequestInputSerializer(serializers.Serializer):
    request_type = serializers.ChoiceField(choices=("suspension", "deletion"))
    suspension_days = serializers.IntegerField(required=False, min_value=1, max_value=90)
    reason = serializers.ChoiceField(choices=AccountActionRequest.REASONS, required=False, allow_blank=True)
    details = serializers.CharField(required=False, allow_blank=True, max_length=1200, trim_whitespace=True)

    def validate(self, attrs):
        request_type = attrs["request_type"]
        if request_type == "suspension":
            days = attrs.get("suspension_days")
            if days not in SUSPENSION_DAYS:
                raise serializers.ValidationError({"suspension_days": "Choisissez une durée proposée."})
            attrs["reason"] = ""
            attrs["details"] = ""
        else:
            if "suspension_days" in attrs:
                raise serializers.ValidationError({"suspension_days": "La durée concerne uniquement une suspension."})
            if not attrs.get("reason"):
                raise serializers.ValidationError({"reason": "Choisissez un motif."})
            if attrs["reason"] == "other" and not attrs.get("details", "").strip():
                raise serializers.ValidationError({"details": "Précisez votre autre motif."})
            if attrs["reason"] != "other":
                attrs["details"] = ""
        return attrs


def anonymize_and_disable_account(user):
    """Disable login immediately and scrub identity while retaining protected clinical/audit history."""
    if user.is_staff or user.is_superuser:
        raise PermissionDenied("Un compte administrateur ou superadministrateur ne peut pas être supprimé.")

    from apps.patients.models import ClinicalDeclaration, PatientProfile
    from apps.care.models import AccessGrant, Appointment, CareEncounter, FollowUpPlan, HealthMeasurement, MedicalDocument, MedicationReminder, PatientNotification, PreConsultationRevision, Vaccination
    from apps.professionals.models import ProfessionalProfile
    from apps.establishments.models import EstablishmentAdministrator, EstablishmentMembership

    now = timezone.now()
    patient = PatientProfile.objects.filter(user=user).first()
    if patient:
        # External destruction must succeed before database references are removed. A refusal raises and the surrounding
        # transaction rolls back, so the account is not anonymized with dangling Cloudinary references.
        documents = list(MedicalDocument.objects.filter(patient=patient))
        for document in documents:
            if document.cloudinary_public_id:
                try:
                    cloudinary_destroy(document.cloudinary_public_id, resource_type=document.cloudinary_resource_type or "image")
                except Exception as exc:
                    raise RuntimeError("La suppression Cloudinary des documents du compte a échoué ; le compte est conservé.") from exc
        for document in documents:
            if document.file:
                document.file.delete(save=False)
        MedicalDocument.objects.filter(patient=patient).delete()
        Vaccination.objects.filter(patient=patient).delete()
        HealthMeasurement.objects.filter(patient=patient).delete()
        MedicationReminder.objects.filter(patient=patient).delete()
        FollowUpPlan.objects.filter(patient=patient).delete()
        Appointment.objects.filter(patient=patient).delete()
        PatientNotification.objects.filter(patient=patient).delete()
        # Clear patient-entered administrative data; keep the opaque profile anchor for immutable audit references.
        ClinicalDeclaration.objects.filter(patient=patient).delete()
        PreConsultationRevision.objects.filter(encounter__patient=patient).delete()
        CareEncounter.objects.filter(patient=patient).update(
            facility_label="", reason="", observations="", recorded_with_help="",
            status="closed", closed_at=now, vitals={},
        )
        PatientProfile.objects.filter(pk=patient.pk).update(
            user=None, first_name="", last_name="", phone="", birth_date=None, address="", profession="", coverage_provider="", coverage_number="", coverage_expiry=None,
            updated_at=now,
        )
        AccessGrant.objects.filter(patient=patient, status__in=("pending", "active")).update(status="revoked", revoked_at=now)

    professional = ProfessionalProfile.objects.filter(user=user).first()
    if professional:
        AccessGrant.objects.filter(professional=professional, status__in=("pending", "active")).update(status="revoked", revoked_at=now)
        EstablishmentMembership.objects.filter(professional=professional, status__in=("pending", "active")).update(
            status="terminated", reviewed_at=now, left_at=now,
        )
        for public_id, resource_type in (
            (professional.stamp_cloudinary_public_id, professional.stamp_cloudinary_resource_type),
            (professional.signature_cloudinary_public_id, professional.signature_cloudinary_resource_type),
        ):
            if public_id:
                try:
                    cloudinary_destroy(public_id, resource_type=resource_type or "image")
                except Exception as exc:
                    raise RuntimeError("La suppression Cloudinary du cachet ou de la signature du compte a échoué ; le compte est conservé.") from exc
        ProfessionalProfile.objects.filter(pk=professional.pk).update(
            professional_title="Compte anonymisé", specialty="", professional_identifier="",
            stamp_cloudinary_public_id="", stamp_cloudinary_resource_type="image", stamp_cloudinary_version=None,
            signature_cloudinary_public_id="", signature_cloudinary_resource_type="image", signature_cloudinary_version=None,
            verification_status="rejected", active_establishment=None, updated_at=now,
        )

    EstablishmentAdministrator.objects.filter(user=user, status="active").update(status="ended", ended_at=now)
    AuthIdentity.objects.filter(user=user).delete()
    AccountProfile.objects.filter(user=user).delete()
    ThemePreference.objects.filter(user=user).delete()
    AccountContext.objects.filter(user=user).delete()

    # Keep the auth row only as a non-identifying anchor for append-only audit/clinical foreign keys.
    user.username = f"deleted-{uuid.uuid4().hex}"
    user.email = ""
    user.first_name = ""
    user.last_name = ""
    user.is_active = False
    user.last_login = None
    user.set_unusable_password()
    user.save(update_fields=("username", "email", "first_name", "last_name", "is_active", "last_login", "password"))


def request_payload(item):
    return {
        "id": str(item.id),
        "request_type": item.request_type,
        "suspension_days": item.suspension_days,
        "reason": item.reason,
        "details": item.details,
        "status": item.status,
        "submitted_at": item.submitted_at.isoformat(),
        "reviewed_at": item.reviewed_at.isoformat() if item.reviewed_at else None,
        "account_deleted": item.user_id is None,
    }


def admin_request_payload(item):
    user = item.user
    return {
        **request_payload(item),
        "user_email": user.email if user else "",
        "user_first_name": user.first_name if user else "",
        "user_last_name": user.last_name if user else "",
        "reviewed_by_email": item.reviewed_by.email if item.reviewed_by else None,
        "protected_account": bool(user and (user.is_staff or user.is_superuser)),
    }


class CurrentAccountActionRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        requests = AccountActionRequest.objects.filter(user=request.user)
        return Response({"success": True, "data": [request_payload(item) for item in requests]})

    @transaction.atomic
    def post(self, request):
        serializer = AccountActionRequestInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        user = get_user_model().objects.select_for_update().get(pk=request.user.pk)
        if values["request_type"] == "deletion" and (user.is_staff or user.is_superuser):
            raise PermissionDenied("Un compte administrateur ou superadministrateur ne peut pas être supprimé.")
        if values["request_type"] == "suspension" and AccountActionRequest.objects.filter(user=user, request_type="suspension", status__in=OPEN_STATUSES).exists():
            return Response({"success": False, "message": "Une demande de ce type est déjà en attente de traitement."}, status=409)

        if values["request_type"] == "deletion":
            # The user has already confirmed in the UI: disable/anonymize now; no admin approval is required.
            item = AccountActionRequest.objects.select_for_update().filter(
                user=user, request_type="deletion", status__in=OPEN_STATUSES,
            ).order_by("-submitted_at").first()
            if item:
                item.reason = values["reason"]
                item.details = values.get("details", "")
                item.status = "resolved"
                item.reviewed_at = timezone.now()
                item.save(update_fields=("reason", "details", "status", "reviewed_at", "updated_at"))
            else:
                item = AccountActionRequest.objects.create(
                    user=user, request_type="deletion", reason=values["reason"], details=values.get("details", ""),
                    status="resolved", reviewed_at=timezone.now(),
                )
            try:
                anonymize_and_disable_account(user)
            except RuntimeError as exc:
                transaction.set_rollback(True)
                return Response({"success": False, "message": str(exc)}, status=502)
            item.user = None  # keep the request/reason anonymized in the admin log, not linked to the deleted identity
            item.save(update_fields=("user",))
            logout(request)
            return Response({"success": True, "data": request_payload(item)}, status=201)

        item = AccountActionRequest.objects.create(user=user, **values)
        return Response({"success": True, "data": request_payload(item)}, status=201)


class AdminAccountActionRequestsView(APIView):
    permission_classes = [IsSuperuserOnly]

    def get(self, request):
        items = AccountActionRequest.objects.select_related("user", "reviewed_by").order_by("-submitted_at")[:250]
        return Response({"success": True, "data": [admin_request_payload(item) for item in items]})


class AdminAccountActionRequestStatusView(APIView):
    permission_classes = [IsSuperuserOnly]

    def patch(self, request, request_id):
        status_value = request.data.get("status")
        allowed = {choice[0] for choice in AccountActionRequest.STATUSES}
        if not isinstance(status_value, str) or status_value not in allowed:
            return Response({"success": False, "message": "Statut de demande invalide."}, status=400)
        item = get_object_or_404(AccountActionRequest.objects.select_related("user", "reviewed_by"), pk=request_id)
        if item.request_type == "deletion" and item.user_id is not None and status_value == "resolved":
            return Response({"success": False, "message": "Utilisez l’action de suppression immédiate pour clôturer cette demande."}, status=409)
        if item.user_id is None and status_value != "resolved":
            return Response({"success": False, "message": "Une demande déjà supprimée ne peut pas être remise en attente."}, status=409)
        item.status = status_value
        item.reviewed_by = request.user
        item.reviewed_at = timezone.now()
        item.save(update_fields=("status", "reviewed_by", "reviewed_at", "updated_at"))
        return Response({"success": True, "data": admin_request_payload(item)})


class AdminDeleteRequestedAccountView(APIView):
    permission_classes = [IsSuperuserOnly]

    @transaction.atomic
    def post(self, request, request_id):
        item = get_object_or_404(
            AccountActionRequest.objects.select_for_update().select_related("user", "reviewed_by"), pk=request_id,
        )
        if item.request_type != "deletion":
            return Response({"success": False, "message": "Seule une demande de suppression peut déclencher cette action."}, status=400)
        if not item.user_id:
            return Response({"success": False, "message": "Ce compte a déjà été supprimé ou anonymisé."}, status=409)
        if item.status not in OPEN_STATUSES:
            return Response({"success": False, "message": "La demande n’est plus en attente de traitement."}, status=409)
        user = get_user_model().objects.select_for_update().get(pk=item.user_id)
        if user.is_staff or user.is_superuser:
            return Response({"success": False, "message": "Les comptes staff et superadministrateurs sont protégés contre la suppression."}, status=403)
        try:
            anonymize_and_disable_account(user)
        except RuntimeError as exc:
            transaction.set_rollback(True)
            return Response({"success": False, "message": str(exc)}, status=502)
        item.user = None
        item.status = "resolved"
        item.reviewed_by = request.user
        item.reviewed_at = timezone.now()
        item.save(update_fields=("user", "status", "reviewed_by", "reviewed_at", "updated_at"))
        return Response({"success": True, "data": admin_request_payload(item)})

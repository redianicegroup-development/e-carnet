import logging
import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model, logout
from django.db import DatabaseError, transaction
from django.db.models import ProtectedError, RestrictedError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .account_state import active_suspension
from .admin_views import IsSuperuserOnly
from .models import AccountActionRequest, AccountContext, AccountProfile, AuthIdentity, ThemePreference
from .session_control import end_all_sessions
from apps.cloudinary_storage import destroy as cloudinary_destroy


logger = logging.getLogger(__name__)

SUSPENSION_DAYS = {1, 7, 14, 30, 60, 90}
OPEN_STATUSES = ("new", "in_review")
DELETION_FAILED_MESSAGE = (
    "La suppression n’a pas pu aboutir et rien n’a été effacé : votre compte est intact. "
    "Réessayez dans un instant ; si cela continue, écrivez à l’équipe Mon E‑Carnet."
)


class AccountActionRequestInputSerializer(serializers.Serializer):
    """Suspension : durée + motif, effet immédiat. Suppression : aucun motif demandé, effet immédiat."""
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
            if not attrs.get("reason"):
                raise serializers.ValidationError({"reason": "Choisissez un motif de suspension."})
            if attrs["reason"] == "other" and not attrs.get("details", "").strip():
                raise serializers.ValidationError({"details": "Précisez votre autre motif."})
            if attrs["reason"] != "other":
                attrs["details"] = ""
        else:
            if "suspension_days" in attrs:
                raise serializers.ValidationError({"suspension_days": "La durée concerne uniquement une suspension."})
            # Suppression sans motif : si un ancien client en envoie un, il est ignoré et jamais conservé.
            attrs["reason"] = ""
            attrs["details"] = ""
        return attrs


def anonymize_and_disable_account(user):
    """Disable login immediately and scrub identity while retaining protected clinical/audit history."""
    if user.is_staff or user.is_superuser:
        raise PermissionDenied("Un compte administrateur ou superadministrateur ne peut pas être supprimé.")

    from apps.patients.erasure import erase_patient_records
    from apps.patients.models import PatientProfile, PatientRepresentation
    from apps.care.models import AccessGrant, Consultation
    from apps.professionals.models import ProfessionalProfile
    from apps.establishments.models import EstablishmentAdministrator, EstablishmentMembership

    now = timezone.now()
    # Suppression de compte = effacement IMMÉDIAT et IRRÉVERSIBLE des données (lignes réellement supprimées de la base, fichiers distants détruits), voir
    # apps/patients/erasure.py. Un refus du service de fichiers lève RuntimeError : la transaction est annulée, rien n'est effacé. Ne restent que les
    # lignes que le journal d'audit protégé référence (déclencheurs de base de données), vidées de tout contenu.
    patient = PatientProfile.objects.filter(user=user).first()
    if patient:
        erase_patient_records(patient)
        PatientProfile.objects.filter(pk=patient.pk).update(user=None, updated_at=now)
    # Les carnets enfants du titulaire disparaissent avec son compte : personne ne pourrait plus les consulter ni les supprimer.
    for representation in PatientRepresentation.objects.select_related("patient").filter(guardian=user).exclude(status__in=("deleted", "transferred")):
        erase_patient_records(representation.patient)
        representation.status = "deleted"
        representation.deletion_reason = "account_deleted"
        representation.deleted_at = now
        representation.save(update_fields=("status", "deletion_reason", "deleted_at", "updated_at"))

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
        # Fichiers détruits ci-dessus : les consultations ne doivent plus annoncer une signature ou un cachet qui n'existe plus.
        Consultation.objects.filter(professional=professional).update(signature_asset_id="", stamp_asset_id="")
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
        "suspended_until": item.suspended_until.isoformat() if item.suspended_until else None,
        "lifted_at": item.lifted_at.isoformat() if item.lifted_at else None,
        "account_deleted": item.user_id is None,
    }


def journal_payload(item, now):
    """Ligne du journal de la console : en lecture seule. Pour une suspension, seul le MOTIF est montré (jamais le détail libre ni l'identité)."""
    if item.request_type == "deletion":
        return {"id": str(item.id), "kind": "deletion", "submitted_at": item.submitted_at.isoformat()}
    if item.suspended_until is None:
        state = "legacy"  # demande enregistrée avant le passage à la suspension immédiate : elle n'a jamais pris effet
    elif item.lifted_at:
        state = "ended" if item.lifted_at >= item.suspended_until else "lifted"
    else:
        state = "active" if item.suspended_until > now else "ended"
    reasons = dict(AccountActionRequest.REASONS)
    return {
        "id": str(item.id), "kind": "suspension", "submitted_at": item.submitted_at.isoformat(), "suspension_days": item.suspension_days,
        "reason": item.reason, "reason_label": reasons.get(item.reason, ""), "suspended_until": item.suspended_until.isoformat() if item.suspended_until else None,
        "state": state,
    }


class CurrentAccountActionRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        requests = AccountActionRequest.objects.filter(user=request.user)
        return Response({"success": True, "data": [request_payload(item) for item in requests]})

    def post(self, request):
        """Enveloppe de `_handle`.

        Tout échec de base de données (clé étrangère protégée, contrainte différée vérifiée à la validation de la transaction, verrou…)
        devenait une page HTML 500 que le navigateur affichait « Le service est momentanément indisponible », sans que personne ne sache
        pourquoi. Ici la transaction est annulée (rien n'est effacé), la cause est journalisée avec sa trace et la personne reçoit une
        phrase claire en JSON. `_handle` est atomique : une erreur levée à sa validation remonte jusqu'ici.
        """
        try:
            return self._handle(request)
        except (ProtectedError, RestrictedError, DatabaseError):
            logger.exception("action de compte: échec de base de données (user=%s)", getattr(request.user, "pk", None))
            return Response({"success": False, "message": DELETION_FAILED_MESSAGE}, status=500)

    @transaction.atomic
    def _handle(self, request):
        serializer = AccountActionRequestInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        user = get_user_model().objects.select_for_update().get(pk=request.user.pk)
        protected = user.is_staff or user.is_superuser

        if values["request_type"] == "suspension":
            if protected:
                raise PermissionDenied("Un compte administrateur ou superadministrateur ne peut pas être suspendu ainsi.")
            now = timezone.now()
            if active_suspension(user, now):
                return Response({"success": False, "message": "Votre compte est déjà suspendu."}, status=409)
            # Suspension IMMÉDIATE : aucune validation de l'équipe. Le compte se ferme, toutes les sessions s'arrêtent, il se rouvrira de lui-même.
            item = AccountActionRequest.objects.create(
                user=user, request_type="suspension", suspension_days=values["suspension_days"], reason=values["reason"],
                details=values.get("details", ""), status="resolved", reviewed_at=now,
                suspended_until=now + timedelta(days=values["suspension_days"]),
            )
            user.is_active = False
            user.save(update_fields=("is_active",))
            end_all_sessions(user)
            logout(request)
            return Response({"success": True, "data": request_payload(item)}, status=201)

        if protected:
            raise PermissionDenied("Un compte administrateur ou superadministrateur ne peut pas être supprimé.")
        # Suppression IMMÉDIATE et sans motif : la personne a déjà confirmé dans l'écran, aucune validation de l'équipe n'est nécessaire.
        item = AccountActionRequest.objects.create(user=user, request_type="deletion", status="resolved", reviewed_at=timezone.now())
        try:
            anonymize_and_disable_account(user)
        except RuntimeError as exc:
            logger.warning("suppression de compte: service de fichiers refusé (user=%s): %s", user.pk, exc)
            transaction.set_rollback(True)
            return Response({"success": False, "message": str(exc)}, status=502)
        except PermissionDenied:
            raise
        except Exception:  # noqa: BLE001 - quelle que soit la cause, la transaction est annulée et la cause est journalisée
            logger.exception("suppression de compte: erreur inattendue (user=%s)", user.pk)
            transaction.set_rollback(True)
            return Response({"success": False, "message": DELETION_FAILED_MESSAGE}, status=500)
        item.user = None  # la ligne du journal reste, sans lien avec l'identité effacée
        item.save(update_fields=("user",))
        logout(request)
        return Response({"success": True, "data": request_payload(item)}, status=201)


class AdminAccountActionRequestsView(APIView):
    """Journal des suspensions et des suppressions, en LECTURE SEULE : l'équipe ne traite plus ces demandes (elles sont immédiates)."""
    permission_classes = [IsSuperuserOnly]

    def get(self, request):
        now = timezone.now()
        items = AccountActionRequest.objects.order_by("-submitted_at")[:250]
        return Response({"success": True, "data": [journal_payload(item, now) for item in items]})

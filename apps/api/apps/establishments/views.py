import base64
import binascii
import logging
import secrets
from datetime import timedelta
from io import BytesIO

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.http import Http404, HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser, IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from apps.identity.throttles import IpScopedThrottle

from apps.audit.services import record_event
from apps.cloudinary_storage import CLOUDINARY_CONFIGURED, upload as cloudinary_upload
from apps.identity.models import AccountContext
from apps.identity.temporary_password import disable_temporary_password, has_pending_temporary_password, issue_temporary_password, temporary_password_expired
from .provisioning import AccountConflict, ProvisionedAccess, login_url, provision_administrator
from .models import PROFILE_FIELDS, Establishment, EstablishmentAdminInvitation, EstablishmentAdministrator, EstablishmentJoinCode, EstablishmentMembership, PrescriptionTemplate, generate_internal_code
from .serializers import EstablishmentProfileSerializer, EstablishmentSerializer, MembershipSerializer, PrescriptionTemplateSerializer, logo_for

User = get_user_model()
logger = logging.getLogger(__name__)
MEMBERSHIP_AGREEMENT_VERSION = "2026-10-08-v1"
STAFF_LIST_LIMIT = 200
INVITATION_INVALID_MESSAGE = "Cette invitation est invalide, expirée ou déjà utilisée."


def payload(establishment):
    return EstablishmentSerializer(establishment).data


def active_administrator(user, establishment_id=None):
    query = EstablishmentAdministrator.objects.filter(user=user, status="active", establishment__status="active")
    if establishment_id:
        query = query.filter(establishment_id=establishment_id)
    return query.select_related("establishment").first()


def access_response_data(establishment, access):
    """Réponse réservée au staff : le mot de passe temporaire n'apparaît qu'ici, une seule fois, et n'est stocké nulle part."""
    data = {
        "email": access.user.email,
        "account_created": access.account_created,
        "must_change_password": access.temporary_password is not None,
        "login_url": login_url(),
        "expires_at": access.expires_at,
    }
    if access.temporary_password:
        data["temporary_password"] = access.temporary_password
    if establishment is not None:
        data["establishment"] = payload(establishment)
    return data


def secret_response(data, status=200):
    response = Response({"success": True, "data": data}, status=status)
    response["Cache-Control"] = "no-store"  # la réponse contient un secret : ni cache navigateur ni cache intermédiaire
    return response


ACCOUNT_CONFLICT_MESSAGES = {
    "account_exists": "Un compte Mon E‑Carnet existe déjà avec cette adresse. Pour lui donner l’accès à cette structure sans toucher à son mot de passe, confirmez le rattachement ; sinon, saisissez une autre adresse.",
    "ambiguous_account": "Plusieurs comptes portent cette adresse : impossible de choisir lequel rattacher.",
}


def account_conflict_response(conflict):
    return Response({"success": False, "code": conflict.code, "message": ACCOUNT_CONFLICT_MESSAGES.get(conflict.code, "Impossible d’ouvrir l’accès avec cette adresse.")}, status=409)


def mask_email(email):
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}" if domain else "***"


class EstablishmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        admin_ids = EstablishmentAdministrator.objects.filter(user=request.user, status="active").values("establishment_id")
        establishments = Establishment.objects.filter(id__in=admin_ids) | Establishment.objects.filter(
            memberships__professional__user=request.user
        )
        return Response({"success": True, "data": EstablishmentSerializer(establishments.distinct(), many=True).data})


class EstablishmentCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = Establishment.with_complete_profile().filter(status="active").order_by("name").values("id", "name", "city")
        return Response({"success": True, "data": [{"id": str(item["id"]), "name": item["name"], "city": item["city"]} for item in items]})


class EstablishmentCreateView(APIView):
    """Ancienne route publique neutralisée: une structure est créée par le staff."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response(
            {"success": False, "message": "La création d’un établissement est réservée à l’équipe Mon E‑Carnet."},
            status=status.HTTP_403_FORBIDDEN,
        )


def active_administrator_record(establishment):
    """Administrateur actif lu dans l'historique préchargé (évite une requête par structure dans la liste du staff)."""
    return next((item for item in establishment.administrator_history.all() if item.status == "active"), None)


def administrator_summary(establishment):
    admin = active_administrator_record(establishment)
    if not admin:
        return None
    return {"name": f"{admin.user.first_name} {admin.user.last_name}".strip(), "email": admin.user.email}


def access_summary(establishment):
    """Où en est l'accès du responsable : temporary_password (jamais connecté), expired (mot de passe temporaire périmé), activated, revoked."""
    admin = active_administrator_record(establishment)
    if not admin:
        # Accès retiré (révoqué ou remplacé) : l'équipe garde l'adresse sous les yeux pour rouvrir un accès en un geste.
        last = next(iter(establishment.administrator_history.all()), None)
        return {"email": last.user.email, "state": "revoked", "expires_at": None} if last else None
    profile = getattr(admin.user, "account_profile", None)
    if not (profile and profile.must_change_password):
        return {"email": admin.user.email, "state": "activated", "expires_at": None}
    return {"email": admin.user.email, "state": "expired" if temporary_password_expired(profile) else "temporary_password", "expires_at": profile.temporary_password_expires_at}


def establishment_stage(establishment, administrator):
    if not administrator or (access_summary(establishment) or {}).get("state") != "activated":
        return "awaiting_activation"
    return "ready" if establishment.is_profile_complete else "awaiting_profile"


class StaffEstablishmentCreateView(APIView):
    """Création par l'équipe Mon E‑Carnet : le nom vérifié et l'e‑mail du responsable suffisent. Le serveur crée le compte du
    responsable avec un mot de passe temporaire (révélé une seule fois ici, à transmettre hors application) ; c'est ensuite
    l'établissement qui renseigne sa fiche (type, ville, adresse, téléphone) dans son onboarding."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        queryset = Establishment.objects.filter(status="active").prefetch_related("administrator_history__user__account_profile")
        total = queryset.count()
        items = []
        for establishment in queryset[:STAFF_LIST_LIMIT]:
            administrator = administrator_summary(establishment)
            items.append({
                "id": str(establishment.id),
                "name": establishment.name,
                "internal_code": establishment.internal_code,
                "created_at": establishment.created_at,
                "profile_completed_at": establishment.profile_completed_at,
                # Mises à jour faites par l'établissement lui‑même : visibles de l'équipe, datées.
                "updated_at": establishment.updated_at,
                "name_updated_at": establishment.name_updated_at,
                "original_name": establishment.original_name,
                "logo": logo_for(establishment),
                "stage": establishment_stage(establishment, administrator),
                "administrator": administrator,
                "access": access_summary(establishment),
            })
        return Response({"success": True, "data": {"items": items, "total": total, "truncated": total > STAFF_LIST_LIMIT}})

    @transaction.atomic
    def post(self, request):
        name = " ".join(str(request.data.get("name", "")).split())
        email = str(request.data.get("responsible_email", "")).strip().lower()
        first_name = str(request.data.get("responsible_first_name", "")).strip()[:120]
        last_name = str(request.data.get("responsible_last_name", "")).strip()[:120]
        if not name or len(name) > 180:
            return Response({"success": False, "message": "Le nom de l’établissement est requis (180 caractères maximum)."}, status=400)
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({"success": False, "message": "L’e‑mail du responsable est requis et doit être valide : c’est son identifiant de connexion."}, status=400)
        if request.data.get("verification_confirmed") is not True:
            return Response({"success": False, "message": "Confirmez que les pièces de la structure ont été vérifiées hors application avant de créer l’accès."}, status=400)
        duplicate = Establishment.objects.filter(name__iexact=name).exclude(status="rejected").first()
        if duplicate and request.data.get("allow_duplicate") is not True:
            return Response({
                "success": False,
                "code": "duplicate_name",
                "message": f"Un établissement nommé « {duplicate.name} » existe déjà (code {duplicate.internal_code or 'sans code'}).",
            }, status=409)
        try:
            # Point de sauvegarde : un conflit de compte ne doit laisser aucune structure orpheline.
            with transaction.atomic():
                establishment = Establishment.objects.create(
                    name=name, status="active", activated_at=timezone.now(), created_by=request.user, internal_code=generate_internal_code()
                )
                access = provision_administrator(
                    establishment=establishment, assigned_by=request.user, email=email, first_name=first_name, last_name=last_name,
                    use_existing_account=request.data.get("use_existing_account") is True,
                )
        except AccountConflict as conflict:
            return account_conflict_response(conflict)
        record_event(event_type="establishment.verified", actor=request.user, actor_role="ecarnet_staff", establishment=establishment, metadata={"action": "verified", "status": "active"})
        return secret_response(access_response_data(establishment, access), status=201)


class StartupEstablishmentQueueView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        items = Establishment.objects.filter(status="pending")
        return Response({"success": True, "data": EstablishmentSerializer(items, many=True).data})

    @transaction.atomic
    def post(self, request, establishment_id):
        establishment = Establishment.objects.select_for_update().filter(id=establishment_id, status="pending").first()
        decision = request.data.get("decision")
        if not establishment or decision not in ("approve", "reject"):
            return Response({"success": False, "message": "Décision de vérification invalide."}, status=400)
        if decision == "reject":
            establishment.status = "rejected"
            establishment.save(update_fields=("status", "updated_at"))
            record_event(event_type="establishment.rejected", actor=request.user, actor_role="ecarnet_staff", establishment=establishment, metadata={"action": "rejected", "status": "rejected"})
            return Response({"success": True, "data": payload(establishment)})
        try:
            with transaction.atomic():
                establishment.status = "active"
                establishment.activated_at = timezone.now()
                establishment.save(update_fields=("status", "activated_at", "updated_at"))
                access = provision_administrator(
                    establishment=establishment, assigned_by=request.user, email=establishment.email,
                    first_name=establishment.responsible_name, use_existing_account=request.data.get("use_existing_account") is True,
                )
        except AccountConflict as conflict:
            establishment.refresh_from_db()  # le point de sauvegarde annulé laisse la structure « en attente »
            return account_conflict_response(conflict)
        record_event(event_type="establishment.approved", actor=request.user, actor_role="ecarnet_staff", establishment=establishment, metadata={"action": "approved", "status": "active"})
        return secret_response(access_response_data(establishment, access))


class StaffAdministratorInvitationView(APIView):
    """Nouvel accès pour une structure : régénère le mot de passe temporaire d'un responsable qui ne s'est pas encore connecté
    (même e‑mail par défaut), ou ouvre l'accès d'un autre responsable (remplacement, à confirmer). Un responsable qui a déjà
    choisi son mot de passe n'est jamais réinitialisé par l'équipe."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    @transaction.atomic
    def post(self, request, establishment_id):
        establishment = Establishment.objects.filter(id=establishment_id, status="active").first()
        if not establishment:
            return Response({"success": False, "message": "Établissement actif introuvable."}, status=404)
        current = EstablishmentAdministrator.objects.filter(establishment=establishment, status="active").select_related("user").first()
        last = EstablishmentAdministrator.objects.filter(establishment=establishment).select_related("user").order_by("-started_at").first()
        previous = current or last
        email = str(request.data.get("email", "") or (previous.user.email if previous else "")).strip().lower()
        first_name = str(request.data.get("first_name", "")).strip()[:120]
        last_name = str(request.data.get("last_name", "")).strip()[:120]
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({"success": False, "message": "Une adresse e‑mail valide est requise."}, status=400)
        if current and current.user.email.lower() == email:
            if not has_pending_temporary_password(current.user):
                return Response({"success": False, "code": "already_active", "message": "Ce responsable a déjà activé son accès."}, status=409)
            password, expires_at = issue_temporary_password(current.user)
            record_event(event_type="establishment.administrator.password_reissued", actor=request.user, actor_role="ecarnet_staff", establishment=establishment, metadata={"action": "reissued", "status": "temporary_password"})
            access = ProvisionedAccess(user=current.user, temporary_password=password, expires_at=expires_at, account_created=False)
            return secret_response(access_response_data(None, access))
        if current and request.data.get("confirm_replace") is not True:
            return Response({
                "success": False,
                "code": "administrator_exists",
                "message": "Cette structure a déjà un administrateur actif : il sera remplacé immédiatement par ce nouveau responsable.",
            }, status=409)
        try:
            with transaction.atomic():
                access = provision_administrator(
                    establishment=establishment, assigned_by=request.user, email=email, first_name=first_name, last_name=last_name,
                    use_existing_account=request.data.get("use_existing_account") is True,
                )
        except AccountConflict as conflict:
            return account_conflict_response(conflict)
        return secret_response(access_response_data(None, access))


class StaffAdministratorInvitationRevokeView(APIView):
    """Retire l'accès d'un responsable qui ne s'est pas encore connecté : son mot de passe temporaire cesse de fonctionner."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    @transaction.atomic
    def post(self, request, establishment_id):
        establishment = Establishment.objects.filter(id=establishment_id, status="active").first()
        if not establishment:
            return Response({"success": False, "message": "Établissement actif introuvable."}, status=404)
        admin = EstablishmentAdministrator.objects.select_for_update().filter(establishment=establishment, status="active").select_related("user").first()
        if not admin or not has_pending_temporary_password(admin.user):
            return Response({"success": False, "message": "Aucun accès en attente d’activation à révoquer."}, status=409)
        admin.status = "revoked"
        admin.ended_at = timezone.now()
        admin.save(update_fields=("status", "ended_at"))
        disable_temporary_password(admin.user)
        record_event(event_type="establishment.administrator.revoked", actor=request.user, actor_role="ecarnet_staff", establishment=establishment, metadata={"action": "revoked", "status": "revoked"})
        return Response({"success": True, "data": {"revoked": 1}})


class EstablishmentInvitationPreviewView(APIView):
    """Permet à la page d'activation de s'adapter (nom de la structure, compte déjà existant) sans rien modifier."""
    permission_classes = [AllowAny]
    throttle_classes = [IpScopedThrottle]
    throttle_scope = "code_redeem"

    def get(self, request):
        raw_token = str(request.query_params.get("token", ""))
        invitation = EstablishmentAdminInvitation.objects.select_related("establishment").filter(token_hash=EstablishmentAdminInvitation.digest(raw_token)).first() if raw_token else None
        if not invitation or not invitation.is_usable:
            return Response({"success": False, "message": INVITATION_INVALID_MESSAGE}, status=400)
        return Response({"success": True, "data": {
            "establishment_name": invitation.establishment.name,
            "email_hint": mask_email(invitation.email),
            "account_exists": User.objects.filter(email__iexact=invitation.email).exists(),
            "needs_names": not (invitation.first_name and invitation.last_name),
        }})


class EstablishmentInvitationAcceptView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [IpScopedThrottle]
    throttle_scope = "code_redeem"

    @transaction.atomic
    def post(self, request):
        raw_token = str(request.data.get("token", ""))
        if not raw_token:
            return Response({"success": False, "message": "Le lien d’invitation est requis."}, status=400)
        invitation = EstablishmentAdminInvitation.objects.select_for_update().select_related("establishment").filter(token_hash=EstablishmentAdminInvitation.digest(raw_token)).first()
        if not invitation or not invitation.is_usable:
            return Response({"success": False, "message": INVITATION_INVALID_MESSAGE}, status=400)
        matches = list(User.objects.filter(email__iexact=invitation.email)[:2])
        if len(matches) > 1:
            return Response({"success": False, "message": "Impossible d’activer cette invitation."}, status=409)
        existing = matches[0] if matches else None
        if existing:
            # Un lien d'invitation ne doit jamais permettre de reprendre la main sur un compte existant (mot de passe
            # écrasé, identité modifiée) : la personne doit d'abord prouver qu'elle est ce compte en s'y connectant.
            if not (request.user.is_authenticated and request.user.pk == existing.pk):
                return Response({
                    "success": False,
                    "code": "account_exists",
                    "message": "Un compte Mon E‑Carnet existe déjà avec cette adresse. Connectez‑vous avec ce compte, puis rouvrez ce lien d’invitation.",
                }, status=409)
            user = existing
        else:
            password = str(request.data.get("password", ""))
            first_name = str(request.data.get("first_name", "") or invitation.first_name).strip()[:120]
            last_name = str(request.data.get("last_name", "") or invitation.last_name).strip()[:120]
            if not password:
                return Response({"success": False, "message": "Le mot de passe est requis."}, status=400)
            if not first_name or not last_name:
                return Response({"success": False, "message": "Le prénom et le nom sont requis."}, status=400)
            candidate = User(username=invitation.email, email=invitation.email, first_name=first_name, last_name=last_name)
            try:
                validate_password(password, user=candidate)
            except DjangoValidationError as exc:
                return Response({"success": False, "message": " ".join(exc.messages)}, status=400)
            user = User.objects.create_user(username=invitation.email, email=invitation.email, password=password, first_name=first_name, last_name=last_name)
        establishment = invitation.establishment
        EstablishmentAdministrator.objects.filter(establishment=establishment, status="active").update(status="ended", ended_at=timezone.now())
        EstablishmentAdministrator.objects.create(establishment=establishment, user=user, assigned_by=invitation.created_by, status="active")
        establishment.responsible_name = f"{user.first_name} {user.last_name}".strip()
        establishment.save(update_fields=("responsible_name", "updated_at"))
        context, _ = AccountContext.objects.get_or_create(user=user, role="establishment")
        context.is_active = True
        # L'onboarding de l'établissement est la fiche à compléter : il n'est « terminé » qu'une fois la fiche renseignée.
        context.onboarding_completed = establishment.is_profile_complete
        context.save(update_fields=("is_active", "onboarding_completed", "updated_at"))
        invitation.consumed_at = timezone.now()
        invitation.consumed_by = user
        invitation.save(update_fields=("consumed_at", "consumed_by"))
        record_event(event_type="establishment.invitation.consumed", actor=user, actor_role="establishment_administrator", establishment=establishment, metadata={"action": "consumed", "status": "active", "invitation_id": str(invitation.id)})
        return Response({"success": True, "data": {
            "establishment_id": str(establishment.id),
            "email": user.email,
            "account_created": existing is None,
            "profile_required": not establishment.is_profile_complete,
        }})


class EstablishmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, establishment_id):
        if active_administrator(request.user, establishment_id) or Establishment.objects.filter(id=establishment_id, memberships__professional__user=request.user).exists():
            establishment = Establishment.objects.get(id=establishment_id)
            return Response({"success": True, "data": payload(establishment)})
        return Response({"success": False, "message": "Établissement indisponible dans votre contexte."}, status=404)


def store_logo(establishment, data_url):
    """Enregistre (ou retire, si vide) le logo. Production : Cloudinary. Développement et tests : image conservée en base."""
    if not data_url:
        establishment.logo_url = ""
        establishment.logo_data = ""
        return
    if CLOUDINARY_CONFIGURED:
        image = base64.b64decode(data_url.split(",", 1)[1], validate=True)
        result = cloudinary_upload(BytesIO(image), folder="establishments", public_id=f"{establishment.id}/logo", resource_type="image", delivery_type="upload")
        establishment.logo_url = result["secure_url"]
        establishment.logo_data = ""
    elif settings.DEBUG or getattr(settings, "RUNNING_TESTS", False):
        establishment.logo_url = ""
        establishment.logo_data = data_url
    else:
        raise ValidationError({"logo": "Le stockage des images n’est pas configuré sur ce serveur."})


class EstablishmentProfileView(APIView):
    """Fiche de l'établissement, complétée par son administrateur (onboarding) et modifiable ensuite.

    Modifiables : nom (pré‑rempli ; tout renommage est tracé — ancien nom, date, audit — et visible de l'équipe), type, ville,
    adresse / BP (facultative), téléphone, logo. Verrouillés : le responsable (déduit du compte) et l'e‑mail de contact, qui est
    toujours l'e‑mail du compte avec lequel l'équipe a ouvert l'accès."""
    permission_classes = [IsAuthenticated]
    LOCKED_FIELDS = ("responsible_name",)

    @staticmethod
    def body(establishment, user=None):
        missing = [field for field in PROFILE_FIELDS if not getattr(establishment, field)]
        data = {**payload(establishment), "required_fields": list(PROFILE_FIELDS), "locked_fields": [*EstablishmentProfileView.LOCKED_FIELDS, "email"], "missing_fields": missing, "profile_complete": not missing}
        if not data["email"] and user is not None:
            data["email"] = user.email  # affiché verrouillé : c'est l'e‑mail du compte, enregistré à la première sauvegarde
        return data

    def get(self, request, establishment_id):
        admin = active_administrator(request.user, establishment_id)
        if not admin:
            return Response({"success": False, "message": "Vous n’êtes pas administrateur de cet établissement actif."}, status=403)
        return Response({"success": True, "data": self.body(admin.establishment, request.user)})

    @transaction.atomic
    def patch(self, request, establishment_id):
        admin = active_administrator(request.user, establishment_id)
        if not admin:
            return Response({"success": False, "message": "Vous n’êtes pas administrateur de cet établissement actif."}, status=403)
        establishment = Establishment.objects.select_for_update().get(pk=admin.establishment_id)
        for field in self.LOCKED_FIELDS:
            if field in request.data and str(request.data[field]).strip() != getattr(establishment, field):
                return Response({"success": False, "message": "Le responsable est déduit du compte qui a ouvert l’accès : écrivez à l’équipe Mon E‑Carnet pour le modifier."}, status=400)
        previous_name = establishment.name
        serializer = EstablishmentProfileSerializer(establishment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        logo = serializer.validated_data.get("logo")  # None = non envoyé ; "" = retirer
        establishment = serializer.save()
        renamed = establishment.name != previous_name
        if renamed:
            establishment.original_name = establishment.original_name or previous_name
            establishment.name_updated_at = timezone.now()
        # E‑mail de contact = e‑mail du compte du responsable (verrouillé) : jamais saisi, jamais pris dans la requête.
        establishment.email = request.user.email
        if logo is not None:
            store_logo(establishment, logo)
        establishment.save()
        first_completion = establishment.is_profile_complete and establishment.profile_completed_at is None
        if first_completion:
            establishment.profile_completed_at = timezone.now()
            establishment.save(update_fields=("profile_completed_at", "updated_at"))
        if establishment.is_profile_complete:
            AccountContext.objects.filter(user=request.user, role="establishment").update(onboarding_completed=True)
        action = "completed" if first_completion else "updated"
        record_event(event_type=f"establishment.profile.{action}", actor=request.user, actor_role="establishment_administrator", establishment=establishment, metadata={"action": action, "status": establishment.status})
        if renamed:
            record_event(event_type="establishment.name.changed", actor=request.user, actor_role="establishment_administrator", establishment=establishment, metadata={"action": "renamed", "status": establishment.status})
        if logo is not None:
            record_event(event_type="establishment.logo.updated", actor=request.user, actor_role="establishment_administrator", establishment=establishment, metadata={"action": "removed" if not logo else "updated", "status": establishment.status})
        return Response({"success": True, "data": self.body(establishment, request.user)})


class EstablishmentLogoView(APIView):
    """Logo conservé en base (développement et tests uniquement). En production, `logo` est l'URL Cloudinary et cette route n'est pas utilisée."""
    permission_classes = [IsAuthenticated]

    def get(self, request, establishment_id):
        establishment = Establishment.objects.filter(pk=establishment_id).only("logo_data").first()
        if not establishment or not establishment.logo_data:
            raise Http404
        try:
            image = base64.b64decode(establishment.logo_data.split(",", 1)[1], validate=True)
        except (IndexError, ValueError, binascii.Error):
            raise Http404
        response = HttpResponse(image, content_type="image/webp")
        response["Cache-Control"] = "private, max-age=3600"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class EstablishmentPrescriptionTemplateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, establishment_id):
        admin = active_administrator(request.user, establishment_id)
        if not admin:
            return Response({"success": False, "message": "Vous n’êtes pas administrateur de cet établissement actif."}, status=403)
        template, _ = PrescriptionTemplate.objects.get_or_create(establishment=admin.establishment)
        return Response({"success": True, "data": PrescriptionTemplateSerializer(template).data})

    @transaction.atomic
    def patch(self, request, establishment_id):
        admin = active_administrator(request.user, establishment_id)
        if not admin:
            return Response({"success": False, "message": "Vous n’êtes pas administrateur de cet établissement actif."}, status=403)
        template, _ = PrescriptionTemplate.objects.select_for_update().get_or_create(establishment=admin.establishment)
        data = request.data.copy()
        logo = request.FILES.get("logo")
        if logo:
            if logo.content_type not in {"image/png", "image/jpeg", "image/webp", "image/svg+xml"} or logo.size > 5 * 1024 * 1024:
                raise ValidationError({"logo": "Le logo doit être une image PNG, JPG, WebP ou SVG de 5 Mo maximum."})
            if not CLOUDINARY_CONFIGURED:
                raise ValidationError({"logo": "Cloudinary n’est pas configuré pour recevoir le logo."})
            result = cloudinary_upload(logo, folder="establishments", public_id=f"{admin.establishment_id}/prescription-logo", resource_type="image", delivery_type="upload")
            data["logo_url"] = result["secure_url"]
        serializer = PrescriptionTemplateSerializer(template, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        template = serializer.save()
        record_event(event_type="establishment.prescription_template.updated", actor=request.user, actor_role="establishment_administrator", establishment=admin.establishment, metadata={"action": "updated", "resource_type": "prescription_template"})
        return Response({"success": True, "data": PrescriptionTemplateSerializer(template).data})


class EstablishmentJoinCodeCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, establishment_id):
        admin = active_administrator(request.user, establishment_id)
        if not admin:
            return Response({"success": False, "message": "Vous n’êtes pas administrateur de cet établissement actif."}, status=403)
        if not admin.establishment.is_profile_complete:
            return Response({"success": False, "code": "profile_incomplete", "message": "Complétez d’abord la fiche de votre établissement avant de créer un code médecin."}, status=409)
        raw_code = f"ECM-{secrets.token_urlsafe(9).upper()}"
        join_code = EstablishmentJoinCode.objects.create(
            establishment=admin.establishment,
            code_hash=EstablishmentJoinCode.digest(raw_code),
            expires_at=timezone.now() + timedelta(hours=48),
            created_by=request.user,
        )
        record_event(event_type="establishment.join_code.created", actor=request.user, actor_role="establishment_administrator", establishment=admin.establishment, metadata={"action": "created", "status": "active", "join_code_id": str(join_code.id)})
        return Response({"success": True, "data": {"code": raw_code, "expires_at": join_code.expires_at, "join_code_id": str(join_code.id)}}, status=201)


class EstablishmentMembershipListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, establishment_id):
        admin = active_administrator(request.user, establishment_id)
        if not admin:
            return Response({"success": False, "message": "Vous n’êtes pas administrateur de cet établissement actif."}, status=403)
        items = EstablishmentMembership.objects.filter(establishment=admin.establishment).select_related("professional__user")
        data = MembershipSerializer(items, many=True).data
        for item, membership in zip(data, items):
            item["professional_name"] = f"{membership.professional.user.first_name} {membership.professional.user.last_name}".strip() or membership.professional.professional_title
            item["professional_email"] = membership.professional.user.email
        return Response({"success": True, "data": data})


class EstablishmentJoinCodeRedeemView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "code_redeem"

    @transaction.atomic
    def post(self, request):
        profile = getattr(request.user, "professional_profile", None)
        raw_code = str(request.data.get("code", "")).strip()
        if not profile or not raw_code:
            return Response({"success": False, "message": "Compte professionnel et code médecin requis."}, status=400)
        if request.data.get("agreement_accepted") is not True or request.data.get("agreement_version") != MEMBERSHIP_AGREEMENT_VERSION:
            return Response({"success": False, "message": "Veuillez accepter les conditions de rattachement à jour avant de valider le code."}, status=400)
        join_code = EstablishmentJoinCode.objects.select_for_update().select_related("establishment").filter(code_hash=EstablishmentJoinCode.digest(raw_code)).first()
        if not join_code or not join_code.is_usable or join_code.establishment.status != "active":
            return Response({"success": False, "message": "Ce code est invalide, expiré, révoqué ou déjà utilisé."}, status=400)
        membership, created = EstablishmentMembership.objects.get_or_create(establishment=join_code.establishment, professional=profile)
        if not created and membership.status in ("pending", "active"):
            return Response({"success": False, "message": "Une demande existe déjà pour ce médecin et cet établissement."}, status=409)
        membership.status = "pending"
        membership.requested_at = timezone.now()
        membership.reviewed_at = None
        membership.left_at = None
        membership.agreement_version = MEMBERSHIP_AGREEMENT_VERSION
        membership.agreement_accepted_at = timezone.now()
        membership.agreement_accepted_by = request.user
        membership.save(update_fields=("status", "requested_at", "reviewed_at", "left_at", "agreement_version", "agreement_accepted_at", "agreement_accepted_by"))
        join_code.consumed_at = timezone.now()
        join_code.save(update_fields=("consumed_at",))
        record_event(event_type="establishment.join_code.consumed", actor=request.user, actor_role="professional", establishment=join_code.establishment, metadata={"action": "consumed", "status": "pending", "join_code_id": str(join_code.id), "membership_id": str(membership.id)})
        record_event(event_type="membership.requested", actor=request.user, actor_role="professional", establishment=join_code.establishment, metadata={"action": "requested", "status": "pending", "membership_id": str(membership.id), "agreement_version": membership.agreement_version, "agreement_accepted_at": membership.agreement_accepted_at.isoformat()})
        return Response({"success": True, "data": MembershipSerializer(membership).data}, status=201 if created else 200)


class MembershipRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, establishment_id):
        return Response({"success": False, "message": "Cette route utilise un ancien code permanent. Saisissez le code médecin temporaire dans /join-codes/redeem/."}, status=410)


class MembershipDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, establishment_id, membership_id):
        admin = active_administrator(request.user, establishment_id)
        establishment = admin.establishment if admin else None
        membership = EstablishmentMembership.objects.filter(id=membership_id, establishment=establishment).first()
        decision = request.data.get("decision")
        if not establishment or not membership or decision not in ("approve", "refuse"):
            return Response({"success": False, "message": "Décision de rattachement invalide."}, status=400)
        if decision == "approve" and (not membership.agreement_accepted_at or not membership.agreement_version):
            return Response({"success": False, "message": "Aucune acceptation des conditions de rattachement enregistrée."}, status=409)
        membership.status = "active" if decision == "approve" else "refused"
        membership.reviewed_at = timezone.now()
        membership.save(update_fields=("status", "reviewed_at"))
        record_event(event_type=f"membership.{decision}", actor=request.user, actor_role="establishment_administrator", establishment=establishment, metadata={"action": decision, "status": membership.status, "membership_id": str(membership.id)})
        return Response({"success": True, "data": MembershipSerializer(membership).data})


class MembershipLeaveView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, establishment_id):
        profile = getattr(request.user, "professional_profile", None)
        membership = EstablishmentMembership.objects.filter(establishment_id=establishment_id, professional=profile, status="active").select_related("establishment").first() if profile else None
        if not membership:
            return Response({"success": False, "message": "Aucun rattachement actif à quitter."}, status=404)
        membership.status = "terminated"
        membership.left_at = timezone.now()
        membership.reviewed_at = membership.left_at
        membership.save(update_fields=("status", "left_at", "reviewed_at"))
        if profile.active_establishment_id == membership.establishment_id:
            profile.active_establishment = None
            profile.save(update_fields=("active_establishment", "updated_at"))
        record_event(event_type="membership.terminated_by_professional", actor=request.user, actor_role="professional", establishment=membership.establishment, metadata={"action": "terminated", "membership_id": str(membership.id), "reason": "professional_initiated"})
        return Response({"success": True, "data": MembershipSerializer(membership).data})


class MembershipTerminateByEstablishmentView(APIView):
    permission_classes = [IsAuthenticated]
    @transaction.atomic
    def post(self, request, establishment_id, membership_id):
        admin = active_administrator(request.user, establishment_id)
        membership = EstablishmentMembership.objects.select_for_update().filter(
            id=membership_id, establishment_id=establishment_id, status="active"
        ).select_related("professional__user").first() if admin else None
        if not membership:
            return Response({"success": False, "message": "Rattachement actif introuvable ou action non autorisée."}, status=404)
        membership.status = "terminated"
        membership.left_at = timezone.now()
        membership.reviewed_at = timezone.now()
        membership.save(update_fields=("status", "left_at", "reviewed_at"))
        profile = membership.professional
        if profile.active_establishment_id == membership.establishment_id:
            profile.active_establishment = None
            profile.save(update_fields=("active_establishment", "updated_at"))
        record_event(event_type="membership.terminated_by_establishment", actor=request.user, actor_role="establishment_administrator", establishment=membership.establishment, metadata={"action": "terminated", "membership_id": str(membership.id), "reason": "establishment_initiated"})
        return Response({"success": True, "data": MembershipSerializer(membership).data})


class SetActiveEstablishmentView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        profile = getattr(request.user, "professional_profile", None)
        membership = EstablishmentMembership.objects.filter(professional=profile, establishment_id=request.data.get("establishment_id"), status="active", establishment__status="active").select_related("establishment").first() if profile else None
        if not membership:
            return Response({"success": False, "message": "Vous n’êtes pas rattaché à cet établissement actif."}, status=403)
        profile.active_establishment = membership.establishment
        profile.save(update_fields=("active_establishment", "updated_at"))
        record_event(event_type="establishment.selected", actor=request.user, actor_role="professional", establishment=membership.establishment, metadata={"action": "selected", "status": membership.status})
        return Response({"success": True, "data": {"active_establishment": str(membership.establishment_id)}})

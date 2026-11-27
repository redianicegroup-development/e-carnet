import base64
import binascii
from io import BytesIO
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.contrib.auth import authenticate, get_user_model, login, logout, update_session_auth_hash
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse, Http404
from django.db import transaction
from .recovery import GENERIC_FAILURE, attempt_status, question_for, reset_password_with_answer, validate_new_password, verify_recovery_answer
from .throttles import IpScopedThrottle, LoginEmailThrottle, RecoveryEmailThrottle
from .temporary_password import TEMPORARY_PASSWORD_TTL, mark_temporary_login, temporary_login_is_fresh, temporary_password_expired
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.audit.services import record_event
from apps.cloudinary_storage import CLOUDINARY_CONFIGURED, upload as cloudinary_upload
from apps.patients.models import PatientProfile
from .auth_serializers import AccountIdentitySerializer, AccountSerializer, LinkedIdentitySerializer, LoginSerializer, PasswordChangeSerializer, PatientOnboardingSerializer, RecoveryAnswerSerializer, RecoveryQuestionSerializer, RecoveryResetSerializer, RecoverySetupSerializer, RegisterSerializer
from .account_state import block_state, lift_expired_suspension, record_login
from .models import AccountContext, AccountProfile, AuthIdentity
from .visitor_tracking import track_auth_response


def account_payload(user):
    return AccountSerializer(user).data


class RegisterView(APIView):
    throttle_classes = [IpScopedThrottle]
    throttle_scope = "auth_register"
    permission_classes = [AllowAny]
    @transaction.atomic
    def post(self, request):
        serializer = RegisterSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        user = serializer.save(); login(request, user)
        response = Response({"success": True, "data": account_payload(user)}, status=status.HTTP_201_CREATED)
        return track_auth_response(request, response, "registration")


class LoginView(APIView):
    throttle_classes = [IpScopedThrottle, LoginEmailThrottle]
    throttle_scope = "auth_login"
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = LoginSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        matches = get_user_model().objects.filter(email__iexact=serializer.validated_data["email"])
        candidate = matches.first() if matches.count() == 1 else None
        # Une suspension arrivée à échéance se lève ici, juste avant la vérification du mot de passe.
        if candidate is not None and not candidate.is_active:
            lift_expired_suspension(candidate)
        user = authenticate(request, username=candidate.get_username(), password=serializer.validated_data["password"]) if candidate else None
        # Compte fermé (suspendu par la personne ou désactivé par l'équipe) : Django refuse la connexion. Si la personne vient de saisir son bon
        # mot de passe, on lui dit POURQUOI ; sinon la réponse reste le simple « incorrect » (rien n'est révélé à qui ne le connaît pas).
        if candidate is not None and user is None and not candidate.is_active and candidate.check_password(serializer.validated_data["password"]):
            state = block_state(candidate)
            record_login(candidate, "blocked")
            response = Response({"success": False, "code": state["code"], "message": state["message"]}, status=403)
            return track_auth_response(request, response, "login_failure")
        # Mot de passe temporaire périmé : la personne vient de le saisir correctement, on peut donc lui dire POURQUOI la connexion est refusée
        # (cela ne révèle rien à quelqu'un qui ne le connaît pas : un mauvais mot de passe reste un simple « incorrect »).
        if user and temporary_password_expired(getattr(user, "account_profile", None)):
            response = Response({
                "success": False, "code": "temporary_password_expired",
                "message": f"Ce mot de passe temporaire a expiré (il est valable {TEMPORARY_PASSWORD_TTL.days} jours). Demandez-en un nouveau à la personne qui vous a ouvert l’accès : l’équipe Mon E‑Carnet ou votre établissement.",
            }, status=400)
            record_login(user, "failure")
            return track_auth_response(request, response, "login_failure")
        if not user:
            record_login(candidate, "failure")
            response = Response({"success": False, "code": "invalid_credentials", "message": "Email ou mot de passe incorrect. Avec un mot de passe temporaire, recopiez-le exactement : tirets, majuscules et minuscules compris."}, status=400)
            return track_auth_response(request, response, "login_failure")
        login(request, user)
        record_login(user, "success")
        mark_temporary_login(request, getattr(user, "account_profile", None))
        response = Response({"success": True, "data": account_payload(user)})
        return track_auth_response(request, response, "login_success")


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request): logout(request); return Response({"success": True, "data": None})


class LogoutAllView(APIView):
    """SEC-04 : ferme toutes les sessions du compte (autres appareils compris), puis celle de cet appareil."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .session_control import end_all_sessions
        closed = end_all_sessions(request.user)
        logout(request)
        return Response({"success": True, "data": {"closed": closed}})


class CurrentAccountView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request): return Response({"success": True, "data": account_payload(request.user)})


class PasswordChangeView(APIView):
    """Changement de mot de passe du compte connecté. Il est obligatoire à la première connexion avec un mot de passe
    temporaire (le middleware ferme tout le reste de l'API) : il remplace alors le mot de passe temporaire, qui ne sert donc
    qu'une fois, et lève l'obligation. Si le compte n'a pas encore de nom, il est demandé ici."""
    throttle_classes = [IpScopedThrottle]
    throttle_scope = "auth_login"
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = request.user
        if not user.has_usable_password():
            return Response({"success": False, "message": "Ce compte n’a pas de mot de passe à remplacer."}, status=409)
        profile, _ = AccountProfile.objects.get_or_create(user=user)
        if data["current_password"]:
            if not user.check_password(data["current_password"]):
                return Response({"success": False, "code": "current_password_incorrect", "message": "Le mot de passe actuel est incorrect."}, status=400)
        elif not temporary_login_is_fresh(request, profile):
            # Seule une session ouverte à l'instant avec le mot de passe temporaire est dispensée de le retaper.
            return Response({"success": False, "code": "current_password_required", "message": "Pour votre sécurité, saisissez aussi le mot de passe actuel (le mot de passe temporaire reçu)."}, status=400)
        if user.check_password(data["new_password"]):
            return Response({"success": False, "message": "Choisissez un mot de passe différent du mot de passe temporaire." if profile.must_change_password else "Choisissez un mot de passe différent de l’actuel."}, status=400)
        try:
            validate_password(data["new_password"], user=user)
        except DjangoValidationError as exc:
            return Response({"success": False, "message": " ".join(exc.messages)}, status=400)
        first_name = data.get("first_name", "").strip() or user.first_name
        last_name = data.get("last_name", "").strip() or user.last_name
        if not first_name or not last_name:
            return Response({"success": False, "code": "names_required", "message": "Renseignez votre prénom et votre nom."}, status=400)
        user.set_password(data["new_password"])
        user.first_name, user.last_name = first_name, last_name
        user.save(update_fields=("password", "first_name", "last_name"))
        was_temporary = profile.must_change_password
        profile.must_change_password = False
        profile.temporary_password_expires_at = None
        profile.save(update_fields=("must_change_password", "temporary_password_expires_at", "updated_at"))
        if was_temporary:
            # Le responsable d'un établissement porte le nom qu'il vient de donner (la fiche le verrouille ensuite).
            from apps.establishments.models import Establishment

            for establishment in Establishment.objects.filter(administrator_history__user=user, administrator_history__status="active", responsible_name=""):
                establishment.responsible_name = f"{first_name} {last_name}".strip()
                establishment.save(update_fields=("responsible_name", "updated_at"))
        update_session_auth_hash(request, user)  # la session courante survit, les autres appareils sont déconnectés
        request.session.pop("temporary_login_at", None)
        record_event(event_type="account.password_changed", actor=user, actor_role="account", metadata={"action": "password_changed", "status": "first_login" if was_temporary else "voluntary"})
        return Response({"success": True, "data": account_payload(user)})


class AccountAvatarView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        profile = getattr(request.user, "account_profile", None)
        if not profile or not profile.avatar_data:
            raise Http404
        try:
            image = base64.b64decode(profile.avatar_data.split(",", 1)[1], validate=True)
        except (IndexError, ValueError, binascii.Error):
            raise Http404
        response = HttpResponse(image, content_type="image/webp")
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class IdentityProfileView(APIView):
    permission_classes = [IsAuthenticated]
    @transaction.atomic
    def patch(self, request):
        serializer = AccountIdentitySerializer(data=request.data); serializer.is_valid(raise_exception=True)
        user = request.user
        for field in ("first_name", "last_name"):
            if field in serializer.validated_data: setattr(user, field, serializer.validated_data[field])
        if any(field in serializer.validated_data for field in ("first_name", "last_name")): user.save(update_fields=("first_name", "last_name"))
        profile, _ = AccountProfile.objects.get_or_create(user=user)
        profile_fields = []
        if "avatar_url" in serializer.validated_data:
            profile.avatar_url = serializer.validated_data["avatar_url"]
            profile.avatar_data = ""
            profile_fields.extend(("avatar_url", "avatar_data"))
        if "avatar_data" in serializer.validated_data:
            profile.avatar_data = serializer.validated_data["avatar_data"]
            if profile.avatar_data:
                if CLOUDINARY_CONFIGURED:
                    image = base64.b64decode(profile.avatar_data.split(",", 1)[1], validate=True)
                    result = cloudinary_upload(BytesIO(image), folder="avatars", public_id=str(user.id), resource_type="image", delivery_type="upload")
                    profile.avatar_url = result["secure_url"]
                    profile.avatar_data = ""
                elif not (settings.DEBUG or getattr(settings, "RUNNING_TESTS", False)):
                    raise ImproperlyConfigured("Cloudinary est requis pour enregistrer une photo de profil.")
                else:
                    profile.avatar_url = ""
                profile_fields.append("avatar_url")
            profile_fields.append("avatar_data")
        if profile_fields:
            profile.save(update_fields=tuple(dict.fromkeys((*profile_fields, "updated_at"))))
        return Response({"success": True, "data": account_payload(user)})


class OAuthIdentityListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request): return Response({"success": True, "data": LinkedIdentitySerializer(request.user.auth_identities.all(), many=True).data})


class OAuthIdentityUnlinkView(APIView):
    permission_classes = [IsAuthenticated]
    @transaction.atomic
    def delete(self, request, provider):
        identity = AuthIdentity.objects.filter(user=request.user, provider=provider).first()
        if not identity: return Response({"success": False, "message": "Cette méthode n’est pas liée à votre compte."}, status=404)
        if not request.user.has_usable_password() and request.user.auth_identities.count() <= 1:
            return Response({"success": False, "message": "Ajoutez d’abord un mot de passe avant de retirer votre dernière méthode de connexion."}, status=409)
        identity.delete()
        record_event(event_type="oauth.identity_unlinked", actor=request.user, actor_role="account", metadata={"action": "unlinked", "provider": provider})
        return Response({"success": True, "data": None})


class PatientOnboardingView(APIView):
    permission_classes = [IsAuthenticated]
    @transaction.atomic
    def patch(self, request):
        context = AccountContext.objects.filter(user=request.user, role="patient").first()
        if not context: return Response({"success": False, "message": "Le contexte patient n’est pas disponible."}, status=409)
        profile, _ = PatientProfile.objects.get_or_create(user=request.user)
        serializer = PatientOnboardingSerializer(profile, data=request.data, partial=True); serializer.is_valid(raise_exception=True); serializer.save()
        context.is_active = True; context.onboarding_completed = True; context.save(update_fields=("is_active", "onboarding_completed", "updated_at"))
        return Response({"success": True, "data": account_payload(request.user)})


class RecoverySetupView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request):
        serializer = RecoverySetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile, _ = AccountProfile.objects.get_or_create(user=request.user)
        profile.recovery_question = serializer.validated_data["question"]
        profile.recovery_answer_hash = make_password(serializer.validated_data["answer"].casefold())
        profile.save(update_fields=("recovery_question", "recovery_answer_hash", "updated_at"))
        record_event(
            event_type="account.recovery_method_configured",
            actor=request.user,
            actor_role="account",
            metadata={"action": "configured"},
        )
        return Response({"success": True, "data": {"configured": True}})


class RecoveryQuestionView(APIView):
    """Étape 1 de « Récupérer mon compte » : la question à laquelle répondre.

    Réponse identique pour tout le monde (voir identity/recovery.py) : adresse inconnue, compte sans question ou compte exclu
    reçoivent une question « leurre » stable. On ne peut donc pas s'en servir pour savoir si une adresse a un compte."""
    throttle_classes = [IpScopedThrottle, RecoveryEmailThrottle]
    throttle_scope = "auth_recovery"
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RecoveryQuestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({"success": True, "data": {"question": question_for(serializer.validated_data["email"])}})


class RecoveryAnswerView(APIView):
    """Étape 2 : vérifier la réponse avant de révéler les champs de nouveau mot de passe."""
    throttle_classes = [IpScopedThrottle, RecoveryEmailThrottle]
    throttle_scope = "auth_recovery"
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = RecoveryAnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if not verify_recovery_answer(email=data["email"], answer=data["answer"]):
            # Le message reste générique ; `code`, `attempts_remaining` et `locked_until` ont la même forme pour tout le monde
            # (voir recovery.attempt_status) : l'écran peut être clair sans révéler si l'adresse a un compte.
            return Response({"success": False, "message": GENERIC_FAILURE, **attempt_status(data["email"])}, status=400)
        return Response({"success": True, "data": {"verified": True}})

class RecoveryResetView(APIView):
    """Étape 2 : la bonne réponse permet de choisir un nouveau mot de passe.

    Toute autre issue (adresse inconnue, compte verrouillé, mauvaise réponse…) renvoie le même message : l'appelant n'apprend rien.
    Le titulaire est alerté par e-mail, ses autres sessions sont fermées ; l'OTP s'ajoutera dans recovery.verify_recovery_proof."""
    throttle_classes = [IpScopedThrottle, RecoveryEmailThrottle]
    throttle_scope = "auth_recovery"
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RecoveryResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        validate_new_password(data["new_password"])
        if not reset_password_with_answer(email=data["email"], answer=data["answer"], new_password=data["new_password"]):
            return Response({"success": False, "message": GENERIC_FAILURE, **attempt_status(data["email"])}, status=400)
        return Response({"success": True, "data": {"reset": True}})


class ContextSelectView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        role = request.data.get("role")
        if role not in ("patient", "professional"): return Response({"success": False, "message": "Choisissez Patient ou Professionnel."}, status=400)
        context, _ = AccountContext.objects.get_or_create(user=request.user, role=role)
        AccountContext.objects.filter(user=request.user).update(is_active=False); context.is_active = True; context.save(update_fields=("is_active", "updated_at"))
        return Response({"success": True, "data": account_payload(request.user)})

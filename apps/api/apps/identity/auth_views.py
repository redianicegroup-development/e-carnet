import base64
import binascii
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.hashers import make_password
from django.http import HttpResponse, Http404
from django.db import transaction
from .throttles import IpScopedThrottle, LoginEmailThrottle
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.audit.services import record_event
from apps.patients.models import PatientProfile
from .auth_serializers import AccountIdentitySerializer, AccountSerializer, LinkedIdentitySerializer, LoginSerializer, PatientOnboardingSerializer, RecoverySetupSerializer, RegisterSerializer
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
        user = matches.first() if matches.count() == 1 else None
        user = authenticate(request, username=user.get_username(), password=serializer.validated_data["password"]) if user else None
        if not user:
            response = Response({"success": False, "message": "Email ou mot de passe incorrect."}, status=400)
            return track_auth_response(request, response, "login_failure")
        login(request, user)
        response = Response({"success": True, "data": account_payload(user)})
        return track_auth_response(request, response, "login_success")


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request): logout(request); return Response({"success": True, "data": None})


class CurrentAccountView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request): return Response({"success": True, "data": account_payload(request.user)})


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


class ContextSelectView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        role = request.data.get("role")
        if role not in ("patient", "professional"): return Response({"success": False, "message": "Choisissez Patient ou Professionnel."}, status=400)
        context, _ = AccountContext.objects.get_or_create(user=request.user, role=role)
        AccountContext.objects.filter(user=request.user).update(is_active=False); context.is_active = True; context.save(update_fields=("is_active", "updated_at"))
        return Response({"success": True, "data": account_payload(request.user)})

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import transaction
from .throttles import IpScopedThrottle, LoginEmailThrottle
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.audit.services import record_event
from apps.patients.models import PatientProfile
from .auth_serializers import AccountIdentitySerializer, AccountSerializer, LinkedIdentitySerializer, LoginSerializer, PatientOnboardingSerializer, RegisterSerializer
from .models import AccountContext, AccountProfile, AuthIdentity


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
        return Response({"success": True, "data": account_payload(user)}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    throttle_classes = [IpScopedThrottle, LoginEmailThrottle]
    throttle_scope = "auth_login"
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = LoginSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        matches = get_user_model().objects.filter(email__iexact=serializer.validated_data["email"])
        user = matches.first() if matches.count() == 1 else None
        user = authenticate(request, username=user.get_username(), password=serializer.validated_data["password"]) if user else None
        if not user: return Response({"success": False, "message": "Email ou mot de passe incorrect."}, status=400)
        login(request, user); return Response({"success": True, "data": account_payload(user)})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request): logout(request); return Response({"success": True, "data": None})


class CurrentAccountView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request): return Response({"success": True, "data": account_payload(request.user)})


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
        if "avatar_url" in serializer.validated_data:
            profile.avatar_url = serializer.validated_data["avatar_url"]; profile.save(update_fields=("avatar_url", "updated_at"))
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


class ContextSelectView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        role = request.data.get("role")
        if role not in ("patient", "professional"): return Response({"success": False, "message": "Choisissez Patient ou Professionnel."}, status=400)
        context, _ = AccountContext.objects.get_or_create(user=request.user, role=role)
        AccountContext.objects.filter(user=request.user).update(is_active=False); context.is_active = True; context.save(update_fields=("is_active", "updated_at"))
        return Response({"success": True, "data": account_payload(request.user)})

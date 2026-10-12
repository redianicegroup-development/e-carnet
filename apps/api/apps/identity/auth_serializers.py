import base64
import binascii
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers
from apps.patients.models import PatientProfile
from .models import AccountContext, AccountProfile, AuthIdentity

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=12, write_only=True)
    first_name = serializers.CharField(max_length=80)
    last_name = serializers.CharField(max_length=80)
    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Inscription impossible avec ces informations. Vérifiez-les ou connectez-vous si vous avez déjà un compte.")  # message générique : pas de confirmation qu'une adresse existe
        return value.lower()
    @transaction.atomic
    def create(self, validated_data):
        email = validated_data["email"]
        user = User.objects.create_user(username=email, email=email, password=validated_data["password"], first_name=validated_data["first_name"], last_name=validated_data["last_name"])
        AccountProfile.objects.create(user=user)
        AccountContext.objects.create(user=user, role="patient", is_active=True)
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        return value.strip().casefold()


class AccountSerializer(serializers.Serializer):
    id = serializers.SerializerMethodField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    is_admin = serializers.SerializerMethodField()
    is_privileged = serializers.SerializerMethodField()
    date_joined = serializers.DateTimeField(read_only=True)  # sert au message d'accueil du front (« Bienvenue » pour un compte récent)
    avatar_url = serializers.SerializerMethodField()
    auth_identities = serializers.SerializerMethodField()
    contexts = serializers.SerializerMethodField()
    patient_profile = serializers.SerializerMethodField()
    def get_id(self, obj):
        profile, _ = AccountProfile.objects.get_or_create(user=obj)
        return str(profile.public_id)

    def get_is_admin(self, obj):
        return bool(obj.is_authenticated and obj.is_superuser)

    def get_is_privileged(self, obj):
        return bool(obj.is_authenticated and (obj.is_staff or obj.is_superuser))

    def get_avatar_url(self, obj):
        profile = getattr(obj, "account_profile", None)
        if not profile:
            return ""
        if profile.avatar_data:
            return f"/api/v1/identity/me/avatar/?v={int(profile.updated_at.timestamp())}"
        return profile.avatar_url

    def get_auth_identities(self, obj):
        return [{"provider": identity.provider, "display_name": identity.display_name, "avatar_url": identity.avatar_url} for identity in obj.auth_identities.all()]

    def get_contexts(self, obj):
        return [{"role": c.role, "is_active": c.is_active, "onboarding_completed": c.onboarding_completed} for c in obj.account_contexts.all()]
    def get_patient_profile(self, obj):
        profile = getattr(obj, "patient_profile", None)
        return {"completed": bool(profile), "id": str(profile.id) if profile else None}


class EmptyStringAsNullDateField(serializers.DateField):
    """Normalise une date facultative vide, comme le font les formulaires HTML."""
    def run_validation(self, data):
        return super().run_validation(None if data == "" else data)


class PatientOnboardingSerializer(serializers.ModelSerializer):
    birth_date = EmptyStringAsNullDateField(required=False, allow_null=True)
    coverage_expiry = EmptyStringAsNullDateField(required=False, allow_null=True)

    class Meta:
        model = PatientProfile
        fields = ("phone", "birth_date", "address", "coverage_provider", "coverage_number", "coverage_expiry")


class AccountIdentitySerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=80, required=False)
    last_name = serializers.CharField(max_length=80, required=False)
    avatar_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    avatar_data = serializers.CharField(max_length=350000, required=False, allow_blank=True, write_only=True)

    def validate_avatar_data(self, value):
        if not value:
            return value
        prefix = "data:image/webp;base64,"
        if not value.startswith(prefix):
            raise serializers.ValidationError("La photo doit être une image WebP valide.")
        try:
            image = base64.b64decode(value[len(prefix):], validate=True)
        except (binascii.Error, ValueError):
            raise serializers.ValidationError("La photo envoyée est invalide.")
        if len(image) > 250 * 1024 or len(image) < 12 or image[:4] != b"RIFF" or image[8:12] != b"WEBP":
            raise serializers.ValidationError("La photo doit être un WebP valide de 250 Ko maximum.")
        return value


class LinkedIdentitySerializer(serializers.ModelSerializer):
    class Meta:
        model = AuthIdentity
        fields = ("provider", "display_name", "email", "avatar_url", "created_at", "last_seen_at")
        read_only_fields = fields

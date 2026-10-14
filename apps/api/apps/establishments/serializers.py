import re

from rest_framework import serializers

from .models import Establishment, EstablishmentMembership


class EstablishmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Establishment
        fields = ("id", "name", "establishment_type", "city", "address", "phone", "email", "responsible_name", "status", "internal_code", "activated_at", "profile_completed_at", "created_at")
        read_only_fields = ("id", "status", "internal_code", "activated_at", "profile_completed_at", "created_at")


PHONE_PATTERN = re.compile(r"^\+?[0-9 .()-]{8,20}$")


class EstablishmentProfileSerializer(serializers.ModelSerializer):
    """Fiche renseignée par l'établissement lui‑même. Le nom et le responsable, vérifiés par l'équipe, ne s'y modifient pas."""

    establishment_type = serializers.CharField(max_length=100, allow_blank=False, trim_whitespace=True)
    city = serializers.CharField(max_length=120, allow_blank=False, trim_whitespace=True)
    address = serializers.CharField(max_length=240, allow_blank=False, trim_whitespace=True)
    phone = serializers.CharField(max_length=32, allow_blank=False, trim_whitespace=True)
    email = serializers.EmailField(allow_blank=False)

    class Meta:
        model = Establishment
        fields = ("establishment_type", "city", "address", "phone", "email")

    def validate_phone(self, value):
        digits = re.sub(r"\D", "", value)
        if not PHONE_PATTERN.match(value) or not 8 <= len(digits) <= 15:
            raise serializers.ValidationError("Saisissez un numéro de téléphone valide (8 à 15 chiffres).")
        return value


class MembershipSerializer(serializers.ModelSerializer):
    establishment = serializers.UUIDField(source="establishment_id", read_only=True)
    professional = serializers.UUIDField(source="professional_id", read_only=True)

    class Meta:
        model = EstablishmentMembership
        fields = ("id", "establishment", "professional", "status", "requested_at", "reviewed_at", "left_at", "agreement_version", "agreement_accepted_at")
        read_only_fields = fields

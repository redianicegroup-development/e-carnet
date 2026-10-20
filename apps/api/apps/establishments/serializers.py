import base64
import binascii
import re

from rest_framework import serializers

from .models import Establishment, EstablishmentMembership, PrescriptionTemplate


def logo_for(establishment):
    """Adresse du logo : URL Cloudinary en production ; en développement, route authentifiée qui sert l'image stockée."""
    if establishment.logo_url:
        return establishment.logo_url
    if establishment.logo_data:
        return f"/api/v1/establishments/{establishment.id}/logo/?v={int(establishment.updated_at.timestamp())}"
    return ""


class EstablishmentSerializer(serializers.ModelSerializer):
    logo = serializers.SerializerMethodField()

    def get_logo(self, obj):
        return logo_for(obj)

    class Meta:
        model = Establishment
        fields = ("id", "name", "establishment_type", "city", "address", "phone", "email", "responsible_name", "logo", "status", "internal_code", "activated_at", "profile_completed_at", "name_updated_at", "original_name", "created_at", "updated_at")
        read_only_fields = ("id", "status", "internal_code", "activated_at", "profile_completed_at", "name_updated_at", "original_name", "created_at", "updated_at")


PHONE_PATTERN = re.compile(r"^\+?[0-9 .()-]{8,20}$")


def validate_webp_data_url(value, label):
    """Même contrôle que la photo de profil : WebP, 250 Ko maximum, signature vérifiée. Vide = retirer l'image."""
    if not value:
        return value
    prefix = "data:image/webp;base64,"
    if not value.startswith(prefix):
        raise serializers.ValidationError(f"{label} doit être une image WebP valide.")
    try:
        image = base64.b64decode(value[len(prefix):], validate=True)
    except (binascii.Error, ValueError):
        raise serializers.ValidationError(f"{label} envoyé est invalide.")
    if len(image) > 250 * 1024 or len(image) < 12 or image[:4] != b"RIFF" or image[8:12] != b"WEBP":
        raise serializers.ValidationError(f"{label} doit être un WebP valide de 250 Ko maximum.")
    return value


class EstablishmentProfileSerializer(serializers.ModelSerializer):
    """Fiche renseignée par l'établissement lui‑même.

    Le nom arrive pré‑rempli et peut être modifié (le renommage est tracé, voir EstablishmentProfileView). Le responsable et
    l'e‑mail de contact (celui du compte) sont verrouillés. L'adresse / BP est facultative. `logo` est une image WebP en data URL."""

    name = serializers.CharField(max_length=180, trim_whitespace=True, required=False)
    establishment_type = serializers.CharField(max_length=100, allow_blank=False, trim_whitespace=True)
    city = serializers.CharField(max_length=120, allow_blank=False, trim_whitespace=True)
    address = serializers.CharField(max_length=240, allow_blank=True, required=False, trim_whitespace=True)
    phone = serializers.CharField(max_length=32, allow_blank=False, trim_whitespace=True)
    logo = serializers.CharField(max_length=350000, required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Establishment
        fields = ("name", "establishment_type", "city", "address", "phone", "logo")

    def validate_name(self, value):
        value = " ".join(value.split())
        if self.instance is not None and value == self.instance.name:
            return value  # inchangé : on ne revalide pas (deux structures homonymes confirmées par l'équipe doivent pouvoir enregistrer leur fiche)
        if len(value) < 2:
            raise serializers.ValidationError("Indiquez le nom de votre établissement.")
        others = Establishment.objects.filter(name__iexact=value)
        if self.instance is not None:
            others = others.exclude(pk=self.instance.pk)
        if others.exists():
            raise serializers.ValidationError("Un autre établissement porte déjà ce nom. Écrivez à l’équipe Mon E‑Carnet si c’est bien le vôtre.")
        return value

    def validate_logo(self, value):
        return validate_webp_data_url(value, "Le logo")

    def update(self, instance, validated_data):
        validated_data.pop("logo", None)  # le stockage de l'image relève de la vue (Cloudinary), pas d'un champ du modèle
        return super().update(instance, validated_data)

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


class PrescriptionTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionTemplate
        fields = ("logo_url", "header_text", "footer_text", "phone", "email", "address", "updated_at")
        read_only_fields = ("updated_at",)

    def validate_logo_url(self, value):
        if value and not value.lower().startswith(("https://", "http://")):
            raise serializers.ValidationError("Le logo doit être une URL HTTP ou HTTPS.")
        return value

import re

from rest_framework import serializers
from .models import ClinicalDeclaration, PatientEmergencyCard, PatientProfile

PHONE_PATTERN = re.compile(r"^\+?[0-9][0-9 ().\-]{4,30}$")


class PatientProfileSerializer(serializers.ModelSerializer):
    first_name = serializers.SerializerMethodField()
    last_name = serializers.SerializerMethodField()

    class Meta:
        model = PatientProfile
        fields = ("id", "first_name", "last_name", "phone", "birth_date", "address", "profession", "coverage_provider", "coverage_number", "coverage_expiry", "created_at", "updated_at")
        read_only_fields = ("id", "first_name", "last_name", "created_at", "updated_at")

    def get_first_name(self, obj):
        return obj.display_first_name()

    def get_last_name(self, obj):
        return obj.display_last_name()


class ClinicalDeclarationSerializer(serializers.ModelSerializer):
    provenance = serializers.SerializerMethodField()

    class Meta:
        model = ClinicalDeclaration
        fields = ("id", "kind", "label", "details", "status", "provenance", "created_at", "updated_at")
        read_only_fields = ("id", "status", "provenance", "created_at", "updated_at")

    def get_provenance(self, _obj):
        return {"code": "declared", "label": "Déclaré par le patient"}

    def validate(self, attrs):
        kind = attrs.get("kind", getattr(self.instance, "kind", None))
        label = attrs.get("label", getattr(self.instance, "label", ""))
        if kind == "blood_group" and label not in {"A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−", "Inconnu"}:
            raise serializers.ValidationError({"label": "Choisissez un groupe sanguin valide."})
        if kind == "city":
            if len(label.strip()) > 120:
                raise serializers.ValidationError({"label": "La ville ne peut pas dépasser 120 caractères."})
            attrs["details"] = ""
        if kind == "emergency_contact":
            phone = str(attrs.get("details", getattr(self.instance, "details", ""))).strip()
            if len(label.strip()) > 120:
                raise serializers.ValidationError({"label": "Le nom du contact ne peut pas dépasser 120 caractères."})
            if not PHONE_PATTERN.match(phone):
                raise serializers.ValidationError({"details": "Saisissez un numéro de téléphone valide (chiffres, espaces, + au début)."})
            attrs["details"] = phone
        return attrs


class PatientEmergencyCardSerializer(serializers.ModelSerializer):
    """Seul réglage restant de la carte : activer ou couper le QR. Tout le reste vient du carnet."""

    class Meta:
        model = PatientEmergencyCard
        fields = ("qr_enabled",)

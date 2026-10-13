from rest_framework import serializers
from .models import ClinicalDeclaration, PatientEmergencyCard, PatientProfile


class PatientProfileSerializer(serializers.ModelSerializer):
    first_name = serializers.SerializerMethodField()
    last_name = serializers.SerializerMethodField()

    class Meta:
        model = PatientProfile
        fields = ("id", "first_name", "last_name", "phone", "birth_date", "address", "coverage_provider", "coverage_number", "coverage_expiry", "created_at", "updated_at")
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
        return attrs


class PatientEmergencyCardSerializer(serializers.ModelSerializer):
    offline_declaration_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        max_length=40,
    )

    class Meta:
        model = PatientEmergencyCard
        fields = ("contact_name", "contact_phone", "qr_enabled", "offline_declaration_ids")

    def validate_offline_declaration_ids(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Une déclaration ne peut être sélectionnée qu’une seule fois.")
        return value

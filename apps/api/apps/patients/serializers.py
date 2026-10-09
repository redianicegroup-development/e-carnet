from rest_framework import serializers
from .models import ClinicalDeclaration, PatientProfile


class PatientProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientProfile
        fields = ("id", "phone", "birth_date", "address", "coverage_provider", "coverage_number", "coverage_expiry", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class ClinicalDeclarationSerializer(serializers.ModelSerializer):
    provenance = serializers.SerializerMethodField()

    class Meta:
        model = ClinicalDeclaration
        fields = ("id", "kind", "label", "details", "status", "provenance", "created_at", "updated_at")
        read_only_fields = ("id", "status", "provenance", "created_at", "updated_at")

    def get_provenance(self, _obj):
        return {"code": "declared", "label": "Déclaré par le patient"}

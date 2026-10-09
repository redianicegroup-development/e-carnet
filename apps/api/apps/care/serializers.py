from rest_framework import serializers
from .models import AccessGrant, CareEncounter, Consultation


class CareEncounterSerializer(serializers.ModelSerializer):
    establishment_id = serializers.UUIDField(read_only=True, allow_null=True)
    provenance = serializers.SerializerMethodField()
    revision_count = serializers.SerializerMethodField()

    class Meta:
        model = CareEncounter
        fields = ("id", "establishment_id", "facility_label", "reason", "observations", "recorded_with_help", "status", "closed_at", "provenance", "revision_count", "created_at", "updated_at")
        read_only_fields = ("id", "establishment_id", "facility_label", "status", "closed_at", "provenance", "revision_count", "created_at", "updated_at")

    def get_provenance(self, _obj):
        return {"code": "declared", "label": "Saisi dans le compte patient"}

    def get_revision_count(self, obj):
        return obj.revisions.count()


class AccessGrantSerializer(serializers.ModelSerializer):
    patient_id = serializers.UUIDField(read_only=True)
    professional_id = serializers.UUIDField(read_only=True)
    establishment_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = AccessGrant
        fields = ("id", "patient_id", "professional_id", "establishment_id", "professional_name", "facility_label", "scope", "status", "requested_at", "starts_at", "expires_at", "extension_count", "revoked_at", "refused_at")
        read_only_fields = fields


class ConsultationSerializer(serializers.ModelSerializer):
    provenance = serializers.SerializerMethodField()
    professional_id = serializers.UUIDField(read_only=True, allow_null=True)
    establishment_id = serializers.UUIDField(read_only=True, allow_null=True)
    access_grant_id = serializers.UUIDField(read_only=True, allow_null=True)
    source_encounter_id = serializers.UUIDField(read_only=True, allow_null=True)

    class Meta:
        model = Consultation
        fields = ("id", "professional_id", "establishment_id", "access_grant_id", "source_encounter_id", "professional_name", "facility_label", "reason", "observations", "conclusion", "care_plan", "validated_at", "attestation_signed_at", "attestation_svg_hash", "provenance")
        read_only_fields = fields

    def get_provenance(self, _obj):
        return {"code": "verified", "label": "Consultation médicale validée"}


class ProfessionalConsultationCreateSerializer(serializers.Serializer):
    access_grant_id = serializers.UUIDField()
    source_encounter_id = serializers.UUIDField()
    reason = serializers.CharField(max_length=240, required=False, allow_blank=True)
    observations = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    conclusion = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    care_plan = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    attestation_svg = serializers.CharField(max_length=20000, trim_whitespace=True)

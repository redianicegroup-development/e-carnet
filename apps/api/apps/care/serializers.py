from rest_framework import serializers
from .models import AccessGrant, Appointment, CareEncounter, Consultation, ExamRequest, FollowUpPlan, FollowUpPlanItem, HealthMeasurement, MedicalDocument, MedicationIntake, MedicationReminder, PatientNotification, PreconsultationTemplate, PrescriptionLine, Vaccination
from .vitals import VitalsField, present_consultation_vitals


class CareEncounterSerializer(serializers.ModelSerializer):
    establishment_id = serializers.UUIDField(read_only=True, allow_null=True)
    provenance = serializers.SerializerMethodField()
    revision_count = serializers.SerializerMethodField()
    vitals = VitalsField(required=False)

    class Meta:
        model = CareEncounter
        fields = ("id", "establishment_id", "facility_label", "reason", "observations", "vitals", "recorded_with_help", "status", "closed_at", "provenance", "revision_count", "created_at", "updated_at")
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


class ProfessionalAccessGrantSerializer(AccessGrantSerializer):
    """Vue professionnelle d’un accès : jamais d’identifiant de patient, seulement une référence propre à cet accès.

    Un identifiant de patient connu du professionnel permettrait de renvoyer des demandes sans QR ; le QR du patient
    reste donc la seule porte d’entrée, à chaque demande."""
    reference = serializers.SerializerMethodField()

    class Meta(AccessGrantSerializer.Meta):
        fields = tuple(name for name in AccessGrantSerializer.Meta.fields if name != "patient_id") + ("reference",)
        read_only_fields = fields

    def get_reference(self, obj):
        return str(obj.id)[:8].upper()


class PrescriptionLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionLine
        fields = ("id", "drug_name", "dosage", "posology", "duration", "instructions")
        read_only_fields = fields


class ExamRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamRequest
        fields = ("id", "kind", "label", "status")
        read_only_fields = fields


class ConsultationSerializer(serializers.ModelSerializer):
    provenance = serializers.SerializerMethodField()
    vitals = serializers.SerializerMethodField()
    prescription_lines = PrescriptionLineSerializer(many=True, read_only=True)
    exam_requests = ExamRequestSerializer(many=True, read_only=True)
    professional_id = serializers.UUIDField(read_only=True, allow_null=True)
    establishment_id = serializers.UUIDField(read_only=True, allow_null=True)
    access_grant_id = serializers.UUIDField(read_only=True, allow_null=True)
    source_encounter_id = serializers.UUIDField(read_only=True, allow_null=True)

    class Meta:
        model = Consultation
        fields = ("id", "professional_id", "establishment_id", "access_grant_id", "source_encounter_id", "professional_name", "facility_label", "reason", "symptoms", "clinical_exam", "diagnosis", "observations", "vitals", "prescription_lines", "exam_requests", "conclusion", "care_plan", "validated_at", "attestation_signed_at", "attestation_svg_hash", "provenance")
        read_only_fields = fields

    def get_provenance(self, _obj):
        return {"code": "verified", "label": "Consultation médicale validée"}

    def get_vitals(self, obj):
        return present_consultation_vitals(obj.vitals)


class MedicalDocumentSerializer(serializers.ModelSerializer):
    document_type_label = serializers.CharField(source="get_document_type_display", read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = MedicalDocument
        fields = ("id", "original_name", "document_type", "document_type_label", "document_date", "issuer", "content_type", "size_bytes", "verified", "created_at", "download_url")
        read_only_fields = ("id", "original_name", "content_type", "size_bytes", "verified", "created_at", "download_url")

    def get_download_url(self, obj):
        return f"/api/v1/patient/care/documents/{obj.id}/download/"


class VaccinationSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Vaccination
        fields = ("id", "vaccine_name", "dose_number", "administered_on", "batch_number", "facility", "professional", "next_due_on", "status", "status_label", "notes", "created_at")
        read_only_fields = ("id", "status", "status_label", "created_at")

    def validate_vaccine_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Indiquez le nom du vaccin.")
        return value.strip()


class HealthMeasurementSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    source_label = serializers.CharField(source="get_source_display", read_only=True)

    class Meta:
        model = HealthMeasurement
        fields = ("id", "kind", "kind_label", "value", "unit", "source", "source_label", "measured_at", "note", "created_at")
        read_only_fields = ("id", "kind_label", "source_label", "created_at")

    def validate(self, attrs):
        limits = {"weight": (0.5, 400), "temperature": (25, 45), "heart_rate": (20, 250), "glycemia": (0, 20), "blood_pressure_systolic": (40, 300), "blood_pressure_diastolic": (20, 200)}
        low, high = limits[attrs["kind"]]
        if not low <= float(attrs["value"]) <= high:
            raise serializers.ValidationError({"value": "La valeur ne se situe pas dans une plage plausible."})
        expected = {"weight": "kg", "temperature": "°C", "heart_rate": "bpm", "glycemia": "g/L", "blood_pressure_systolic": "mmHg", "blood_pressure_diastolic": "mmHg"}[attrs["kind"]]
        if attrs.get("unit") != expected:
            raise serializers.ValidationError({"unit": f"L’unité attendue est {expected}."})
        return attrs


class FollowUpPlanItemSerializer(serializers.ModelSerializer):
    measurement_kind_label = serializers.CharField(source="get_measurement_kind_display", read_only=True)
    class Meta:
        model = FollowUpPlanItem
        fields = ("id", "measurement_kind", "measurement_kind_label", "frequency", "target", "notes")
        read_only_fields = ("id", "measurement_kind_label")


class FollowUpPlanSerializer(serializers.ModelSerializer):
    items = FollowUpPlanItemSerializer(many=True, read_only=True)
    professional_name = serializers.CharField(source="professional.user.get_full_name", read_only=True, allow_null=True)
    establishment_name = serializers.CharField(source="establishment.name", read_only=True, allow_null=True)
    class Meta:
        model = FollowUpPlan
        fields = ("id", "title", "instructions", "active", "starts_on", "ends_on", "professional_name", "establishment_name", "items", "created_at", "updated_at")
        read_only_fields = fields


class MedicationReminderSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationReminder
        fields = ("id", "name", "dosage", "instructions", "times", "starts_on", "ends_on", "stock_remaining", "refill_threshold", "active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_times(self, value):
        if not isinstance(value, list) or not value or len(value) > 12 or any(not isinstance(item, str) or len(item) != 5 or item[2] != ":" for item in value):
            raise serializers.ValidationError("Indiquez au moins un horaire au format HH:MM.")
        return sorted(set(value))


class MedicationIntakeSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationIntake
        fields = ("id", "scheduled_for", "status", "recorded_at")
        read_only_fields = ("id", "recorded_at")


class PatientNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientNotification
        fields = ("id", "kind", "title", "body", "metadata", "read_at", "created_at")
        read_only_fields = ("id", "kind", "title", "body", "metadata", "created_at")


class AppointmentSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    establishment_name = serializers.CharField(source="establishment.name", read_only=True, allow_null=True)
    professional_name = serializers.CharField(source="professional.user.get_full_name", read_only=True, allow_null=True)
    class Meta:
        model = Appointment
        fields = ("id", "reason", "starts_at", "ends_at", "status", "status_label", "notes", "queue_number", "establishment_name", "professional_name", "created_at", "updated_at")
        read_only_fields = ("id", "status", "status_label", "establishment_name", "professional_name", "created_at", "updated_at")


class PreconsultationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreconsultationTemplate
        fields = ("id", "name", "active", "fields", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_fields(self, value):
        if not isinstance(value, list) or len(value) > 30:
            raise serializers.ValidationError("Un modèle contient au maximum 30 champs.")
        for field in value:
            if not isinstance(field, dict) or not str(field.get("key", "")).strip() or not str(field.get("label", "")).strip():
                raise serializers.ValidationError("Chaque champ doit contenir une clé et un libellé.")
        return value


MAX_ORDER_LINES = 15


class PrescriptionLineInputSerializer(serializers.Serializer):
    drug_name = serializers.CharField(max_length=160)
    dosage = serializers.CharField(max_length=80, required=False, allow_blank=True)
    posology = serializers.CharField(max_length=160)
    duration = serializers.CharField(max_length=80, required=False, allow_blank=True)
    instructions = serializers.CharField(max_length=240, required=False, allow_blank=True)


class ExamRequestInputSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=ExamRequest.KIND_CHOICES)
    label = serializers.CharField(max_length=160)


class ProfessionalConsultationCreateSerializer(serializers.Serializer):
    access_grant_id = serializers.UUIDField()
    source_encounter_id = serializers.UUIDField()
    reason = serializers.CharField(max_length=240, required=False, allow_blank=True)
    symptoms = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    clinical_exam = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    diagnosis = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    observations = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    # Jeu final de constantes relu par le médecin ; absent, la pré-consultation est reprise telle quelle.
    vitals = VitalsField(required=False)
    prescription_lines = PrescriptionLineInputSerializer(many=True, required=False, max_length=MAX_ORDER_LINES)
    requested_exams = ExamRequestInputSerializer(many=True, required=False, max_length=MAX_ORDER_LINES)
    conclusion = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    care_plan = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    attestation_svg = serializers.CharField(max_length=20000, trim_whitespace=True)

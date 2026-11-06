from decimal import Decimal, InvalidOperation
from datetime import datetime
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from rest_framework import serializers
from .models import AccessGrant, Appointment, CareEncounter, Consultation, ExamRequest, FollowUpPlan, FollowUpPlanItem, HealthMeasurement, MedicalDocument, MedicationIntake, MedicationReminder, PatientNotification, PreconsultationTemplate, PrescriptionLine, Vaccination
from .vitals import VitalsField, present_consultation_vitals


class CareEncounterSerializer(serializers.ModelSerializer):
    establishment_id = serializers.UUIDField(read_only=True, allow_null=True)
    provenance = serializers.SerializerMethodField()
    revision_count = serializers.SerializerMethodField()
    vitals = VitalsField(required=False)
    preconsultation_template = serializers.PrimaryKeyRelatedField(queryset=PreconsultationTemplate.objects.all(), required=False, allow_null=True)
    template_fields = serializers.SerializerMethodField()
    template_responses = serializers.JSONField(required=False)

    class Meta:
        model = CareEncounter
        fields = ("id", "establishment_id", "facility_label", "reason", "observations", "vitals", "recorded_with_help", "preconsultation_template", "template_fields", "template_responses", "status", "closed_at", "provenance", "revision_count", "created_at", "updated_at")
        read_only_fields = ("id", "establishment_id", "facility_label", "template_fields", "status", "closed_at", "provenance", "revision_count", "created_at", "updated_at")

    def get_provenance(self, _obj):
        return {"code": "declared", "label": "Saisi dans le compte patient"}

    def get_revision_count(self, obj):
        return obj.revisions.count()

    def get_template_fields(self, obj):
        return obj.preconsultation_template.fields if obj.preconsultation_template_id else []

    def validate(self, attrs):
        template = attrs.get("preconsultation_template", getattr(self.instance, "preconsultation_template", None))
        responses = attrs.get("template_responses", getattr(self.instance, "template_responses", {}))
        if self.instance and self.instance.preconsultation_template_id and template is None:
            raise serializers.ValidationError({"preconsultation_template": "Le modèle associé au brouillon ne peut être retiré."})
        if template is None:
            if responses:
                raise serializers.ValidationError({"template_responses": "Les réponses exigent un modèle actif."})
            return attrs
        if template.status != "active" and not (self.instance and template == self.instance.preconsultation_template):
            raise serializers.ValidationError({"preconsultation_template": "Seul un modèle actif peut être utilisé."})
        if not isinstance(responses, dict):
            raise serializers.ValidationError({"template_responses": "Les réponses doivent être un objet."})
        schema = {field["key"]: field for field in template.fields}
        if set(responses) - set(schema):
            raise serializers.ValidationError({"template_responses": "Certaines réponses ne correspondent pas au modèle."})
        for key, spec in schema.items():
            value = responses.get(key)
            if spec["required"] and value in (None, ""):
                raise serializers.ValidationError({"template_responses": {key: "Ce champ est obligatoire."}})
            if value in (None, ""):
                continue
            if spec["type"] == "text" and (not isinstance(value, str) or len(value) > 2000):
                raise serializers.ValidationError({"template_responses": {key: "Texte invalide (2 000 caractères maximum)."}})
            if spec["type"] == "number":
                try:
                    number = Decimal(str(value))
                    if not number.is_finite(): raise InvalidOperation
                except (InvalidOperation, ValueError):
                    raise serializers.ValidationError({"template_responses": {key: "Saisissez un nombre valide."}})
            if spec["type"] == "choice" and value not in spec["options"]:
                raise serializers.ValidationError({"template_responses": {key: "Choix invalide."}})
            if spec["type"] == "yes_no" and not isinstance(value, bool):
                raise serializers.ValidationError({"template_responses": {key: "Valeur oui/non invalide."}})
        return attrs


class AccessGrantSerializer(serializers.ModelSerializer):
    patient_id = serializers.UUIDField(read_only=True)
    professional_id = serializers.UUIDField(read_only=True)
    establishment_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = AccessGrant
        fields = ("id", "patient_id", "professional_id", "establishment_id", "professional_name", "facility_label", "scope", "source_establishments", "status", "requested_at", "starts_at", "expires_at", "extension_count", "revoked_at", "refused_at")
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
    establishment_id = serializers.UUIDField(read_only=True)
    professional_id = serializers.UUIDField(read_only=True)
    validated_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = MedicalDocument
        fields = ("id", "original_name", "document_type", "document_type_label", "document_date", "issuer", "content_type", "size_bytes", "verified", "exam_request_id", "establishment_id", "professional_id", "validated_at", "created_at", "download_url")
        read_only_fields = ("id", "original_name", "content_type", "size_bytes", "verified", "establishment_id", "professional_id", "validated_at", "created_at", "download_url")

    def get_download_url(self, obj):
        return f"/api/v1/patient/care/documents/{obj.id}/download/"


class VaccinationSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    document_id = serializers.PrimaryKeyRelatedField(source="document", queryset=MedicalDocument.objects.all(), required=False, allow_null=True)
    confirmed_by_name = serializers.SerializerMethodField()
    establishment_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Vaccination
        fields = ("id", "vaccine_name", "dose_number", "administered_on", "batch_number", "facility", "professional", "next_due_on", "document_id", "confirmed_by_name", "confirmed_at", "establishment_id", "status", "status_label", "notes", "created_at")
        read_only_fields = ("id", "confirmed_by_name", "confirmed_at", "establishment_id", "status", "status_label", "created_at")

    def get_confirmed_by_name(self, obj):
        if not obj.confirmed_by_id:
            return ""
        name = obj.confirmed_by.user.get_full_name().strip()
        return f"{obj.confirmed_by.professional_title} {name}".strip()

    def validate_vaccine_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Indiquez le nom du vaccin.")
        return value.strip()


class MeasurementValueField(serializers.Field):
    """Valeur d'une mesure : texte brut si fourni, sinon représentation décimale de la valeur numérique."""

    def get_attribute(self, instance):
        return instance

    def to_representation(self, instance):
        if instance.raw_value:
            return instance.raw_value
        return str(instance.value) if instance.value is not None else ""

    def to_internal_value(self, data):
        if isinstance(data, bool) or not isinstance(data, (str, int, float, Decimal)):
            raise serializers.ValidationError("Saisissez une valeur de mesure valide.")
        value = str(data).strip()
        if not value or len(value) > 32:
            raise serializers.ValidationError("La valeur est obligatoire et limitée à 32 caractères.")
        return value


class HealthMeasurementSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    source_label = serializers.CharField(source="get_source_display", read_only=True)
    professional_name = serializers.SerializerMethodField()
    value = MeasurementValueField()
    establishment_id = serializers.UUIDField(read_only=True)
    professional_id = serializers.UUIDField(read_only=True)
    validated_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = HealthMeasurement
        fields = ("id", "kind", "kind_label", "value", "unit", "source", "source_label", "professional_name", "measured_at", "note", "establishment_id", "professional_id", "validated_at", "created_at")
        read_only_fields = ("id", "kind_label", "source_label", "professional_name", "establishment_id", "professional_id", "validated_at", "created_at")

    def get_professional_name(self, obj):
        if not obj.professional_id:
            return None
        return obj.professional.user.get_full_name().strip() or obj.professional.professional_title or None

    def validate_kind(self, value):
        if value not in {"blood_pressure", "glycemia", "weight", "height", "temperature", "heart_rate", "spo2"}:
            raise serializers.ValidationError("Ce type de mesure n'est plus proposé ; saisissez tension ou glycémie dans le champ unifié.")
        return value

    def validate(self, attrs):
        kind = attrs["kind"]
        value = attrs["value"]
        if kind in {"blood_pressure", "glycemia"}:
            if not any(character.isdigit() for character in value):
                raise serializers.ValidationError({"value": "Indiquez la valeur telle qu’elle apparaît sur le carnet, ou laissez le champ vide."})
            attrs["raw_value"] = value
            attrs["value"] = None
            # L'unité éventuelle fait partie du texte saisi; le serveur n'en ajoute aucune.
            attrs["unit"] = ""
            return attrs

        try:
            numeric = Decimal(value.replace(",", "."))
        except InvalidOperation:
            raise serializers.ValidationError({"value": "La valeur doit être numérique pour cette mesure."}) from None
        rules = {
            "weight": (Decimal("0.5"), Decimal("400"), Decimal("0.1"), "kg"),
            "height": (Decimal("20"), Decimal("260"), Decimal("0.1"), "cm"),
            "temperature": (Decimal("25"), Decimal("45"), Decimal("0.1"), "°C"),
            "heart_rate": (Decimal("20"), Decimal("300"), Decimal("1"), "bpm"),
            "spo2": (Decimal("30"), Decimal("100"), Decimal("1"), "%"),
        }
        low, high, precision, expected = rules[kind]
        if not numeric.is_finite() or not low <= numeric <= high:
            raise serializers.ValidationError({"value": "La valeur ne se situe pas dans la plage technique attendue."})
        if attrs.get("unit") != expected:
            raise serializers.ValidationError({"unit": f"L’unité attendue est {expected}."})
        attrs["value"] = numeric.quantize(precision)
        attrs["raw_value"] = ""
        return attrs


class FollowUpPlanItemSerializer(serializers.ModelSerializer):
    measurement_kind_label = serializers.CharField(source="get_measurement_kind_display", read_only=True)
    class Meta:
        model = FollowUpPlanItem
        fields = ("id", "measurement_kind", "measurement_kind_label", "frequency", "target", "notes")
        read_only_fields = ("id", "measurement_kind_label")


class FollowUpPlanSerializer(serializers.ModelSerializer):
    items = FollowUpPlanItemSerializer(many=True, read_only=True)
    history = serializers.SerializerMethodField()
    professional_name = serializers.CharField(source="professional.user.get_full_name", read_only=True, allow_null=True)
    establishment_name = serializers.CharField(source="establishment.name", read_only=True, allow_null=True)
    class Meta:
        model = FollowUpPlan
        fields = ("id", "title", "objective", "instructions", "status", "active", "starts_on", "ends_on", "professional_name", "establishment_name", "access_grant", "items", "history", "created_at", "updated_at")
        read_only_fields = fields

    def get_history(self, obj):
        return [{"action": item.action, "snapshot": item.snapshot, "created_at": item.created_at} for item in obj.revisions.all()]


class MedicationReminderSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationReminder
        fields = ("id", "name", "dosage", "instructions", "times", "days_of_week", "starts_on", "ends_on", "active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_days_of_week(self, value):
        if not isinstance(value, list) or len(value) > 7 or any(isinstance(day, bool) or not isinstance(day, int) or day < 0 or day > 6 for day in value):
            raise serializers.ValidationError("Indiquez des jours entre lundi et dimanche, ou aucun pour tous les jours.")
        return sorted(set(value))

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
    establishment = serializers.PrimaryKeyRelatedField(queryset=__import__("apps.establishments.models", fromlist=["Establishment"]).Establishment.objects.all(), required=False, allow_null=True, write_only=True)
    professional = serializers.PrimaryKeyRelatedField(queryset=__import__("apps.professionals.models", fromlist=["ProfessionalProfile"]).ProfessionalProfile.objects.all(), required=False, allow_null=True, write_only=True)
    establishment_id = serializers.UUIDField(source="establishment.id", read_only=True, allow_null=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    establishment_name = serializers.CharField(source="establishment.name", read_only=True, allow_null=True)
    professional_name = serializers.CharField(source="professional.user.get_full_name", read_only=True, allow_null=True)
    proposed_starts_at = serializers.DateTimeField(read_only=True, allow_null=True)
    proposed_ends_at = serializers.DateTimeField(read_only=True, allow_null=True)
    class Meta:
        model = Appointment
        fields = ("id", "reason", "starts_at", "ends_at", "proposed_starts_at", "proposed_ends_at", "status", "status_label", "notes", "change_reason", "queue_number", "establishment", "professional", "establishment_id", "establishment_name", "professional_name", "created_at", "updated_at")
        read_only_fields = ("id", "status", "status_label", "establishment_id", "establishment_name", "professional_name", "proposed_starts_at", "proposed_ends_at", "change_reason", "created_at", "updated_at")

    def validate(self, attrs):
        establishment = attrs.get("establishment", getattr(self.instance, "establishment", None))
        professional = attrs.get("professional", getattr(self.instance, "professional", None))
        if (establishment is None) != (professional is None):
            raise serializers.ValidationError("L'établissement et le professionnel doivent être choisis ensemble.")
        if establishment is not None:
            if establishment.status != "active" or not establishment.is_profile_complete:
                raise serializers.ValidationError({"establishment": "Cet établissement n'est pas disponible dans le catalogue."})
            from apps.establishments.models import EstablishmentMembership
            if not EstablishmentMembership.objects.filter(establishment=establishment, professional=professional, status="active").exists():
                raise serializers.ValidationError({"professional": "Ce professionnel n'est pas rattaché activement à cet établissement."})
            if getattr(professional, "verification_status", None) != "verified":
                raise serializers.ValidationError({"professional": "Ce professionnel n'est pas actif."})
        if attrs.get("ends_at") and attrs.get("starts_at") and attrs["ends_at"] <= attrs["starts_at"]:
            raise serializers.ValidationError({"ends_at": "La fin doit être postérieure au début."})
        return attrs


class ProfessionalAppointmentSerializer(AppointmentSerializer):
    """Agenda du professionnel : identité minimale du profil patient uniquement."""
    patient_name = serializers.SerializerMethodField()

    class Meta(AppointmentSerializer.Meta):
        fields = AppointmentSerializer.Meta.fields + ("patient_name",)
        read_only_fields = AppointmentSerializer.Meta.read_only_fields + ("patient_name",)

    def get_patient_name(self, appointment):
        patient = appointment.patient
        return " ".join(part for part in (patient.display_first_name(), patient.display_last_name()) if part)


class StrictAwareDateTimeField(serializers.DateTimeField):
    """Refuse les heures sans fuseau plutôt que d’inventer un fuseau local."""
    default_error_messages = {
        **serializers.DateTimeField.default_error_messages,
        "timezone": "La date doit inclure un fuseau horaire.",
    }

    def to_internal_value(self, value):
        parsed = value if isinstance(value, datetime) else parse_datetime(str(value))
        if parsed is None or timezone.is_naive(parsed):
            self.fail("timezone")
        return super().to_internal_value(value)


class ProposeAppointmentSerializer(serializers.Serializer):
    starts_at = StrictAwareDateTimeField(required=True)
    ends_at = StrictAwareDateTimeField(required=False, allow_null=True)
    reason = serializers.CharField(required=True, max_length=500, allow_blank=False, trim_whitespace=True)

    def validate(self, attrs):
        if attrs["starts_at"] <= timezone.now():
            raise serializers.ValidationError({"starts_at": "Le créneau proposé doit être dans le futur."})
        if attrs.get("ends_at") is not None and attrs["ends_at"] <= attrs["starts_at"]:
            raise serializers.ValidationError({"ends_at": "La fin doit être postérieure au début."})
        return attrs


class PreconsultationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreconsultationTemplate
        fields = ("id", "name", "active", "status", "fields", "approved_by", "approved_at", "created_at", "updated_at")
        read_only_fields = ("id", "active", "status", "approved_by", "approved_at", "created_at", "updated_at")
    def validate_name(self, value):
        value = " ".join(value.split())
        if len(value) < 2:
            raise serializers.ValidationError("Le nom doit contenir au moins deux caractères.")
        establishment = self.context.get("establishment")
        if establishment and PreconsultationTemplate.objects.filter(establishment=establishment, name__iexact=value).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError("Un modèle porte déjà ce nom dans cet établissement.")
        return value
    def validate_fields(self, value):
        import re
        allowed = {"key", "label", "type", "unit", "required", "options"}
        if not isinstance(value, list) or len(value) > 30:
            raise serializers.ValidationError("Un modèle contient au maximum 30 champs.")
        result, keys = [], set()
        for index, field in enumerate(value):
            if not isinstance(field, dict) or set(field) - allowed:
                raise serializers.ValidationError({index: "Champ invalide : seules clé, libellé, type, unité, obligatoire et choix sont autorisés."})
            key, label, kind = field.get("key"), field.get("label"), field.get("type")
            if not isinstance(key, str) or not re.fullmatch(r"[a-z][a-z0-9_]{0,39}", key):
                raise serializers.ValidationError({index: {"key": "Utilisez une clé snake_case (1 à 40 caractères, commençant par une lettre minuscule)."}})
            if key in keys:
                raise serializers.ValidationError({index: {"key": "Chaque clé doit être unique dans le modèle."}})
            keys.add(key)
            if not isinstance(label, str) or not label.strip() or len(label.strip()) > 100:
                raise serializers.ValidationError({index: {"label": "Le libellé est obligatoire (100 caractères maximum)."}})
            if kind not in ("text", "number", "choice", "yes_no"):
                raise serializers.ValidationError({index: {"type": "Type attendu : text, number, choice ou yes_no."}})
            required = field.get("required", False)
            if not isinstance(required, bool):
                raise serializers.ValidationError({index: {"required": "Ce champ doit être booléen."}})
            unit = field.get("unit", "")
            if not isinstance(unit, str) or len(unit) > 24 or (unit and kind != "number"):
                raise serializers.ValidationError({index: {"unit": "L’unité (24 caractères maximum) est réservée aux champs numériques."}})
            choices = field.get("options", [])
            if kind == "choice":
                if not isinstance(choices, list) or not 1 <= len(choices) <= 20 or any(not isinstance(choice, str) or not choice.strip() or len(choice) > 80 for choice in choices) or len({choice.strip() for choice in choices}) != len(choices):
                    raise serializers.ValidationError({index: {"options": "Un champ à choix exige 1 à 20 options uniques (80 caractères maximum)."}})
                choices = [choice.strip() for choice in choices]
            elif choices:
                raise serializers.ValidationError({index: {"options": "Les options ne sont permises que pour le type choice."}})
            result.append({"key": key, "label": label.strip(), "type": kind, "unit": unit.strip(), "required": required, "options": choices})
        return result

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

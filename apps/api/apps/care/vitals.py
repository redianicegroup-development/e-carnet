"""Constantes de la pré-consultation et de la consultation.

Les bornes numériques écartent les fautes de frappe ; ce ne sont pas des seuils cliniques.
La tension et la glycémie sont des textes libres : aucune unité ni conversion n'est supposée.
"""
from decimal import Decimal

from rest_framework import serializers

VITAL_KEYS = ("weight_kg", "height_cm", "temperature_c", "blood_pressure", "heart_rate", "spo2", "glycemia")
_DECIMALS = {"weight_kg": 1, "height_cm": 1, "temperature_c": 1}
VITAL_SOURCES = ("preconsultation", "professional")


def _legacy_text(value):
    """Représentation stable des anciennes valeurs numériques reçues pendant un déploiement progressif."""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, Decimal):
        return format(value.normalize(), "f")
    return str(value)


class VitalsSerializer(serializers.Serializer):
    weight_kg = serializers.FloatField(min_value=0.3, max_value=400, required=False, allow_null=True)
    height_cm = serializers.FloatField(min_value=20, max_value=260, required=False, allow_null=True)
    temperature_c = serializers.FloatField(min_value=25, max_value=45, required=False, allow_null=True)
    blood_pressure = serializers.CharField(max_length=24, required=False, allow_null=True, allow_blank=True, trim_whitespace=True)
    heart_rate = serializers.IntegerField(min_value=20, max_value=300, required=False, allow_null=True)
    spo2 = serializers.IntegerField(min_value=30, max_value=100, required=False, allow_null=True)
    glycemia = serializers.CharField(max_length=24, required=False, allow_null=True, allow_blank=True, trim_whitespace=True)

    def to_internal_value(self, data):
        # Accepte temporairement les anciennes apps en cours de déploiement, sans perdre leurs mesures.
        if isinstance(data, dict):
            data = dict(data)
            systolic = data.pop("systolic", None)
            diastolic = data.pop("diastolic", None)
            if "blood_pressure" not in data:
                if systolic is not None and diastolic is not None:
                    data["blood_pressure"] = f"{_legacy_text(systolic)}/{_legacy_text(diastolic)}"
                elif systolic is not None:
                    data["blood_pressure"] = f"Systolique : {_legacy_text(systolic)}"
                elif diastolic is not None:
                    data["blood_pressure"] = f"Diastolique : {_legacy_text(diastolic)}"
            old_glycemia = data.pop("glycemia_g_l", None)
            if "glycemia" not in data and old_glycemia is not None:
                data["glycemia"] = f"{_legacy_text(old_glycemia)} g/L"
        return super().to_internal_value(data)

    def validate(self, attrs):
        cleaned = {key: value for key, value in attrs.items() if value is not None and value != ""}
        for key, label in (("blood_pressure", "La tension"), ("glycemia", "La glycémie")):
            value = cleaned.get(key)
            if value is not None and not any(character.isdigit() for character in value):
                raise serializers.ValidationError({key: f"{label} doit contenir au moins un chiffre, ou rester vide."})
        return {key: round(value, _DECIMALS[key]) if key in _DECIMALS else value for key, value in cleaned.items()}


class VitalsField(serializers.Field):
    """Champ JSON de constantes. Les valeurs absentes restent absentes en écriture et nulles en lecture."""

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError("Les constantes doivent être envoyées sous forme d'objet.")
        nested = VitalsSerializer(data=data)
        nested.is_valid(raise_exception=True)
        return dict(nested.validated_data)

    def to_representation(self, value):
        stored = value or {}
        return {key: stored.get(key) for key in VITAL_KEYS}


def build_consultation_vitals(encounter_vitals, submitted):
    """Constantes signées, chacune avec sa provenance d'origine."""
    encounter_vitals = encounter_vitals or {}
    final = encounter_vitals if submitted is None else submitted
    return {
        key: {"value": value, "source": "preconsultation" if encounter_vitals.get(key) == value else "professional"}
        for key, value in final.items()
        if key in VITAL_KEYS
    }


def present_consultation_vitals(stored):
    stored = stored or {}
    return {key: stored.get(key) for key in VITAL_KEYS}

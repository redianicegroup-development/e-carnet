"""Constantes de la pré-consultation et de la consultation.

Les bornes ci-dessous écartent les fautes de frappe (un poids de 610 kg, une température de 3,7 °C) ; ce ne sont pas des
seuils cliniques. Une constante non mesurée reste absente : on ne la remplace jamais par une valeur supposée.
"""
from rest_framework import serializers

VITAL_KEYS = ("weight_kg", "height_cm", "temperature_c", "systolic", "diastolic", "heart_rate", "spo2", "glycemia_g_l")
_DECIMALS = {"weight_kg": 1, "height_cm": 1, "temperature_c": 1, "glycemia_g_l": 2}
VITAL_SOURCES = ("preconsultation", "professional")


class VitalsSerializer(serializers.Serializer):
    weight_kg = serializers.FloatField(min_value=0.3, max_value=400, required=False, allow_null=True)
    height_cm = serializers.FloatField(min_value=20, max_value=260, required=False, allow_null=True)
    temperature_c = serializers.FloatField(min_value=25, max_value=45, required=False, allow_null=True)
    systolic = serializers.IntegerField(min_value=40, max_value=300, required=False, allow_null=True)
    diastolic = serializers.IntegerField(min_value=20, max_value=200, required=False, allow_null=True)
    heart_rate = serializers.IntegerField(min_value=20, max_value=300, required=False, allow_null=True)
    spo2 = serializers.IntegerField(min_value=30, max_value=100, required=False, allow_null=True)
    glycemia_g_l = serializers.FloatField(min_value=0.1, max_value=15, required=False, allow_null=True)

    def validate(self, attrs):
        cleaned = {key: value for key, value in attrs.items() if value is not None}
        if ("systolic" in cleaned) != ("diastolic" in cleaned):
            raise serializers.ValidationError("Saisissez les deux valeurs de la tension (maximale et minimale), ou aucune.")
        if "systolic" in cleaned and cleaned["systolic"] <= cleaned["diastolic"]:
            raise serializers.ValidationError("La tension maximale doit être supérieure à la tension minimale.")
        return {key: round(value, _DECIMALS[key]) if key in _DECIMALS else value for key, value in cleaned.items()}


class VitalsField(serializers.Field):
    """Champ JSON de constantes. Un serializer imbriqué interdirait `.update()` : on valide donc ici, à la main.

    Écriture : l'ensemble envoyé remplace l'ensemble enregistré (les valeurs nulles sont retirées).
    Lecture : toutes les clés sont présentes, à `null` quand la constante n'a pas été mesurée.
    """

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
    """Constantes d'une consultation signée, chacune avec sa provenance.

    `submitted` est le jeu final relu par le médecin ; absent, on reprend la pré-consultation telle quelle. Une valeur identique
    à celle de la pré-consultation garde cette provenance : elle n'est « mesurée par le médecin » que si elle diffère ou s'ajoute.
    """
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

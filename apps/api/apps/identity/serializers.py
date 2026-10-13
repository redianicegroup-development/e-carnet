from rest_framework import serializers
from .theme import DEFAULT_THEME, FONT_PAIRS, LEGACY_FONT_PAIRS, TEXT_SCALES, normalize_theme, validate_theme


class ThemeSerializer(serializers.Serializer):
    font_pair = serializers.CharField(max_length=40, required=False)
    text_scale = serializers.CharField(max_length=20, required=False)
    # Compatibilité de transition avec les clients V1.8 qui n'envoient qu'une police.
    font = serializers.CharField(max_length=40, required=False)
    palette = serializers.ListField(child=serializers.CharField(max_length=7), min_length=5, max_length=5)

    def validate(self, attrs):
        if attrs.get("font_pair") is not None and attrs["font_pair"] not in FONT_PAIRS:
            raise serializers.ValidationError({"font_pair": "Paire de polices non autorisée."})
        if attrs.get("text_scale") is not None and attrs["text_scale"] not in TEXT_SCALES:
            raise serializers.ValidationError({"text_scale": "Taille de texte non autorisée."})
        if attrs.get("font") is not None and attrs["font"] not in LEGACY_FONT_PAIRS:
            raise serializers.ValidationError({"font": "Cette police historique n’est plus proposée."})
        legacy_pair = LEGACY_FONT_PAIRS.get(attrs.get("font"), DEFAULT_THEME["font_pair"])
        normalized = normalize_theme({**attrs, "font_pair": attrs.get("font_pair", legacy_pair)})
        errors = validate_theme({**normalized, "palette": attrs.get("palette")})
        if errors:
            raise serializers.ValidationError(errors)
        return normalized


class ThemePreferenceSerializer(serializers.Serializer):
    font = serializers.CharField()
    palette = serializers.ListField(child=serializers.CharField())

    @classmethod
    def default_value(cls):
        return DEFAULT_THEME.copy()

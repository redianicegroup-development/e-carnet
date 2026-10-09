from rest_framework import serializers
from .theme import DEFAULT_THEME, validate_theme


class ThemeSerializer(serializers.Serializer):
    font = serializers.CharField(max_length=40)
    palette = serializers.ListField(child=serializers.CharField(max_length=7), min_length=5, max_length=5)

    def validate(self, attrs):
        errors = validate_theme(attrs)
        if errors:
            raise serializers.ValidationError(errors)
        return {"font": attrs["font"], "palette": [color.upper() for color in attrs["palette"]]}


class ThemePreferenceSerializer(serializers.Serializer):
    font = serializers.CharField()
    palette = serializers.ListField(child=serializers.CharField())

    @classmethod
    def default_value(cls):
        return DEFAULT_THEME.copy()

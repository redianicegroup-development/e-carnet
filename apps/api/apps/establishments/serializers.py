from rest_framework import serializers

from .models import Establishment, EstablishmentMembership


class EstablishmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Establishment
        fields = ("id", "name", "establishment_type", "city", "address", "phone", "email", "responsible_name", "status", "internal_code", "activated_at", "created_at")
        read_only_fields = ("id", "status", "internal_code", "activated_at", "created_at")


class MembershipSerializer(serializers.ModelSerializer):
    establishment = serializers.UUIDField(source="establishment_id", read_only=True)
    professional = serializers.UUIDField(source="professional_id", read_only=True)

    class Meta:
        model = EstablishmentMembership
        fields = ("id", "establishment", "professional", "status", "requested_at", "reviewed_at", "left_at", "agreement_version", "agreement_accepted_at")
        read_only_fields = fields

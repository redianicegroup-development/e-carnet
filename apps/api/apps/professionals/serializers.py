from rest_framework import serializers

from .models import ProfessionalProfile


class ProfessionalOnboardingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProfessionalProfile
        fields = ("specialty",)


class ProfessionalProfileSerializer(serializers.ModelSerializer):
    active_establishment = serializers.UUIDField(source="active_establishment_id", allow_null=True, read_only=True)
    mfa_active = serializers.SerializerMethodField()
    memberships = serializers.SerializerMethodField()
    clinical_access = serializers.SerializerMethodField()

    class Meta:
        model = ProfessionalProfile
        fields = ("id", "professional_title", "specialty", "active_establishment", "mfa_active", "memberships", "clinical_access")

    def get_memberships(self, obj):
        # Le professionnel voit l'état de SES rattachements (jamais le code ni les coordonnées du responsable).
        from apps.establishments.models import EstablishmentMembership
        items = EstablishmentMembership.objects.filter(professional=obj).select_related("establishment")
        return [{"id": str(m.id), "establishment_id": str(m.establishment_id), "establishment_name": m.establishment.name, "city": m.establishment.city, "status": m.status, "requested_at": m.requested_at, "reviewed_at": m.reviewed_at} for m in items]

    def get_clinical_access(self, obj):
        from .access import professional_clinical_access_error
        reason = professional_clinical_access_error(obj)
        return {"allowed": reason is None, "reason": reason}

    def get_mfa_active(self, obj):
        device = getattr(obj.user, "mfa_device", None)
        return bool(device and device.is_active)

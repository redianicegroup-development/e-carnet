from PIL import Image, UnidentifiedImageError
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
        read_only_fields = fields

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

def validate_private_png(uploaded, label):
    if not uploaded or uploaded.size > 2 * 1024 * 1024:
        raise serializers.ValidationError(f"{label} : fichier PNG de 2 Mo maximum requis.")
    uploaded.seek(0)
    header = uploaded.read(8)
    uploaded.seek(0)
    if header != b"\x89PNG\r\n\x1a\n" or getattr(uploaded, "content_type", "") not in ("", "image/png"):
        raise serializers.ValidationError(f"{label} : seul un vrai fichier PNG est accepté.")
    try:
        with Image.open(uploaded) as image:
            image.verify()
        uploaded.seek(0)
        with Image.open(uploaded) as image:
            width, height = image.size
    except (UnidentifiedImageError, OSError):
        raise serializers.ValidationError(f"{label} : image PNG illisible.")
    finally:
        uploaded.seek(0)
    if not (32 <= width <= 2048 and 32 <= height <= 2048):
        raise serializers.ValidationError(f"{label} : dimensions comprises entre 32 et 2048 pixels.")
    return uploaded


class ProfessionalCredentialsSerializer(serializers.Serializer):
    professional_identifier = serializers.CharField(max_length=120, allow_blank=True, required=False, trim_whitespace=True)
    stamp = serializers.ImageField(required=False, allow_null=True)
    signature = serializers.ImageField(required=False, allow_null=True)

    def validate_stamp(self, value):
        return validate_private_png(value, "Le cachet")

    def validate_signature(self, value):
        return validate_private_png(value, "La signature")

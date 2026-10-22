from django.db import transaction
from django.http import HttpResponse
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cloudinary_storage import CLOUDINARY_CONFIGURED, destroy as cloudinary_destroy, signed_download as cloudinary_download, upload as cloudinary_upload
from apps.identity.models import AccountContext
from .models import ProfessionalProfile, ProfessionalSpecialty
from .serializers import ProfessionalCredentialsSerializer, ProfessionalOnboardingSerializer, ProfessionalProfileSerializer


class ProfessionalMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "professional_profile", None)
        if not profile:
            return Response({"success": False, "message": "Le profil professionnel n’est pas encore créé."}, status=404)
        return Response({"success": True, "data": ProfessionalProfileSerializer(profile).data})


class ProfessionalSpecialtyListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"success": True, "data": list(ProfessionalSpecialty.objects.values_list("name", flat=True))})


class ProfessionalCredentialsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        profile = getattr(request.user, "professional_profile", None)
        if not profile:
            return Response({"success": False, "message": "Le profil professionnel n’est pas encore créé."}, status=404)
        return Response({"success": True, "data": {
            "professional_identifier": profile.professional_identifier,
            "stamp_uploaded": bool(profile.stamp_cloudinary_public_id),
            "signature_uploaded": bool(profile.signature_cloudinary_public_id),
        }})

    def patch(self, request):
        profile = getattr(request.user, "professional_profile", None)
        if not profile:
            return Response({"success": False, "message": "Le profil professionnel n’est pas encore créé."}, status=404)
        serializer = ProfessionalCredentialsSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        assets = (("stamp", "stamp_cloudinary_public_id", "stamp_cloudinary_resource_type", "stamp_cloudinary_version"), ("signature", "signature_cloudinary_public_id", "signature_cloudinary_resource_type", "signature_cloudinary_version"))
        if any(values.get(key) is not None for key, *_ in assets) and not CLOUDINARY_CONFIGURED:
            return Response({"success": False, "message": "Le stockage sécurisé des cachets et signatures n’est pas configuré."}, status=503)
        old_assets = []
        if "professional_identifier" in values:
            profile.professional_identifier = values["professional_identifier"]
        for key, public_field, resource_field, version_field in assets:
            uploaded = values.get(key)
            if uploaded is None:
                continue
            result = cloudinary_upload(uploaded, folder="professional-credentials", public_id=f"{profile.id}/{key}", resource_type="image", delivery_type="private")
            old_public_id = getattr(profile, public_field)
            if old_public_id and old_public_id != result.get("public_id"):
                old_assets.append((old_public_id, getattr(profile, resource_field) or "image"))
            setattr(profile, public_field, result["public_id"])
            setattr(profile, resource_field, "image")
            setattr(profile, version_field, result.get("version"))
        profile.save(update_fields=("professional_identifier", "stamp_cloudinary_public_id", "stamp_cloudinary_resource_type", "stamp_cloudinary_version", "signature_cloudinary_public_id", "signature_cloudinary_resource_type", "signature_cloudinary_version", "updated_at"))
        for public_id, resource_type in old_assets:
            try:
                cloudinary_destroy(public_id, resource_type=resource_type)
            except Exception:
                # Ne jamais exposer un identifiant Cloudinary ni faire échouer la mise à jour déjà enregistrée.
                pass
        return Response({"success": True, "data": {
            "professional_identifier": profile.professional_identifier,
            "stamp_uploaded": bool(profile.stamp_cloudinary_public_id),
            "signature_uploaded": bool(profile.signature_cloudinary_public_id),
        }})


CREDENTIAL_ASSET_FIELDS = {
    "stamp": ("stamp_cloudinary_public_id", "stamp_cloudinary_resource_type", "stamp_cloudinary_version"),
    "signature": ("signature_cloudinary_public_id", "signature_cloudinary_resource_type", "signature_cloudinary_version"),
}


class ProfessionalCredentialAssetView(APIView):
    """Aperçu et retrait du cachet ou de la signature DU professionnel connecté (jamais ceux d'un autre).

    Les fichiers sont privés chez Cloudinary : l'aperçu passe par le serveur, qui ne sert l'image qu'à son propriétaire."""
    permission_classes = [IsAuthenticated]

    def _context(self, request, kind):
        profile = getattr(request.user, "professional_profile", None)
        if kind not in CREDENTIAL_ASSET_FIELDS:
            return None, None, Response({"success": False, "message": "Élément inconnu."}, status=404)
        if not profile:
            return None, None, Response({"success": False, "message": "Le profil professionnel n’est pas encore créé."}, status=404)
        return profile, CREDENTIAL_ASSET_FIELDS[kind], None

    def get(self, request, kind):
        profile, fields, error = self._context(request, kind)
        if error:
            return error
        public_id = getattr(profile, fields[0])
        if not public_id:
            return Response({"success": False, "message": "Aucun fichier déposé."}, status=404)
        if not CLOUDINARY_CONFIGURED:
            return Response({"success": False, "message": "Le stockage sécurisé des cachets et signatures n’est pas configuré."}, status=503)
        try:
            content = cloudinary_download(public_id, resource_type=getattr(profile, fields[1]) or "image", extension="png")
        except Exception:
            return Response({"success": False, "message": "L’aperçu est momentanément indisponible."}, status=502)
        response = HttpResponse(content, content_type="image/png")
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response

    def delete(self, request, kind):
        profile, fields, error = self._context(request, kind)
        if error:
            return error
        public_id, resource_type, _version = (getattr(profile, name) for name in fields)
        if public_id:
            setattr(profile, fields[0], "")
            setattr(profile, fields[1], "image")
            setattr(profile, fields[2], None)
            profile.save(update_fields=(*fields, "updated_at"))
            if CLOUDINARY_CONFIGURED:
                try:
                    cloudinary_destroy(public_id, resource_type=resource_type or "image")
                except Exception:
                    # Le retrait est déjà enregistré : un échec de nettoyage ne doit ni se voir ni être exposé.
                    pass
        return Response({"success": True, "data": {
            "professional_identifier": profile.professional_identifier,
            "stamp_uploaded": bool(profile.stamp_cloudinary_public_id),
            "signature_uploaded": bool(profile.signature_cloudinary_public_id),
        }})


class ProfessionalOnboardingView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request):
        profile, _ = ProfessionalProfile.objects.get_or_create(user=request.user, defaults={"professional_title": "Médecin"})
        serializer = ProfessionalOnboardingSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        specialty_name = serializer.validated_data.get("specialty", "").strip()
        if not specialty_name:
            return Response({"success": False, "message": "Choisissez ou indiquez une spécialité déclarée."}, status=400)
        if specialty_name:
            normalized = " ".join(specialty_name.split()).casefold()
            specialty, _ = ProfessionalSpecialty.objects.get_or_create(
                normalized_name=normalized,
                defaults={"name": " ".join(specialty_name.split()), "created_by": request.user},
            )
            serializer.save(professional_title="Médecin", specialty=specialty.name)
        else:
            serializer.save(professional_title="Médecin")
        context, _ = AccountContext.objects.get_or_create(user=request.user, role="professional")
        context.is_active = True
        context.onboarding_completed = True
        context.save(update_fields=("is_active", "onboarding_completed", "updated_at"))
        return Response({"success": True, "data": ProfessionalProfileSerializer(profile).data})

    def post(self, request):
        # Compatibilité avec les clients de l’onboarding qui soumettent en POST.
        return self.patch(request)

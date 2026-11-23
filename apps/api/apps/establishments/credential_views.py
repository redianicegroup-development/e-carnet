"""Cachet et signature de l'établissement (« Informations administratives »).

Même mécanique que le cachet et la signature du professionnel : scans PNG privés chez Cloudinary, jamais exposés par une URL publique.
L'aperçu passe par le serveur, qui ne sert l'image qu'aux administrateurs actifs de CETTE structure. À la validation d'une consultation,
l'identifiant du fichier est figé sur la consultation : remplacer ou retirer le cachet n'altère jamais ce qui a déjà été signé."""
import uuid

from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event
from apps.cloudinary_storage import CLOUDINARY_CONFIGURED, destroy as cloudinary_destroy, signed_download as cloudinary_download, upload as cloudinary_upload
from apps.professionals.serializers import validate_private_png

from .models import Establishment
from .views import active_administrator

# kind -> (identifiant, type de ressource, version) sur l'établissement.
ASSET_FIELDS = {
    "stamp": ("stamp_cloudinary_public_id", "stamp_cloudinary_resource_type", "stamp_cloudinary_version"),
    "signature": ("signature_cloudinary_public_id", "signature_cloudinary_resource_type", "signature_cloudinary_version"),
}
NOT_ADMIN = {"success": False, "message": "Vous n’êtes pas administrateur de cet établissement actif."}
STORAGE_OFF = {"success": False, "message": "Le stockage sécurisé des cachets et signatures n’est pas configuré."}


class EstablishmentCredentialsSerializer(serializers.Serializer):
    stamp = serializers.ImageField(required=False, allow_null=True)
    signature = serializers.ImageField(required=False, allow_null=True)

    def validate_stamp(self, value):
        return validate_private_png(value, "Le cachet")

    def validate_signature(self, value):
        return validate_private_png(value, "La signature")


def credentials_state(establishment) -> dict:
    return {"stamp_uploaded": bool(establishment.stamp_cloudinary_public_id), "signature_uploaded": bool(establishment.signature_cloudinary_public_id)}


def asset_frozen_on_consultation(public_id: str) -> bool:
    """Vrai si une consultation signée garde ce fichier : il ne doit alors jamais être détruit."""
    if not public_id:
        return False
    from apps.care.models import Consultation
    return Consultation.objects.filter(Q(establishment_stamp_asset_id=public_id) | Q(establishment_signature_asset_id=public_id)).exists()


def destroy_unreferenced_assets(assets) -> None:
    """Détruit chez Cloudinary les fichiers remplacés ou retirés, sauf ceux figés sur une consultation. Un échec reste silencieux."""
    for public_id, resource_type in assets:
        if asset_frozen_on_consultation(public_id):
            continue
        try:
            cloudinary_destroy(public_id, resource_type=resource_type)
        except Exception:
            # Ne jamais exposer un identifiant Cloudinary ni faire échouer la mise à jour déjà enregistrée.
            pass


class EstablishmentCredentialsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, establishment_id):
        admin = active_administrator(request.user, establishment_id)
        if not admin:
            return Response(NOT_ADMIN, status=403)
        return Response({"success": True, "data": credentials_state(admin.establishment)})

    @transaction.atomic
    def patch(self, request, establishment_id):
        admin = active_administrator(request.user, establishment_id)
        if not admin:
            return Response(NOT_ADMIN, status=403)
        serializer = EstablishmentCredentialsSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        if any(values.get(kind) is not None for kind in ASSET_FIELDS) and not CLOUDINARY_CONFIGURED:
            return Response(STORAGE_OFF, status=503)
        establishment = Establishment.objects.select_for_update().get(pk=admin.establishment_id)
        old_assets, changed = [], []
        for kind, (public_field, resource_field, version_field) in ASSET_FIELDS.items():
            uploaded = values.get(kind)
            if uploaded is None:
                continue
            # Identifiant propre à chaque dépôt : remplacer le cachet ne touche jamais celui d'une consultation déjà signée.
            result = cloudinary_upload(uploaded, folder="establishment-credentials", public_id=f"{establishment.id}/{kind}-{uuid.uuid4().hex[:12]}", resource_type="image", delivery_type="private")
            previous = getattr(establishment, public_field)
            if previous and previous != result.get("public_id"):
                old_assets.append((previous, getattr(establishment, resource_field) or "image"))
            setattr(establishment, public_field, result["public_id"])
            setattr(establishment, resource_field, "image")
            setattr(establishment, version_field, result.get("version"))
            changed.append(kind)
        if changed:
            establishment.save(update_fields=[name for fields in ASSET_FIELDS.values() for name in fields] + ["updated_at"])
            record_event(event_type="establishment.credentials.updated", actor=request.user, actor_role="establishment_administrator", establishment=establishment, metadata={"action": "updated", "status": establishment.status})
        destroy_unreferenced_assets(old_assets)
        return Response({"success": True, "data": credentials_state(establishment)})


class EstablishmentCredentialAssetView(APIView):
    """Aperçu et retrait du cachet ou de la signature de la structure (jamais ceux d'une autre)."""
    permission_classes = [IsAuthenticated]

    def _context(self, request, establishment_id, kind):
        if kind not in ASSET_FIELDS:
            return None, Response({"success": False, "message": "Élément inconnu."}, status=404)
        admin = active_administrator(request.user, establishment_id)
        if not admin:
            return None, Response(NOT_ADMIN, status=403)
        return admin.establishment, None

    def get(self, request, establishment_id, kind):
        establishment, error = self._context(request, establishment_id, kind)
        if error:
            return error
        public_field, resource_field, _version = ASSET_FIELDS[kind]
        public_id = getattr(establishment, public_field)
        if not public_id:
            return Response({"success": False, "message": "Aucun fichier déposé."}, status=404)
        if not CLOUDINARY_CONFIGURED:
            return Response(STORAGE_OFF, status=503)
        try:
            content = cloudinary_download(public_id, resource_type=getattr(establishment, resource_field) or "image", extension="png")
        except Exception:
            return Response({"success": False, "message": "L’aperçu est momentanément indisponible."}, status=502)
        response = HttpResponse(content, content_type="image/png")
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response

    @transaction.atomic
    def delete(self, request, establishment_id, kind):
        establishment, error = self._context(request, establishment_id, kind)
        if error:
            return error
        public_field, resource_field, version_field = ASSET_FIELDS[kind]
        public_id, resource_type = getattr(establishment, public_field), getattr(establishment, resource_field)
        if public_id:
            setattr(establishment, public_field, "")
            setattr(establishment, resource_field, "image")
            setattr(establishment, version_field, None)
            establishment.save(update_fields=[public_field, resource_field, version_field, "updated_at"])
            record_event(event_type="establishment.credentials.removed", actor=request.user, actor_role="establishment_administrator", establishment=establishment, metadata={"action": "removed", "status": establishment.status})
            if CLOUDINARY_CONFIGURED:
                destroy_unreferenced_assets([(public_id, resource_type or "image")])
        return Response({"success": True, "data": credentials_state(establishment)})

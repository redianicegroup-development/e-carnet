import hashlib
import hmac
import uuid
from django.conf import settings
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.audit.services import record_event
from .models import ClinicalDeclaration, PatientEmergencyCard, PatientProfile
from .serializers import ClinicalDeclarationSerializer, PatientEmergencyCardSerializer, PatientProfileSerializer


def profile_for(user):
    profile, _ = PatientProfile.objects.get_or_create(user=user)
    return profile


class PatientProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"success": True, "data": PatientProfileSerializer(profile_for(request.user)).data})

    def patch(self, request):
        profile = profile_for(request.user)
        serializer = PatientProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"success": True, "data": serializer.data})


class DeclarationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = ClinicalDeclaration.objects.filter(patient=profile_for(request.user), status="declared")
        return Response({"success": True, "data": ClinicalDeclarationSerializer(items, many=True).data})

    @transaction.atomic
    def post(self, request):
        serializer = ClinicalDeclarationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data["kind"] == "blood_group":
            patient = profile_for(request.user)
            ClinicalDeclaration.objects.filter(patient=patient, kind="blood_group", status="declared").update(status="cancelled")
            previous = ClinicalDeclaration.objects.filter(patient=patient, kind="blood_group", label=serializer.validated_data["label"]).first()
            if previous:
                previous.details = serializer.validated_data.get("details", "")
                previous.status = "declared"
                previous.save(update_fields=("details", "status", "updated_at"))
                return Response({"success": True, "data": ClinicalDeclarationSerializer(previous).data}, status=status.HTTP_200_OK)
        try:
            item = ClinicalDeclaration.objects.create(patient=profile_for(request.user), **serializer.validated_data)
        except IntegrityError:
            return Response({"success": False, "message": "Cette déclaration existe déjà."}, status=status.HTTP_409_CONFLICT)
        record_event(event_type="clinical_declaration.created", actor=request.user, actor_role="patient", patient=item.patient, metadata={"action": "created", "declaration_id": str(item.id), "status": item.status})
        return Response({"success": True, "data": ClinicalDeclarationSerializer(item).data}, status=status.HTTP_201_CREATED)


class DeclarationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def delete(self, request, pk):
        item = ClinicalDeclaration.objects.filter(pk=pk, patient=profile_for(request.user), status="declared").first()
        if not item:
            return Response({"success": False, "message": "Déclaration introuvable."}, status=status.HTTP_404_NOT_FOUND)
        item.status = "cancelled"
        item.save(update_fields=("status", "updated_at"))
        record_event(event_type="clinical_declaration.cancelled", actor=request.user, actor_role="patient", patient=item.patient, metadata={"action": "cancelled", "declaration_id": str(item.id), "status": item.status})
        return Response({"success": True, "data": {"id": str(item.id), "status": item.status}})


def qr_signature(card_id, version):
    message = f"ecarnet-emergency-v1:{card_id}:{version}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()


def emergency_card_data(card, *, public=False):
    declarations = ClinicalDeclaration.objects.filter(patient=card.patient, status="declared")
    blood = declarations.filter(kind="blood_group").order_by("-updated_at").first()
    data = {
        "blood_group": blood.label if blood else "",
        "allergies": list(declarations.filter(kind="allergy").values("label", "details")),
        "treatments": list(declarations.filter(kind="treatment").values("label", "details")),
        "contact_name": card.contact_name,
        "contact_phone": card.contact_phone,
    }
    if not public:
        data.update({
            "qr_enabled": card.qr_enabled,
            "qr_token": f"{card.id}.{card.qr_version}.{qr_signature(card.id, card.qr_version)}" if card.qr_enabled else "",
        })
    return data


class PatientEmergencyCardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        card, _ = PatientEmergencyCard.objects.get_or_create(patient=profile_for(request.user))
        return Response({"success": True, "data": emergency_card_data(card)})

    def patch(self, request):
        card, _ = PatientEmergencyCard.objects.get_or_create(patient=profile_for(request.user))
        serializer = PatientEmergencyCardSerializer(card, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        enabling = serializer.validated_data.get("qr_enabled")
        if enabling is not None and enabling != card.qr_enabled:
            card.qr_version += 1
        serializer.save()
        record_event(
            event_type="patient.emergency_card.updated",
            actor=request.user,
            actor_role="patient",
            patient=card.patient,
            metadata={"action": "updated", "scope": sorted(serializer.validated_data.keys()), "resource_type": "emergency_card", "resource_id": str(card.id)},
        )
        return Response({"success": True, "data": emergency_card_data(card)})

    def post(self, request):
        card, _ = PatientEmergencyCard.objects.get_or_create(patient=profile_for(request.user))
        card.qr_version += 1
        card.qr_enabled = True
        card.save(update_fields=("qr_version", "qr_enabled", "updated_at"))
        record_event(event_type="patient.emergency_card.qr_rotated", actor=request.user, actor_role="patient", patient=card.patient, metadata={"action": "qr_rotated", "resource_type": "emergency_card", "resource_id": str(card.id)})
        return Response({"success": True, "data": emergency_card_data(card)})


class EmergencyCardQrView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            raw_id, raw_version, signature = token.split(".", 2)
            card_id = uuid.UUID(raw_id)
            version = int(raw_version)
        except (ValueError, AttributeError, TypeError):
            return Response({"success": False, "message": "Cette carte d’urgence n’est pas disponible."}, status=status.HTTP_404_NOT_FOUND)
        card = PatientEmergencyCard.objects.select_related("patient").filter(pk=card_id, qr_enabled=True, qr_version=version).first()
        if not card or not hmac.compare_digest(signature, qr_signature(card.id, version)):
            return Response({"success": False, "message": "Cette carte d’urgence n’est pas disponible."}, status=status.HTTP_404_NOT_FOUND)
        response = Response({"success": True, "data": emergency_card_data(card, public=True)})
        response["Cache-Control"] = "private, no-store, max-age=0"
        response["X-Robots-Tag"] = "noindex, nofollow, noarchive"
        response["Referrer-Policy"] = "no-referrer"
        return response

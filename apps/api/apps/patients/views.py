from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.audit.services import record_event
from .models import ClinicalDeclaration, PatientProfile
from .serializers import ClinicalDeclarationSerializer, PatientProfileSerializer


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

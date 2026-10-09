from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.models import AccountContext
from .models import ProfessionalProfile, ProfessionalSpecialty
from .serializers import ProfessionalOnboardingSerializer, ProfessionalProfileSerializer


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


from django.db.models import Prefetch, Q
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event
from apps.care.models import CareEncounter, Consultation
from apps.care.serializers import CareEncounterSerializer, ConsultationSerializer
from apps.patients.models import PatientProfile

from .views import active_administrator


class EstablishmentPatientRecordSerializer(serializers.ModelSerializer):
    first_name = serializers.SerializerMethodField()
    last_name = serializers.SerializerMethodField()
    encounters = CareEncounterSerializer(many=True, read_only=True)
    consultations = ConsultationSerializer(many=True, read_only=True)

    class Meta:
        model = PatientProfile
        fields = ("id", "first_name", "last_name", "birth_date", "encounters", "consultations")
        read_only_fields = fields

    def get_first_name(self, obj):
        return obj.display_first_name()

    def get_last_name(self, obj):
        return obj.display_last_name()


class EstablishmentPatientRecordsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, establishment_id):
        administrator = active_administrator(request.user, establishment_id)
        if not administrator:
            return Response({"success": False, "message": "Accès réservé à l’administrateur actif de cet établissement."}, status=403)

        establishment = administrator.establishment
        encounters = CareEncounter.objects.filter(establishment=establishment).prefetch_related("revisions")
        consultations = Consultation.objects.filter(establishment=establishment).filter(
            Q(access_grant__isnull=True) | Q(access_grant__establishment=establishment)
        ).select_related("access_grant").prefetch_related("prescription_lines", "exam_requests")
        patients = (
            PatientProfile.objects.filter(
                Q(encounters__in=encounters)
                | Q(consultations__in=consultations)
            )
            .distinct()
            .select_related("user")
            .prefetch_related(
                Prefetch("encounters", queryset=encounters),
                Prefetch("consultations", queryset=consultations),
            )
        )

        for patient in patients:
            record_event(
                event_type="clinical_data.read",
                actor=request.user,
                actor_role="establishment_admin",
                patient=patient,
                establishment=establishment,
                metadata={
                    "action": "read_establishment_records",
                    "resource_type": "patient_record",
                    "resource_count": len(patient.encounters.all()) + len(patient.consultations.all()),
                },
            )

        return Response({"success": True, "data": EstablishmentPatientRecordSerializer(patients, many=True).data})

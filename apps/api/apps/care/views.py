from datetime import date
import uuid
from django.conf import settings
from django.db import transaction
from django.db.models import Q, Sum
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from apps.identity.throttles import WriteScopedThrottle
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView
from apps.patients.models import ClinicalDeclaration, PatientProfile
from apps.patients.views import patient_actor_role, profile_for
from apps.professionals.access import professional_clinical_access_error
from apps.professionals.models import ProfessionalProfile
from apps.audit.models import AuditEvent
from apps.audit.services import record_event
from apps.cloudinary_storage import CLOUDINARY_CONFIGURED, destroy as cloudinary_destroy, extension_from_name, signed_download, upload as cloudinary_upload
from .models import AccessGrant, Appointment, CareEncounter, Consultation, ExamRequest, FollowUpPlan, FollowUpPlanItem, HealthMeasurement, MedicalDocument, MedicationIntake, MedicationReminder, PatientNotification, PreconsultationTemplate, Vaccination
from .serializers import AccessGrantSerializer, AppointmentSerializer, CareEncounterSerializer, ConsultationSerializer, FollowUpPlanSerializer, HealthMeasurementSerializer, MedicalDocumentSerializer, MedicationIntakeSerializer, MedicationReminderSerializer, PatientNotificationSerializer, PreconsultationTemplateSerializer, ProfessionalAccessGrantSerializer, ProfessionalConsultationCreateSerializer, VaccinationSerializer
from .services import QR_TOKEN_TTL_SECONDS, create_patient_qr_token, create_professional_grant, require_scope
from .consultation_services import validate_consultation


class EncounterListCreateView(APIView):
    """Pré-consultation du patient : un brouillon, sans établissement.

    Le patient — ou un infirmier qui prend son téléphone, sans compte — ne choisit aucun établissement et ne clôture rien.
    Le brouillon reste modifiable jusqu’à ce qu’un médecin, qui l’a lu grâce au QR du patient, termine sa consultation :
    c’est cette signature qui clôture le brouillon et le rattache à l’établissement du médecin."""
    permission_classes = [IsAuthenticated]
    def get(self, request):
        items = CareEncounter.objects.filter(patient=profile_for(request.user, request))
        return Response({"success": True, "data": CareEncounterSerializer(items, many=True).data})
    @transaction.atomic
    def post(self, request):
        serializer = CareEncounterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient = profile_for(request.user, request)
        # Un seul brouillon à la fois : le médecin lit « la dernière pré-consultation », elle ne doit pas être ambiguë.
        # Le verrou sérialise deux créations simultanées du même patient (deux appareils, ou la personne qui aide + le patient).
        patient = PatientProfile.objects.select_for_update().get(pk=patient.pk)
        if CareEncounter.objects.filter(patient=patient, status="draft").exists():
            return Response({"success": False, "message": "Une pré-consultation est déjà en préparation. Modifiez-la : le médecin lira la dernière version."}, status=status.HTTP_409_CONFLICT)
        item = CareEncounter.objects.create(patient=patient, **serializer.validated_data)
        record_event(event_type="preconsultation.created", actor=request.user, actor_role=patient_actor_role(request), patient=item.patient, metadata={"action": "created", "encounter_id": str(item.id), "status": item.status})
        return Response({"success": True, "data": CareEncounterSerializer(item).data}, status=status.HTTP_201_CREATED)


class EncounterDetailView(APIView):
    """Lecture et modification d’un brouillon. Pas de clôture ici : seul le médecin clôture, en signant sa consultation."""
    permission_classes = [IsAuthenticated]
    def get_object(self, request, pk):
        return CareEncounter.objects.filter(pk=pk, patient=profile_for(request.user, request)).first()
    def get(self, request, pk):
        item = self.get_object(request, pk)
        if not item:
            return Response({"success": False, "message": "Prise en charge introuvable."}, status=404)
        return Response({"success": True, "data": CareEncounterSerializer(item).data})
    @transaction.atomic
    def patch(self, request, pk):
        item = CareEncounter.objects.select_for_update().filter(pk=pk, patient=profile_for(request.user, request)).first()
        if not item:
            return Response({"success": False, "message": "Prise en charge introuvable."}, status=404)
        if item.status == "closed":
            return Response({"success": False, "message": "Cette pré-consultation a été clôturée par le médecin et est conservée telle quelle."}, status=409)
        serializer = CareEncounterSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_event(event_type="preconsultation.updated", actor=request.user, actor_role=patient_actor_role(request), patient=item.patient, metadata={"action": "updated", "encounter_id": str(item.id), "status": item.status})
        return Response({"success": True, "data": serializer.data})


class PatientAccessGrantListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        items = AccessGrant.objects.filter(patient=profile_for(request.user, request))
        for item in items:
            item.refresh_expiration()
        return Response({"success": True, "data": AccessGrantSerializer(items, many=True).data})


DOCUMENT_FORMATS = {
    ".pdf": (b"%PDF-", "application/pdf"),
    ".png": (b"\x89PNG\r\n\x1a\n", "image/png"),
    ".jpg": (b"\xff\xd8\xff", "image/jpeg"),
    ".jpeg": (b"\xff\xd8\xff", "image/jpeg"),
    ".webp": (b"RIFF", "image/webp"),
}
DOCUMENT_MAX_SIZE = 10 * 1024 * 1024
DOCUMENT_TOTAL_MAX_SIZE = 200 * 1024 * 1024
DOCUMENT_MAX_COUNT = 100


def _document_signature(uploaded, extension):
    uploaded.seek(0)
    head = uploaded.read(16)
    uploaded.seek(0)
    signature, content_type = DOCUMENT_FORMATS.get(extension, (None, None))
    if not signature or not head.startswith(signature):
        return None
    if content_type == "image/webp" and head[8:12] != b"WEBP":
        return None
    return content_type


def _document_response_bytes(item):
    if item.cloudinary_public_id:
        return signed_download(item.cloudinary_public_id, resource_type=item.cloudinary_resource_type or "image", extension=extension_from_name(item.original_name))
    if item.file:
        return item.file.open("rb").read()
    raise RuntimeError("missing document asset")


class PatientMedicalDocumentListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "documents_upload"

    def get(self, request):
        patient = profile_for(request.user, request)
        items = MedicalDocument.objects.filter(patient=patient)
        return Response({"success": True, "data": MedicalDocumentSerializer(items, many=True).data})

    @transaction.atomic
    def post(self, request):
        uploaded = request.FILES.get("file")
        if not uploaded:
            raise ValidationError({"file": "Sélectionnez un fichier PDF, PNG, JPG/JPEG ou WebP."})
        filename = uploaded.name.rsplit("/", 1)[-1].replace("\\", "_")
        extension = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        try:
            uploaded.seek(0, 2)
            actual_size = uploaded.tell()
            uploaded.seek(0)
        except (AttributeError, OSError):
            actual_size = uploaded.size
        if actual_size > DOCUMENT_MAX_SIZE:
            raise ValidationError({"file": "Le fichier ne doit pas dépasser 10 MiB (10 × 1024² octets)."})
        content_type = _document_signature(uploaded, extension)
        if not content_type:
            raise ValidationError({"file": "Format refusé : l’extension et la signature réelle du fichier doivent correspondre à PDF, PNG, JPG/JPEG ou WebP."})
        document_type = request.data.get("document_type", "other")
        valid_types = {choice[0] for choice in MedicalDocument.KIND_CHOICES}
        if document_type not in valid_types:
            raise ValidationError({"document_type": "Type de document invalide."})
        document_date = request.data.get("document_date") or None
        if document_date:
            try:
                date.fromisoformat(str(document_date))
            except ValueError:
                raise ValidationError({"document_date": "Date invalide."})
        patient = PatientProfile.objects.select_for_update().get(pk=profile_for(request.user, request).pk)
        existing = MedicalDocument.objects.filter(patient=patient)
        if existing.count() >= DOCUMENT_MAX_COUNT:
            raise ValidationError({"file": "La limite de 100 documents par patient est atteinte."})
        current_total = existing.aggregate(total=Sum("size_bytes"))["total"] or 0
        if current_total + actual_size > DOCUMENT_TOTAL_MAX_SIZE:
            raise ValidationError({"file": "Le quota cumulé de 200 MiB par patient serait dépassé."})

        exam_request = None
        exam_request_id = request.data.get("exam_request_id")
        if exam_request_id:
            exam_request = ExamRequest.objects.select_for_update().filter(
                pk=exam_request_id, consultation__patient=patient, status="requested",
            ).first()
            if not exam_request:
                raise ValidationError({"exam_request_id": "L’examen doit être ouvert et appartenir à votre dossier."})

        values = dict(patient=patient, exam_request=exam_request, original_name=filename[:180], document_type=document_type,
                      document_date=document_date, issuer=str(request.data.get("issuer", ""))[:180],
                      content_type=content_type, size_bytes=actual_size)
        if CLOUDINARY_CONFIGURED:
            uploaded.seek(0)
            result = cloudinary_upload(uploaded, folder="medical-documents", public_id=f"{patient.id}/{uuid.uuid4()}", resource_type="raw" if content_type == "application/pdf" else "image")
            values.update(cloudinary_public_id=result["public_id"], cloudinary_resource_type="raw" if content_type == "application/pdf" else "image", cloudinary_version=result.get("version"))
        elif settings.DEBUG or getattr(settings, "RUNNING_TESTS", False):
            uploaded.seek(0)
            values["file"] = uploaded
        else:
            raise ValidationError({"file": "Le stockage Cloudinary n’est pas configuré."})
        item = MedicalDocument.objects.create(**values)
        if exam_request:
            ExamRequest.objects.filter(pk=exam_request.pk, status="requested").update(status="result_received")
        record_event(event_type="medical_document.uploaded", actor=request.user, actor_role=patient_actor_role(request), patient=patient, metadata={"action": "uploaded", "document_id": str(item.id), "size_bytes": item.size_bytes})
        return Response({"success": True, "data": MedicalDocumentSerializer(item).data}, status=status.HTTP_201_CREATED)


class PatientMedicalDocumentDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        item = MedicalDocument.objects.filter(pk=pk, patient=profile_for(request.user, request)).first()
        if not item or (not item.file and not item.cloudinary_public_id):
            return Response({"success": False, "message": "Document introuvable."}, status=404)
        record_event(event_type="medical_document.read", actor=request.user, actor_role=patient_actor_role(request), patient=item.patient, metadata={"action": "read", "document_id": str(item.id), "resource_type": "medical_document"})
        try:
            if item.cloudinary_public_id:
                response = HttpResponse(_document_response_bytes(item), content_type=item.content_type)
            else:
                response = FileResponse(item.file.open("rb"), content_type=item.content_type)
        except Exception:
            return Response({"success": False, "message": "Document temporairement indisponible."}, status=502)
        response["Content-Disposition"] = f'attachment; filename="{item.original_name.replace(chr(34), "")}"'
        response["X-Content-Type-Options"] = "nosniff"
        return response


class PatientMedicalDocumentDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def delete(self, request, pk):
        item = MedicalDocument.objects.select_for_update().filter(pk=pk, patient=profile_for(request.user, request)).first()
        if not item:
            return Response({"success": False, "message": "Document introuvable."}, status=404)
        try:
            if item.cloudinary_public_id:
                cloudinary_destroy(item.cloudinary_public_id, resource_type=item.cloudinary_resource_type or "image")
        except Exception:
            record_event(event_type="medical_document.delete_failed", actor=request.user, actor_role=patient_actor_role(request), patient=item.patient, metadata={"action": "delete_failed", "document_id": str(item.id), "resource_type": item.cloudinary_resource_type or "image"})
            return Response({"success": False, "message": "Cloudinary a refusé la suppression : le document est conservé, aucune référence n’a été effacée."}, status=502)
        exam_request = item.exam_request
        if item.file:
            item.file.delete(save=False)
        Vaccination.objects.filter(document=item, status="documented").update(status="declared")
        item.delete()
        if exam_request and not MedicalDocument.objects.filter(exam_request=exam_request).exists():
            ExamRequest.objects.filter(pk=exam_request.pk, status="result_received").update(status="requested")
        record_event(event_type="medical_document.deleted", actor=request.user, actor_role=patient_actor_role(request), patient=profile_for(request.user, request), metadata={"action": "deleted", "document_id": str(pk), "resource_type": "medical_document"})
        return Response({"success": True, "message": "Document supprimé."})


def _professional_document_grant(request, grant_id):
    profile = getattr(request.user, "professional_profile", None)
    access_error = professional_clinical_access_error(profile)
    if access_error:
        return None, Response({"success": False, "message": access_error}, status=403)
    grant = AccessGrant.objects.filter(pk=grant_id, professional=profile, establishment=profile.active_establishment).select_related("patient", "establishment").first()
    if not grant:
        return None, Response({"success": False, "message": "AccessGrant introuvable dans votre périmètre."}, status=404)
    try:
        require_scope(grant, "documents")
    except PermissionDenied as exc:
        return None, Response({"success": False, "message": str(exc.detail)}, status=403)
    return grant, None


class ProfessionalMedicalDocumentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, grant_id):
        grant, error = _professional_document_grant(request, grant_id)
        if error:
            return error
        items = MedicalDocument.objects.filter(patient=grant.patient)
        record_event(event_type="clinical_data.read", actor=request.user, actor_role="professional", patient=grant.patient, establishment=grant.establishment, access_grant=grant, metadata={"action": "read_documents", "resource_type": "medical_document", "resource_count": items.count()})
        data = MedicalDocumentSerializer(items, many=True).data
        for row in data:
            row["download_url"] = f"/api/v1/patient/care/professional/access-grants/{grant.id}/documents/{row['id']}/download/"
        return Response({"success": True, "data": data})


class ProfessionalMedicalDocumentDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, grant_id, pk):
        grant, error = _professional_document_grant(request, grant_id)
        if error:
            return error
        item = MedicalDocument.objects.filter(pk=pk, patient=grant.patient).first()
        if not item or (not item.file and not item.cloudinary_public_id):
            return Response({"success": False, "message": "Document introuvable."}, status=404)
        try:
            if item.cloudinary_public_id:
                response = HttpResponse(_document_response_bytes(item), content_type=item.content_type)
            else:
                response = FileResponse(item.file.open("rb"), content_type=item.content_type)
        except Exception:
            return Response({"success": False, "message": "Document temporairement indisponible."}, status=502)
        record_event(event_type="medical_document.read", actor=request.user, actor_role="professional", patient=grant.patient, establishment=grant.establishment, access_grant=grant, metadata={"action": "read", "document_id": str(item.id), "resource_type": "medical_document"})
        response["Content-Disposition"] = f'attachment; filename="{item.original_name.replace(chr(34), "")}"'
        response["X-Content-Type-Options"] = "nosniff"
        return response


class PatientVaccinationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = Vaccination.objects.filter(patient=profile_for(request.user, request))
        return Response({"success": True, "data": VaccinationSerializer(items, many=True).data})

    def post(self, request):
        serializer = VaccinationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient = profile_for(request.user, request)
        values = dict(serializer.validated_data)
        document = values.pop("document", None)
        if document and (document.patient_id != patient.pk or document.document_type != "vaccination"):
            raise ValidationError({"document_id": "Choisissez un justificatif de vaccination appartenant à votre dossier."})
        values["document"] = document
        values["status"] = "documented" if document else "declared"
        item = Vaccination.objects.create(patient=patient, **values)
        record_event(event_type="vaccination.declared", actor=request.user, actor_role=patient_actor_role(request), patient=patient, metadata={"action": "declared", "vaccination_id": str(item.id), "status": item.status})
        return Response({"success": True, "data": VaccinationSerializer(item).data}, status=status.HTTP_201_CREATED)


class PatientMeasurementListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        patient = profile_for(request.user, request)
        items = HealthMeasurement.objects.filter(patient=patient)
        kind = request.query_params.get("kind")
        if kind:
            items = items.filter(kind=kind)
        return Response({"success": True, "data": HealthMeasurementSerializer(items[:300], many=True).data})

    def post(self, request):
        serializer = HealthMeasurementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient = profile_for(request.user, request)
        item = HealthMeasurement.objects.create(patient=patient, **serializer.validated_data)
        record_event(event_type="health_measurement.created", actor=request.user, actor_role=patient_actor_role(request), patient=patient, metadata={"action": "created", "measurement_id": str(item.id), "kind": item.kind, "source": item.source})
        return Response({"success": True, "data": HealthMeasurementSerializer(item).data}, status=201)


class PatientFollowUpPlanListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        patient = profile_for(request.user, request)
        items = FollowUpPlan.objects.filter(patient=patient).prefetch_related("items")
        return Response({"success": True, "data": FollowUpPlanSerializer(items, many=True).data})


class ProfessionalFollowUpPlanCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = ProfessionalProfile.objects.filter(user=request.user).first()
        error = professional_clinical_access_error(profile)
        if error:
            return Response({"success": False, "message": error}, status=403)
        grant = AccessGrant.objects.filter(pk=request.data.get("access_grant_id"), professional=profile, status="active").first()
        if not grant or "consultations" not in (grant.scope or []):
            return Response({"success": False, "message": "Un consentement de suivi avec le périmètre consultations est requis."}, status=403)
        title = str(request.data.get("title", "")).strip()
        if not title:
            raise ValidationError({"title": "Indiquez le titre du plan de suivi."})
        plan = FollowUpPlan.objects.create(patient=grant.patient, professional=profile, establishment=profile.active_establishment, title=title[:180], instructions=str(request.data.get("instructions", ""))[:2000], starts_on=request.data.get("starts_on") or None, ends_on=request.data.get("ends_on") or None)
        items = request.data.get("items") or []
        if not isinstance(items, list) or len(items) > 12:
            raise ValidationError({"items": "Un plan peut contenir au maximum 12 mesures."})
        for item in items:
            FollowUpPlanItem.objects.create(plan=plan, measurement_kind=item.get("measurement_kind"), frequency=str(item.get("frequency", ""))[:120], target=str(item.get("target", ""))[:160], notes=str(item.get("notes", ""))[:300])
        record_event(event_type="follow_up_plan.created", actor=request.user, actor_role="professional", patient=plan.patient, establishment=plan.establishment, access_grant=grant, metadata={"action": "created", "plan_id": str(plan.id)})
        return Response({"success": True, "data": FollowUpPlanSerializer(plan).data}, status=201)


class PatientMedicationReminderListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        patient = profile_for(request.user, request)
        return Response({"success": True, "data": MedicationReminderSerializer(MedicationReminder.objects.filter(patient=patient), many=True).data})

    def post(self, request):
        serializer = MedicationReminderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient = profile_for(request.user, request)
        reminder = MedicationReminder.objects.create(patient=patient, **serializer.validated_data)
        PatientNotification.objects.create(patient=patient, kind="medication.created", title="Rappel de médicament enregistré", body=f"Le rappel pour {reminder.name} est actif.", metadata={"reminder_id": str(reminder.id)})
        return Response({"success": True, "data": MedicationReminderSerializer(reminder).data}, status=201)


class PatientMedicationReminderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        reminder = MedicationReminder.objects.filter(pk=pk, patient=profile_for(request.user, request)).first()
        if not reminder:
            return Response({"success": False, "message": "Rappel introuvable."}, status=404)
        serializer = MedicationReminderSerializer(reminder, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"success": True, "data": serializer.data})


class PatientMedicationIntakeCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, reminder_id):
        reminder = MedicationReminder.objects.filter(pk=reminder_id, patient=profile_for(request.user, request)).first()
        if not reminder:
            return Response({"success": False, "message": "Rappel introuvable."}, status=404)
        serializer = MedicationIntakeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        intake, _ = MedicationIntake.objects.update_or_create(reminder=reminder, scheduled_for=serializer.validated_data["scheduled_for"], defaults={"status": serializer.validated_data["status"]})
        return Response({"success": True, "data": MedicationIntakeSerializer(intake).data}, status=201)


class PatientNotificationInboxView(APIView):
    """Résumé privé destiné à la cloche de l’espace patient."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = PatientNotification.objects.filter(patient=profile_for(request.user, request))
        unread_count = notifications.filter(read_at__isnull=True).count()
        recent = notifications.order_by("-created_at")[:10]
        response = Response({
            "success": True,
            "data": {
                "items": PatientNotificationSerializer(recent, many=True).data,
                "unread_count": unread_count,
            },
        })
        response["Cache-Control"] = "private, no-store"
        return response


class PatientNotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        patient = profile_for(request.user, request)
        return Response({"success": True, "data": PatientNotificationSerializer(PatientNotification.objects.filter(patient=patient)[:100], many=True).data})

    def patch(self, request, pk):
        item = PatientNotification.objects.filter(pk=pk, patient=profile_for(request.user, request)).first()
        if not item:
            return Response({"success": False, "message": "Notification introuvable."}, status=404)
        item.read_at = timezone.now()
        item.save(update_fields=("read_at",))
        return Response({"success": True, "data": PatientNotificationSerializer(item).data})


class PatientAppointmentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        patient = profile_for(request.user, request)
        return Response({"success": True, "data": AppointmentSerializer(Appointment.objects.filter(patient=patient), many=True).data})

    def post(self, request):
        serializer = AppointmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient = profile_for(request.user, request)
        appointment = Appointment.objects.create(patient=patient, **serializer.validated_data)
        PatientNotification.objects.create(patient=patient, kind="appointment.created", title="Demande de rendez-vous enregistrée", body=f"Votre demande « {appointment.reason} » a été enregistrée.", metadata={"appointment_id": str(appointment.id)})
        return Response({"success": True, "data": AppointmentSerializer(appointment).data}, status=201)


class PatientAppointmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        appointment = Appointment.objects.filter(pk=pk, patient=profile_for(request.user, request)).first()
        if not appointment:
            return Response({"success": False, "message": "Rendez-vous introuvable."}, status=404)
        if request.data.get("status") == "cancelled" and appointment.status in ("requested", "confirmed"):
            appointment.status = "cancelled"; appointment.save(update_fields=("status", "updated_at"))
            return Response({"success": True, "data": AppointmentSerializer(appointment).data})
        return Response({"success": False, "message": "Cette modification n’est pas disponible."}, status=409)


class PatientCarnetExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from io import BytesIO
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        patient = profile_for(request.user, request)
        buffer = BytesIO(); pdf = canvas.Canvas(buffer, pagesize=A4); width, height = A4; y = height - 54
        pdf.setFont("Helvetica-Bold", 18); pdf.drawString(48, y, "MON CARNET NUMERIQUE"); y -= 28
        pdf.setFont("Helvetica", 10); pdf.drawString(48, y, f"Titulaire : {patient.user.get_full_name() or patient.user.email}"); y -= 24
        rows = [("Déclarations", ClinicalDeclaration.objects.filter(patient=patient).values_list("label", flat=True)), ("Vaccinations", Vaccination.objects.filter(patient=patient).values_list("vaccine_name", "administered_on")), ("Mesures récentes", HealthMeasurement.objects.filter(patient=patient)[:30].values_list("kind", "value", "unit", "measured_at"))]
        for title, values in rows:
            pdf.setFont("Helvetica-Bold", 12); pdf.drawString(48, y, title); y -= 18; pdf.setFont("Helvetica", 9)
            for value in values:
                text = " · ".join(str(part or "")[:60] for part in (value if isinstance(value, tuple) else (value,)))
                pdf.drawString(58, y, text[:105]); y -= 13
                if y < 60: pdf.showPage(); y = height - 54; pdf.setFont("Helvetica", 9)
            y -= 10
        pdf.setFont("Helvetica-Oblique", 8); pdf.drawString(48, 40, "Export volontaire généré par Mon E-Carnet. Vérifiez la date et la provenance des informations."); pdf.save()
        record_event(event_type="patient.carnet.exported", actor=request.user, actor_role=patient_actor_role(request), patient=patient, metadata={"action": "exported", "resource_type": "patient_carnet_pdf"})
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf"); response["Content-Disposition"] = f'attachment; filename="carnet-{patient.id}.pdf"'; response["Cache-Control"] = "private, no-store"; return response


class EstablishmentPreconsultationTemplateListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def _establishment(self, request, establishment_id):
        from apps.establishments.views import active_administrator
        admin = active_administrator(request.user, establishment_id)
        return admin.establishment if admin else None

    def get(self, request, establishment_id):
        establishment = self._establishment(request, establishment_id)
        if not establishment: return Response({"success": False, "message": "Accès établissement refusé."}, status=403)
        return Response({"success": True, "data": PreconsultationTemplateSerializer(PreconsultationTemplate.objects.filter(establishment=establishment), many=True).data})

    def post(self, request, establishment_id):
        establishment = self._establishment(request, establishment_id)
        if not establishment: return Response({"success": False, "message": "Accès établissement refusé."}, status=403)
        serializer = PreconsultationTemplateSerializer(data=request.data); serializer.is_valid(raise_exception=True); item = serializer.save(establishment=establishment)
        return Response({"success": True, "data": PreconsultationTemplateSerializer(item).data}, status=201)


class PatientAccessQrCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "qr_create"

    def post(self, request):
        raw = create_patient_qr_token(patient=profile_for(request.user, request))
        return Response({"success": True, "data": {"token": raw, "expires_in_seconds": QR_TOKEN_TTL_SECONDS, "scope": ["preconsultation", "declarations"]}})


class PatientAccessAuditView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        events = (
            AuditEvent.objects.filter(patient=profile_for(request.user, request)).filter(Q(event_type__startswith="access_grant.") | Q(event_type="clinical_data.read"))
            .select_related("access_grant")
            .order_by("-created_at")[:100]
        )
        data = []
        for event in events:
            grant = event.access_grant
            metadata = event.metadata or {}
            data.append({
                "id": str(event.id),
                "event_type": event.event_type,
                "action": metadata.get("action", event.event_type.rsplit(".", 1)[-1]),
                "status": metadata.get("status"),
                "resource_type": metadata.get("resource_type"),
                "resource_count": metadata.get("resource_count"),
                "extension_count": metadata.get("extension_count"),
                "authorized_until": metadata.get("authorized_until"),
                "access_duration_minutes": metadata.get("access_duration_minutes"),
                "professional_name": grant.professional_name if grant else "Professionnel",
                "facility_label": grant.facility_label if grant else "Établissement",
                "created_at": event.created_at,
            })
        return Response({"success": True, "data": data})


class PatientAccessGrantActionView(APIView):
    permission_classes = [IsAuthenticated]
    @transaction.atomic
    def post(self, request, pk, action):
        # Serialize the whole state transition. A stale extend must never rewrite a concurrent revoke.
        item = AccessGrant.objects.select_for_update(of=("self",)).select_related("patient", "establishment").filter(pk=pk, patient=profile_for(request.user, request)).first()
        if not item:
            return Response({"success": False, "message": "Demande d’accès introuvable."}, status=404)
        now = timezone.now()
        if item.status in ("pending", "active") and item.expires_at and item.expires_at <= now:
            item.status = "expired"
            item.save(update_fields=("status",))
            AuditEvent.objects.create(event_type="access_grant.expired", actor=None, actor_role="system", patient=item.patient, establishment=item.establishment, access_grant=item, metadata={"action": "expired", "status": "expired"})
            PatientNotification.objects.create(patient=item.patient, kind="access.expired", title="Un accès a expiré", body=f"L’accès de {item.professional_name} à {item.facility_label} a expiré.", metadata={"access_grant_id": str(item.id)})
            return Response({"success": False, "message": "Cette autorisation a expiré."}, status=409)
        update_fields = []
        if action == "accept" and item.status == "pending":
            item.status, item.starts_at, item.expires_at = "active", now, now + timezone.timedelta(hours=2)
            update_fields = ["status", "starts_at", "expires_at"]
        elif action == "refuse" and item.status == "pending":
            item.status, item.refused_at = "refused", now
            update_fields = ["status", "refused_at"]
        elif action == "revoke" and item.status == "active":
            item.status, item.revoked_at = "revoked", now
            update_fields = ["status", "revoked_at"]
        elif action == "extend" and item.status == "active":
            if item.extension_count >= 2 or not item.expires_at:
                return Response({"success": False, "message": "La durée maximale de quatre heures est atteinte."}, status=409)
            item.extension_count += 1
            item.expires_at = item.expires_at + timezone.timedelta(hours=1)
            update_fields = ["extension_count", "expires_at"]
        else:
            return Response({"success": False, "message": "Cette action n’est pas disponible pour cet état."}, status=409)
        item.save(update_fields=update_fields)
        record_event(event_type=f"access_grant.{action}", actor=request.user, actor_role=patient_actor_role(request), patient=item.patient, establishment=item.establishment, access_grant=item, metadata={"action": action, "status": item.status, "extension_count": item.extension_count})
        if action == "accept":
            PatientNotification.objects.create(patient=item.patient, kind="access.accepted", title="Accès accepté", body=f"Vous avez autorisé {item.professional_name} de {item.facility_label}.", metadata={"access_grant_id": str(item.id)})
        return Response({"success": True, "data": AccessGrantSerializer(item).data})


class PatientConsultationListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        items = Consultation.objects.filter(patient=profile_for(request.user, request)).prefetch_related("prescription_lines", "exam_requests")
        return Response({"success": True, "data": ConsultationSerializer(items, many=True).data})


class PatientPrescriptionDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        consultation = Consultation.objects.filter(pk=pk, patient=profile_for(request.user, request)).select_related("patient", "professional", "establishment").prefetch_related("prescription_lines").first()
        if not consultation:
            return Response({"success": False, "message": "Consultation introuvable."}, status=404)
        if not consultation.attestation_signed_at:
            return Response({"success": False, "message": "Cette consultation n’est pas signée : aucune ordonnance PDF ne peut être produite."}, status=409)
        lines = list(consultation.prescription_lines.all())
        if not lines:
            return Response({"success": False, "message": "Cette consultation ne contient pas d’ordonnance."}, status=404)
        from html import escape
        from io import BytesIO
        from pathlib import Path
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_LEFT
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.platypus import Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        from apps.establishments.models import PrescriptionTemplate
        template = PrescriptionTemplate.objects.filter(establishment=consultation.establishment).first()
        professional = consultation.professional
        patient = consultation.patient
        patient_name = " ".join(part for part in (patient.display_first_name(), patient.display_last_name()) if part).strip() or "Patient non renseigné"
        establishment_name = consultation.establishment.name if consultation.establishment_id else consultation.facility_label
        prescriber = consultation.professional_name or "Prescripteur non renseigné"
        specialty = professional.specialty if professional and professional.specialty else ""
        identifier = professional.professional_identifier if professional and professional.professional_identifier else ""
        next_appointment = Appointment.objects.filter(
            patient=patient, starts_at__gte=timezone.now(), status__in=("requested", "confirmed")
        ).order_by("starts_at").first()

        # Un logo_url historique est volontairement ignoré : aucun appel réseau ne doit suivre une URL fournie par un template.
        asset_images = []
        for label, public_id, resource_type in (
            ("Cachet", getattr(professional, "stamp_cloudinary_public_id", "") if professional else "", getattr(professional, "stamp_cloudinary_resource_type", "image") if professional else "image"),
            ("Signature déposée", getattr(professional, "signature_cloudinary_public_id", "") if professional else "", getattr(professional, "signature_cloudinary_resource_type", "image") if professional else "image"),
        ):
            if not public_id:
                continue
            try:
                asset_bytes = signed_download(public_id, resource_type=resource_type or "image", extension="png")
                asset_images.append((label, asset_bytes))
            except Exception:
                return Response({"success": False, "message": "Le cachet ou la signature déposée est temporairement indisponible."}, status=502)

        font_dir = Path("/usr/share/fonts/truetype/dejavu")
        if (font_dir / "DejaVuSans.ttf").exists():
            if "ECarnetSans" not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont("ECarnetSans", str(font_dir / "DejaVuSans.ttf")))
            if "ECarnetSans-Bold" not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont("ECarnetSans-Bold", str(font_dir / "DejaVuSans-Bold.ttf")))
            base_font, bold_font = "ECarnetSans", "ECarnetSans-Bold"
        else:
            base_font, bold_font = "Helvetica", "Helvetica-Bold"

        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name="PrescriptionTitle", parent=styles["Title"], fontName=bold_font, fontSize=18, leading=23, textColor=colors.HexColor("#17324d"), alignment=TA_LEFT, spaceAfter=7))
        styles.add(ParagraphStyle(name="PrescriptionBody", parent=styles["BodyText"], fontName=base_font, fontSize=10, leading=14, spaceAfter=3))
        styles.add(ParagraphStyle(name="PrescriptionLabel", parent=styles["BodyText"], fontName=bold_font, fontSize=10, leading=14, textColor=colors.HexColor("#17324d")))
        styles.add(ParagraphStyle(name="PrescriptionLine", parent=styles["BodyText"], fontName=base_font, fontSize=10.5, leading=15, leftIndent=5, firstLineIndent=-5, spaceAfter=3))
        styles.add(ParagraphStyle(name="PrescriptionInstruction", parent=styles["BodyText"], fontName=base_font, fontSize=9.5, leading=13, leftIndent=16, textColor=colors.HexColor("#45515c"), spaceAfter=7))
        styles.add(ParagraphStyle(name="PrescriptionFooter", parent=styles["BodyText"], fontName=base_font, fontSize=7, leading=8, textColor=colors.HexColor("#65727d"), spaceAfter=0))
        buffer = BytesIO()

        def footer(canvas, document):
            canvas.saveState()
            canvas.setStrokeColor(colors.HexColor("#d6dde3"))
            canvas.line(18 * mm, 16 * mm, A4[0] - 18 * mm, 16 * mm)
            footer_text = template.footer_text.strip() if template and template.footer_text else ""
            if footer_text:
                footer_text = footer_text.replace("\n", " ")
                if len(footer_text) > 200:
                    footer_text = footer_text[:199].rstrip() + "…"
                footer_paragraph = Paragraph(escape(footer_text), styles["PrescriptionFooter"])
                footer_paragraph.wrapOn(canvas, A4[0] - 36 * mm, 13 * mm)
                footer_paragraph.drawOn(canvas, 18 * mm, 17 * mm)
            canvas.setFont(base_font, 7.5)
            canvas.drawRightString(A4[0] - 18 * mm, 11.5 * mm, f"Page {document.page}")
            canvas.setFont(base_font, 7)
            canvas.setFillColor(colors.HexColor("#65727d"))
            canvas.drawString(18 * mm, 7 * mm, "Document généré depuis Mon E-Carnet — contenu saisi et signé par le prescripteur.")
            canvas.restoreState()

        document = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=17 * mm, bottomMargin=33 * mm, title="Ordonnance médicale")
        story = [Paragraph("ORDONNANCE MÉDICALE", styles["PrescriptionTitle"])]
        if template:
            for text in (template.header_text, template.address, template.phone, template.email):
                if text:
                    story.append(Paragraph(escape(text).replace("\n", "<br/>") , styles["PrescriptionBody"]))
        story.append(Spacer(1, 5))
        metadata = [
            [Paragraph("Patient", styles["PrescriptionLabel"]), Paragraph(escape(patient_name), styles["PrescriptionBody"])],
            [Paragraph("Établissement", styles["PrescriptionLabel"]), Paragraph(escape(establishment_name or "Non renseigné"), styles["PrescriptionBody"])],
            [Paragraph("Prescripteur", styles["PrescriptionLabel"]), Paragraph(escape(prescriber), styles["PrescriptionBody"])],
            [Paragraph("Spécialité", styles["PrescriptionLabel"]), Paragraph(escape(specialty or "Non renseignée"), styles["PrescriptionBody"])],
            [Paragraph("N° d’ordre professionnel déclaré", styles["PrescriptionLabel"]), Paragraph(escape(identifier or "Non renseigné"), styles["PrescriptionBody"])],
            [Paragraph("Date", styles["PrescriptionLabel"]), Paragraph(consultation.validated_at.strftime("%d/%m/%Y"), styles["PrescriptionBody"])],
        ]
        if next_appointment:
            metadata.append([Paragraph("Prochain rendez-vous", styles["PrescriptionLabel"]), Paragraph(next_appointment.starts_at.strftime("%d/%m/%Y à %H:%M"), styles["PrescriptionBody"])])
        details = Table(metadata, colWidths=(39 * mm, 130 * mm), hAlign="LEFT")
        details.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 1), ("TOPPADDING", (0, 0), (-1, -1), 1)]))
        story.extend([details, Spacer(1, 9), Paragraph("Prescription", styles["PrescriptionLabel"]), Spacer(1, 4)])
        for index, line in enumerate(lines, 1):
            text = f"{index}. {line.drug_name}"
            if line.dosage:
                text += f" — {line.dosage}"
            text += f" — {line.posology}"
            if line.duration:
                text += f" — {line.duration}"
            row = [Paragraph(escape(text), styles["PrescriptionLine"])]
            if line.instructions:
                row.append(Paragraph(f"Conseil : {escape(line.instructions)}", styles["PrescriptionInstruction"]))
            story.append(KeepTogether(row))
        if asset_images:
            story.extend([Spacer(1, 12), Paragraph("Éléments déposés par le prescripteur", styles["PrescriptionLabel"])])
            cells = []
            for label, asset_bytes in asset_images:
                image = Image(BytesIO(asset_bytes))
                image._restrictSize(46 * mm, 20 * mm)
                image.hAlign = "LEFT"
                cells.append([Paragraph(escape(label), styles["PrescriptionBody"]), image])
            assets_table = Table([cells], colWidths=[80 * mm] * len(cells))
            assets_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 6)]))
            story.append(assets_table)
        document.build(story, onFirstPage=footer, onLaterPages=footer)
        record_event(event_type="prescription.downloaded", actor=request.user, actor_role=patient_actor_role(request), patient=consultation.patient, establishment=consultation.establishment, consultation=consultation, metadata={"action": "downloaded", "resource_type": "prescription_pdf"})
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="ordonnance-{consultation.id}.pdf"'
        return response


class ProfessionalAccessGrantListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "grant_request"

    def get(self, request):
        profile = getattr(request.user, "professional_profile", None)
        access_error = professional_clinical_access_error(profile)
        if access_error:
            return Response({"success": False, "message": access_error}, status=403)
        items = AccessGrant.objects.filter(professional=profile, establishment=profile.active_establishment).select_related("patient", "establishment")
        for item in items:
            item.refresh_expiration()
        return Response({"success": True, "data": ProfessionalAccessGrantSerializer(items, many=True).data})

    @transaction.atomic
    def post(self, request):
        profile = getattr(request.user, "professional_profile", None)
        if not profile:
            return Response({"success": False, "message": "Le profil professionnel n’est pas disponible."}, status=403)
        try:
            item = create_professional_grant(professional=profile, qr_token=request.data.get("qr_token"), scope=request.data.get("scope"))
        except ValidationError as exc:
            detail = exc.detail
            message = detail[0] if isinstance(detail, list) else detail
            return Response({"success": False, "message": str(message)}, status=400)
        record_event(event_type="access_grant.requested", actor=request.user, actor_role="professional", patient=item.patient, establishment=item.establishment, access_grant=item, metadata={"action": "requested", "scope": item.scope, "status": item.status})
        PatientNotification.objects.create(patient=item.patient, kind="access.requested", title="Nouvelle demande d’accès", body=f"{item.professional_name} de {item.facility_label} demande l’accès à votre carnet.", metadata={"access_grant_id": str(item.id)})
        return Response({"success": True, "data": ProfessionalAccessGrantSerializer(item).data}, status=status.HTTP_201_CREATED)


class ProfessionalConsultationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "professional_profile", None)
        access_error = professional_clinical_access_error(profile)
        if access_error:
            return Response({"success": False, "message": access_error}, status=403)
        items = list(Consultation.objects.filter(professional=profile, establishment=profile.active_establishment).select_related("establishment", "source_encounter", "patient", "access_grant").prefetch_related("prescription_lines", "exam_requests"))
        # Un événement par patient concerné (et non un par consultation) : le patient doit pouvoir retrouver chaque lecture de son
        # dossier dans son journal, mais une liste de vingt consultations ne doit pas écrire vingt lignes à chaque chargement.
        groups = {}
        for item in items:
            groups.setdefault((item.patient_id, item.access_grant_id), []).append(item)
        for group in groups.values():
            first = group[0]
            grant = first.access_grant
            duration = int(round((grant.expires_at - grant.starts_at).total_seconds() / 60)) if grant and grant.starts_at and grant.expires_at else None
            record_event(event_type="clinical_data.read", actor=request.user, actor_role="professional", patient=first.patient, establishment=first.establishment, access_grant=grant, metadata={"action": "read_consultations", "resource_type": "consultation", "resource_count": len(group), "authorized_until": grant.expires_at.isoformat() if grant and grant.expires_at else None, "access_duration_minutes": duration})
        return Response({"success": True, "data": ConsultationSerializer(items, many=True).data})

    @transaction.atomic
    def post(self, request):
        profile = getattr(request.user, "professional_profile", None)
        if not profile:
            return Response({"success": False, "message": "Le profil professionnel n’est pas disponible."}, status=403)
        serializer = ProfessionalConsultationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            consultation = validate_consultation(professional=profile, data=serializer.validated_data)
        except ValidationError as exc:
            detail = exc.detail
            message = detail[0] if isinstance(detail, list) else detail
            return Response({"success": False, "message": str(message)}, status=400)
        except PermissionDenied as exc:
            return Response({"success": False, "message": str(exc.detail)}, status=403)
        record_event(event_type="consultation.validated", actor=request.user, actor_role="professional", patient=consultation.patient, establishment=consultation.establishment, access_grant=consultation.access_grant, consultation=consultation, metadata={"action": "validated", "source_type": "preconsultation"})
        record_event(event_type="preconsultation.closed", actor=request.user, actor_role="professional", patient=consultation.patient, establishment=consultation.establishment, access_grant=consultation.access_grant, consultation=consultation, metadata={"action": "closed", "encounter_id": str(consultation.source_encounter_id), "status": "closed"})
        return Response({"success": True, "data": ConsultationSerializer(consultation).data}, status=status.HTTP_201_CREATED)


class ProfessionalAuthorizedEncounterListView(APIView):
    """La dernière pré-consultation en préparation du patient, lisible grâce à son QR (autorisation acceptée).

    Le médecin ne choisit rien : l’autorisation désigne le patient, et le patient n’a qu’un brouillon à la fois.
    Les pré-consultations déjà clôturées par un autre établissement ne sont jamais renvoyées."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        profile = getattr(request.user, "professional_profile", None)
        access_error = professional_clinical_access_error(profile)
        if access_error:
            return Response({"success": False, "message": access_error}, status=403)
        grant = AccessGrant.objects.filter(id=pk, professional=profile, establishment=profile.active_establishment).select_related("establishment", "patient").first()
        if not grant:
            return Response({"success": False, "message": "AccessGrant introuvable dans votre périmètre."}, status=404)
        try:
            require_scope(grant, "preconsultation")
        except PermissionDenied as exc:
            return Response({"success": False, "message": str(exc.detail)}, status=403)
        latest = CareEncounter.objects.filter(patient=grant.patient, status="draft").order_by("-updated_at", "-created_at").first()
        items = [latest] if latest else []
        duration = int(round((grant.expires_at - grant.starts_at).total_seconds() / 60)) if grant.starts_at and grant.expires_at else None
        record_event(event_type="clinical_data.read", actor=request.user, actor_role="professional", patient=grant.patient, establishment=grant.establishment, access_grant=grant, metadata={"action": "read_preconsultations", "resource_type": "preconsultation", "resource_count": len(items), "authorized_until": grant.expires_at.isoformat() if grant.expires_at else None, "access_duration_minutes": duration})
        return Response({"success": True, "data": CareEncounterSerializer(items, many=True).data})


def _professional_vaccination_grant(request, grant_id):
    profile = getattr(request.user, "professional_profile", None)
    access_error = professional_clinical_access_error(profile)
    if access_error:
        return None, Response({"success": False, "message": access_error}, status=403)
    grant = AccessGrant.objects.filter(
        pk=grant_id,
        professional=profile,
        establishment=profile.active_establishment,
    ).select_related("patient", "establishment").first()
    if not grant:
        return None, Response({"success": False, "message": "Autorisation introuvable dans votre périmètre."}, status=404)
    try:
        require_scope(grant, "declarations")
    except PermissionDenied as exc:
        return None, Response({"success": False, "message": str(exc.detail)}, status=403)
    return grant, None


class ProfessionalVaccinationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, grant_id):
        grant, error = _professional_vaccination_grant(request, grant_id)
        if error:
            return error
        items = Vaccination.objects.filter(patient=grant.patient).select_related(
            "document", "confirmed_by", "confirmed_by__user",
        )
        record_event(
            event_type="clinical_data.read",
            actor=request.user,
            actor_role="professional",
            patient=grant.patient,
            establishment=grant.establishment,
            access_grant=grant,
            metadata={"action": "read_vaccinations", "resource_type": "vaccination", "resource_count": items.count()},
        )
        return Response({"success": True, "data": VaccinationSerializer(items, many=True).data})


class ProfessionalVaccinationConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, grant_id, pk):
        grant, error = _professional_vaccination_grant(request, grant_id)
        if error:
            return error
        item = Vaccination.objects.select_for_update().select_related("document").filter(
            pk=pk, patient=grant.patient,
        ).first()
        if not item:
            return Response({"success": False, "message": "Vaccination introuvable dans le dossier autorisé."}, status=404)
        if item.status == "confirmed":
            if item.confirmed_by_id:
                return Response({"success": True, "data": VaccinationSerializer(item).data})
            return Response({"success": False, "message": "Cette ancienne confirmation ne peut pas être réattribuée."}, status=409)
        if item.document_id:
            try:
                require_scope(grant, "documents")
            except PermissionDenied as exc:
                return Response({"success": False, "message": f"Un justificatif est joint : le périmètre documents doit aussi être accordé pour le consulter. {exc.detail}"}, status=403)
        item.status = "confirmed"
        item.confirmed_by = request.user.professional_profile
        item.confirmed_access_grant = grant
        item.confirmed_at = timezone.now()
        item.save(update_fields=("status", "confirmed_by", "confirmed_access_grant", "confirmed_at"))
        record_event(
            event_type="vaccination.confirmed",
            actor=request.user,
            actor_role="professional",
            patient=grant.patient,
            establishment=grant.establishment,
            access_grant=grant,
            metadata={"action": "confirmed", "vaccination_id": str(item.id), "status": item.status, "evidence": "attached_document" if item.document_id else "professional_review"},
        )
        PatientNotification.objects.create(
            patient=grant.patient,
            kind="vaccination.confirmed",
            title="Vaccination confirmée",
            body=f"La vaccination « {item.vaccine_name} » a été confirmée par un professionnel.",
            metadata={"vaccination_id": str(item.id)},
        )
        return Response({"success": True, "data": VaccinationSerializer(item).data})

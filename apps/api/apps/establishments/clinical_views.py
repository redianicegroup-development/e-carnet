import logging
from datetime import timedelta
from math import ceil

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Max, OuterRef, Q, Subquery
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.audit.models import AuditEvent
from apps.audit.services import record_event
from apps.care.establishment_records import establishment_care_records
from apps.care.models import CareEncounter, Consultation, HealthMeasurement, MedicalDocument, Vaccination
from apps.care.notifications import notify_patient
from apps.care.serializers import CareEncounterSerializer, ConsultationSerializer, HealthMeasurementSerializer, MedicalDocumentSerializer, VaccinationSerializer
from apps.patients.models import PatientProfile

from .models import Establishment, EstablishmentAdministrator, EstablishmentRecordOpening
from .views import active_administrator

logger = logging.getLogger(__name__)


VIEW_EVENT_TYPES = ("clinical_data.read", "establishment_record.opened")
def record_opening_expiry(now):
    """Fin de validité d'une ouverture : aucune limite par défaut (décision ETA-09), ou now + ECARNET_RECORD_OPENING_TTL_MINUTES si elle est réglée."""
    minutes = getattr(settings, "ECARNET_RECORD_OPENING_TTL_MINUTES", 0)
    return now + timedelta(minutes=minutes) if minutes > 0 else None
BULK_ACCESS_WINDOW = timedelta(hours=1)
BULK_ACCESS_THRESHOLD = 15
DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100


class EstablishmentPatientRecordsView(APIView):
    """Réponse d’arrêt pour les anciennes PWA qui appellent encore l’endpoint groupé."""
    permission_classes = [IsAuthenticated]

    def get(self, request, establishment_id):
        return Response(
            {
                "success": False,
                "code": "client_update_required",
                "message": "Actualisez l’application pour consulter les dossiers de soins.",
            },
            status=410,
        )


def eligible_patients(establishment):
    """Patients ayant au moins un soin attribué ou une pré-consultation clôturée ici."""
    consultations = Consultation.objects.filter(establishment=establishment).filter(
        Q(access_grant__isnull=True) | Q(access_grant__establishment=establishment)
    )
    return (
        PatientProfile.objects.filter(
            Q(encounters__establishment=establishment, encounters__status="closed")
            | Q(consultations__in=consultations)
            | Q(
                health_measurements__establishment=establishment,
                health_measurements__professional__isnull=False,
                health_measurements__validated_at__isnull=False,
            )
            | Q(
                medical_documents__establishment=establishment,
                medical_documents__professional__isnull=False,
                medical_documents__validated_at__isnull=False,
                medical_documents__verified=True,
            )
            | Q(
                vaccinations__establishment=establishment,
                vaccinations__status="confirmed",
                vaccinations__confirmed_by__isnull=False,
                vaccinations__confirmed_at__isnull=False,
            )
        )
        .distinct()
        .select_related("user")
    )


def _apply_name_search(queryset, query):
    query = (query or "").strip()[:120]
    for term in query.split()[:5]:
        queryset = queryset.filter(
            Q(first_name__icontains=term)
            | Q(last_name__icontains=term)
            | Q(user__first_name__icontains=term)
            | Q(user__last_name__icontains=term)
        )
    return queryset


def _positive_query_int(value, *, default, maximum=None):
    if value in (None, ""):
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if parsed < 1 or (maximum is not None and parsed > maximum):
        return None
    return parsed


def _age_on(birth_date, today):
    if not birth_date:
        return None
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


def _latest_service_dates(patient_ids, establishment):
    """Agrège les dates pour la seule page courante, sans charger de contenu clinique."""
    latest = {}

    def merge(queryset, date_field):
        rows = queryset.filter(patient_id__in=patient_ids).values("patient_id").annotate(last=Max(date_field)).values_list("patient_id", "last")
        for patient_id, value in rows:
            if value is not None and (patient_id not in latest or value > latest[patient_id]):
                latest[patient_id] = value

    merge(CareEncounter.objects.filter(establishment=establishment, status="closed", closed_at__isnull=False), "closed_at")
    merge(
        Consultation.objects.filter(establishment=establishment).filter(
            Q(access_grant__isnull=True) | Q(access_grant__establishment=establishment)
        ),
        "validated_at",
    )
    merge(HealthMeasurement.objects.filter(establishment=establishment, professional__isnull=False, validated_at__isnull=False), "validated_at")
    merge(MedicalDocument.objects.filter(establishment=establishment, professional__isnull=False, validated_at__isnull=False, verified=True), "validated_at")
    merge(Vaccination.objects.filter(establishment=establishment, status="confirmed", confirmed_by__isnull=False, confirmed_at__isnull=False), "confirmed_at")
    return latest


def _actor_label(user):
    if not user:
        return "Système"
    return user.get_full_name().strip() or getattr(user, "email", "") or user.get_username()


def _view_events_for(establishment, patient_id=None):
    events = AuditEvent.objects.filter(establishment=establishment, event_type__in=VIEW_EVENT_TYPES)
    if patient_id is not None:
        events = events.filter(patient_id=patient_id)
    return events


class EstablishmentPatientListView(APIView):
    """Liste de repérage sans contenu clinique, paginée et limitée aux patients de la structure."""
    permission_classes = [IsAuthenticated]

    def get(self, request, establishment_id):
        administrator = active_administrator(request.user, establishment_id) if request.user.is_active else None
        if not administrator:
            return Response({"success": False, "message": "Accès réservé à l’administrateur actif de cet établissement."}, status=403)

        page = _positive_query_int(request.query_params.get("page"), default=1)
        page_size = _positive_query_int(request.query_params.get("page_size"), default=DEFAULT_PAGE_SIZE, maximum=MAX_PAGE_SIZE)
        if page is None or page_size is None:
            return Response({"success": False, "message": "Pagination invalide."}, status=400)

        establishment = administrator.establishment
        now = timezone.now()
        patient_queryset = _apply_name_search(eligible_patients(establishment), request.query_params.get("search"))
        events = _view_events_for(establishment).filter(patient_id=OuterRef("pk"))
        views_filter = Q(audit_events__establishment=establishment, audit_events__event_type__in=VIEW_EVENT_TYPES)
        recent_views_filter = views_filter & Q(audit_events__created_at__gte=now - timedelta(days=30))
        patient_queryset = patient_queryset.annotate(
            views_total=Count("audit_events", filter=views_filter, distinct=True),
            views_30d=Count("audit_events", filter=recent_views_filter, distinct=True),
            last_view_at=Subquery(events.order_by("-created_at").values("created_at")[:1]),
            last_view_actor_id=Subquery(events.order_by("-created_at").values("actor_id")[:1]),
            last_view_role=Subquery(events.order_by("-created_at").values("actor_role")[:1]),
        ).order_by("last_name", "user__last_name", "first_name", "user__first_name", "pk")

        total = patient_queryset.count()
        start = (page - 1) * page_size
        patients = list(patient_queryset[start : start + page_size])
        patient_ids = [patient.pk for patient in patients]
        last_service = _latest_service_dates(patient_ids, establishment)
        actor_ids = {patient.last_view_actor_id for patient in patients if patient.last_view_actor_id}
        actors = get_user_model().objects.in_bulk(actor_ids)
        today = timezone.localdate()
        data = []
        for patient in patients:
            actor = actors.get(patient.last_view_actor_id)
            data.append({
                "id": str(patient.id),
                "first_name": patient.display_first_name(),
                "last_name": patient.display_last_name(),
                "age": _age_on(patient.birth_date, today),
                "last_service_at": last_service.get(patient.pk),
                "views_total": patient.views_total,
                "views_30d": patient.views_30d,
                "last_view": ({
                    "who": _actor_label(actor),
                    "role": patient.last_view_role,
                    "when": patient.last_view_at,
                } if patient.last_view_at else None),
            })

        response = Response({
            "success": True,
            "data": {
                "items": data,
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": ceil(total / page_size) if total else 0,
            },
        })
        response["Cache-Control"] = "private, no-store"
        return response


class EstablishmentRecordOpeningSerializer(serializers.Serializer):
    reason_category = serializers.ChoiceField(choices=EstablishmentRecordOpening.REASON_CHOICES)
    reason_note = serializers.CharField(required=False, allow_blank=True, max_length=140, trim_whitespace=True)

    def validate(self, attrs):
        category = attrs["reason_category"]
        note = attrs.get("reason_note", "").strip()
        if category == "autre" and not note:
            raise serializers.ValidationError({"reason_note": "Précisez brièvement le motif lorsque vous choisissez « Autre »."})
        if category != "autre" and note:
            raise serializers.ValidationError({"reason_note": "La précision libre est réservée au motif « Autre »."})
        attrs["reason_note"] = note
        return attrs


class EstablishmentRecordOpeningCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "establishment_record_open"

    @transaction.atomic
    def post(self, request, establishment_id, patient_id):
        if not request.user.is_active:
            return Response({"success": False, "message": "Accès réservé à l’administrateur actif de cet établissement."}, status=403)
        if not getattr(settings, "ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ", True):
            return Response({"success": False, "message": "La consultation des dossiers est temporairement désactivée."}, status=403)

        # Verrou établissement + affectation : sérialise les ouvertures et permet une seule alerte au franchissement du seuil.
        establishment = Establishment.objects.select_for_update().filter(pk=establishment_id, status="active").first()
        if not establishment:
            return Response({"success": False, "message": "Accès réservé à l’administrateur actif de cet établissement."}, status=403)
        administrator = EstablishmentAdministrator.objects.select_for_update(of=("self",)).filter(
            user=request.user,
            establishment=establishment,
            status="active",
        ).order_by("-started_at").first()
        if not administrator:
            return Response({"success": False, "message": "Accès réservé à l’administrateur actif de cet établissement."}, status=403)

        serializer = EstablishmentRecordOpeningSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient = eligible_patients(establishment).filter(pk=patient_id).first()
        if not patient:
            return Response({"success": False, "message": "Dossier introuvable."}, status=404)

        if PatientProfile.objects.filter(pk=patient.pk, user=request.user).exists():
            record_event(
                event_type="establishment_record.self_refused",
                actor=request.user,
                actor_role="establishment_admin",
                patient=patient,
                establishment=establishment,
                metadata={"action": "self_access_refused"},
            )
            return Response({"success": False, "code": "self_access", "message": "Vous ne pouvez pas consulter votre propre dossier depuis l’espace établissement."}, status=403)

        now = timezone.now()
        category = serializer.validated_data["reason_category"]
        opening = EstablishmentRecordOpening.objects.create(
            establishment=establishment,
            patient=patient,
            opened_by=request.user,
            opened_by_role="establishment_admin",
            reason_category=category,
            reason_note=serializer.validated_data.get("reason_note", ""),
            opened_at=now,
            expires_at=record_opening_expiry(now),
        )
        record_event(
            event_type="establishment_record.opened",
            actor=request.user,
            actor_role="establishment_admin",
            patient=patient,
            establishment=establishment,
            metadata={"action": "opened", "reason_category": category, "opening_id": str(opening.id)},
        )
        category_label = dict(EstablishmentRecordOpening.REASON_CHOICES)[category]
        notify_patient(
            patient,
            kind="establishment_record.opened",
            title="Votre dossier a été consulté",
            body=f"{establishment.name} · motif : {category_label}",
            metadata={"reason_category": category, "opening_id": str(opening.id)},
            coalesce_key=f"{request.user.pk}:{patient.pk}",
        )

        cutoff = now - BULK_ACCESS_WINDOW
        distinct_patients = EstablishmentRecordOpening.objects.filter(
            establishment=establishment,
            opened_by=request.user,
            opened_at__gte=cutoff,
        ).values("patient_id").distinct().count()
        if distinct_patients == BULK_ACCESS_THRESHOLD + 1:
            record_event(
                event_type="establishment_record.volume_alert",
                actor=request.user,
                actor_role="establishment_admin",
                establishment=establishment,
                metadata={"action": "unusual_volume", "resource_count": distinct_patients},
            )
            logger.warning(
                "Alerte d’accès établissement: volume inhabituel d’ouvertures distinctes.",
                extra={"establishment_id": str(establishment.id), "administrator_id": str(request.user.pk), "distinct_patients_1h": distinct_patients},
            )

        response = Response({"success": True, "data": {"opening_id": str(opening.id), "expires_at": opening.expires_at}}, status=201)
        response["Cache-Control"] = "private, no-store"
        return response


class EstablishmentRecordView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, establishment_id, opening_id):
        if not request.user.is_active:
            return Response({"success": False, "message": "Accès établissement refusé."}, status=403)
        if not getattr(settings, "ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ", True):
            return Response({"success": False, "message": "La consultation des dossiers est temporairement désactivée."}, status=403)
        administrator = active_administrator(request.user, establishment_id)
        if not administrator:
            return Response({"success": False, "message": "Accès établissement refusé."}, status=403)

        opening = EstablishmentRecordOpening.objects.select_related("patient", "establishment", "opened_by").filter(
            pk=opening_id,
            establishment=administrator.establishment,
        ).first()
        if not opening:
            return Response({"success": False, "message": "Ouverture introuvable."}, status=404)
        if opening.opened_by_id != request.user.pk:
            return Response({"success": False, "message": "Cette ouverture appartient à un autre administrateur."}, status=403)
        if opening.expires_at and opening.expires_at <= timezone.now():
            return Response({"success": False, "message": "Cette ouverture a expiré. Demandez un nouvel accès avec un motif."}, status=403)
        if not active_administrator(request.user, establishment_id):
            return Response({"success": False, "message": "Votre habilitation établissement n’est plus active."}, status=403)

        records = establishment_care_records(opening.patient, administrator.establishment)
        serializers_by_type = (
            ("preconsultations", records.preconsultations, CareEncounterSerializer),
            ("consultations", records.consultations, ConsultationSerializer),
            ("measurements", records.measurements, HealthMeasurementSerializer),
            ("documents", records.documents, MedicalDocumentSerializer),
            ("vaccinations", records.vaccinations, VaccinationSerializer),
        )
        data = {}
        resource_count = 0
        for name, queryset, serializer_class in serializers_by_type:
            items = list(queryset)
            resource_count += len(items)
            serialized = serializer_class(items, many=True).data
            data[name] = [dict(item) for item in serialized]
            if name == "documents":
                # L’URL patient d’un document n’accorde pas de droit de téléchargement à l’administrateur.
                for item in data[name]:
                    item.pop("download_url", None)
        record_event(
            event_type="establishment_record.read",
            actor=request.user,
            actor_role="establishment_admin",
            patient=opening.patient,
            establishment=administrator.establishment,
            metadata={"action": "read", "opening_id": str(opening.id), "resource_count": resource_count},
        )
        response = Response({
            "success": True,
            "data": {
                "opening_id": str(opening.id),
                "expires_at": opening.expires_at,
                "patient": {
                    "id": str(opening.patient.id),
                    "first_name": opening.patient.display_first_name(),
                    "last_name": opening.patient.display_last_name(),
                    "age": _age_on(opening.patient.birth_date, timezone.localdate()),
                },
                "records": data,
            },
        })
        response["Cache-Control"] = "no-store"
        response["Pragma"] = "no-cache"
        return response


class EstablishmentPatientViewHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, establishment_id, patient_id):
        administrator = active_administrator(request.user, establishment_id) if request.user.is_active else None
        if not administrator:
            return Response({"success": False, "message": "Accès réservé à l’administrateur actif de cet établissement."}, status=403)
        establishment = administrator.establishment
        if not eligible_patients(establishment).filter(pk=patient_id).exists():
            return Response({"success": False, "message": "Dossier introuvable."}, status=404)

        openings = EstablishmentRecordOpening.objects.filter(
            establishment=establishment,
            patient_id=patient_id,
        ).select_related("opened_by").order_by("-opened_at")[:100]
        entries = [{
            "event_type": "establishment_record.opened",
            "who": _actor_label(item.opened_by),
            "role": item.opened_by_role,
            "when": item.opened_at,
            "reason_category": item.reason_category,
            "reason_label": dict(EstablishmentRecordOpening.REASON_CHOICES)[item.reason_category],
            "reason_note": item.reason_note,
            "opening_id": str(item.id),
        } for item in openings]

        professional_reads = _view_events_for(establishment, patient_id).filter(event_type="clinical_data.read").select_related(
            "actor", "access_grant"
        ).order_by("-created_at")[:100]
        for event in professional_reads:
            entries.append({
                "event_type": event.event_type,
                "who": event.access_grant.professional_name if event.access_grant_id else _actor_label(event.actor),
                "role": event.actor_role,
                "when": event.created_at,
                "reason_category": None,
                "reason_label": "Accès autorisé par le patient",
                "reason_note": "",
                "opening_id": None,
            })
        entries.sort(key=lambda item: item["when"], reverse=True)
        response = Response({"success": True, "data": entries[:100]})
        response["Cache-Control"] = "private, no-store"
        return response

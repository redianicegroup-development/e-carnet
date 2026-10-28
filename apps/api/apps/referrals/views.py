from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from apps.audit.services import record_event
from apps.care.models import CareEncounter, Consultation, HealthMeasurement, MedicalDocument, Vaccination
from apps.care.notifications import notify_patient
from apps.establishments.models import Establishment, EstablishmentAdministrator, EstablishmentMembership
from apps.patients.models import PatientProfile
from apps.professionals.access import professional_clinical_access_error
from apps.professionals.models import ProfessionalProfile
from .models import CareReferral, CareReferralItem, CareSnapshot

PROPOSAL_TTL = timedelta(days=14)
ALLOWED_READ_DAYS = {7, 14, 30}

def disabled_response():
    return Response({"success": False, "message": "La fonctionnalité d’adressage est désactivée."}, status=404)

def profile_for_user(user):
    return PatientProfile.objects.filter(user=user).first()

def professional_for_user(user):
    return ProfessionalProfile.objects.filter(user=user).select_related("active_establishment").first()

def payload(item):
    return {"id": str(item.id), "status": item.status, "patient_id": str(item.patient_id), "from_establishment_id": str(item.from_establishment_id), "from_establishment_name": item.from_establishment.name, "to_establishment_id": str(item.to_establishment_id), "to_establishment_name": item.to_establishment.name, "reason_category": item.reason_category, "reason_note": item.reason_note if item.status == "draft" else "", "proposed_at": item.proposed_at.isoformat() if item.proposed_at else None, "patient_decided_at": item.patient_decided_at.isoformat() if item.patient_decided_at else None, "read_until": item.read_until.isoformat() if item.read_until else None, "expires_at": item.expires_at.isoformat() if item.expires_at else None, "items": [{"id": str(x.id), "record_type": x.record_type, "record_id": str(x.record_id), "accepted_by_patient": x.accepted_by_patient} for x in item.items.all()]}

def record_exists_for_professional(record_type, record_id, patient, professional, establishment):
    models = {"consultation": Consultation, "encounter": CareEncounter, "measurement": HealthMeasurement, "document": MedicalDocument, "vaccination": Vaccination}
    model = models.get(record_type)
    if not model:
        return False
    query = model.objects.filter(pk=record_id, patient=patient)
    if record_type == "consultation": query = query.filter(professional=professional, establishment=establishment)
    elif record_type == "encounter": query = query.filter(establishment=establishment, status="closed")
    elif record_type in ("measurement", "document"): query = query.filter(professional=professional, establishment=establishment, validated_at__isnull=False)
    else: query = query.filter(confirmed_by=professional, establishment=establishment, status="confirmed")
    return query.exists()

def record_snapshot(record_type, record_id):
    model = {"consultation": Consultation, "encounter": CareEncounter, "measurement": HealthMeasurement, "document": MedicalDocument, "vaccination": Vaccination}[record_type]
    item = model.objects.select_related("professional", "establishment").get(pk=record_id)
    common = {"record_type": record_type, "record_id": str(item.pk), "establishment_id": str(getattr(item, "establishment_id", "") or ""), "professional_id": str(getattr(item, "professional_id", None) or getattr(item, "confirmed_by_id", None) or "")}
    if record_type == "consultation": common.update({"reason": item.reason, "observations": item.observations, "symptoms": item.symptoms, "clinical_exam": item.clinical_exam, "diagnosis": item.diagnosis, "vitals": item.vitals, "conclusion": item.conclusion, "care_plan": item.care_plan, "validated_at": item.validated_at.isoformat()})
    elif record_type == "encounter": common.update({"reason": item.reason, "observations": item.observations, "vitals": item.vitals, "closed_at": item.closed_at.isoformat() if item.closed_at else None})
    elif record_type == "measurement": common.update({"kind": item.kind, "value": str(item.value) if item.value is not None else None, "unit": item.unit, "measured_at": item.measured_at.isoformat(), "note": item.note})
    elif record_type == "document": common.update({"document_type": item.document_type, "original_name": item.original_name, "document_date": item.document_date.isoformat() if item.document_date else None, "issuer": item.issuer, "validated_at": item.validated_at.isoformat() if item.validated_at else None})
    else: common.update({"vaccine_name": item.vaccine_name, "dose_number": item.dose_number, "administered_on": item.administered_on.isoformat() if item.administered_on else None, "facility": item.facility, "confirmed_at": item.confirmed_at.isoformat() if item.confirmed_at else None})
    return common

class ReferralCreateView(APIView):
    permission_classes = [IsAuthenticated]; throttle_classes = [ScopedRateThrottle]; throttle_scope = "referral_changes"
    @transaction.atomic
    def post(self, request):
        if not settings.ECARNET_REFERRALS_ENABLED: return disabled_response()
        profile = professional_for_user(request.user)
        if not profile or professional_clinical_access_error(profile): return Response({"success": False, "message": "Un rattachement professionnel actif est requis."}, status=403)
        source = profile.active_establishment
        patient = PatientProfile.objects.filter(pk=request.data.get("patient_id")).first()
        destination = Establishment.objects.filter(pk=request.data.get("to_establishment_id"), status="active").first()
        reason = str(request.data.get("reason_category", "")).strip()
        if not patient or not destination or destination == source: return Response({"success": False, "message": "Patient ou établissement destinataire invalide."}, status=400)
        if reason not in dict(CareReferral.REASON_CHOICES): return Response({"success": False, "message": "Motif d’adressage invalide."}, status=400)
        if reason == "autre" and not str(request.data.get("reason_note", "")).strip(): return Response({"success": False, "message": "Précisez le motif autre."}, status=400)
        referral = CareReferral.objects.create(patient=patient, from_establishment=source, from_professional=profile, to_establishment=destination, reason_category=reason, reason_note=str(request.data.get("reason_note", ""))[:240], expires_at=timezone.now() + PROPOSAL_TTL)
        for raw in request.data.get("items", []):
            record_type = str(raw.get("record_type", "")); record_id = raw.get("record_id")
            if not record_exists_for_professional(record_type, record_id, patient, profile, source): return Response({"success": False, "message": "Un élément proposé n’est pas produit par votre établissement."}, status=400)
            CareReferralItem.objects.create(referral=referral, record_type=record_type, record_id=record_id)
        record_event(event_type="referral.created", actor=request.user, actor_role="professional", patient=patient, establishment=source, metadata={"action": "created", "referral_id": str(referral.id), "counterparty_establishment_id": str(destination.id)})
        return Response({"success": True, "data": payload(referral)}, status=201)

class ReferralActionView(APIView):
    permission_classes = [IsAuthenticated]; throttle_classes = [ScopedRateThrottle]; throttle_scope = "referral_changes"
    @transaction.atomic
    def post(self, request, pk, action):
        if not settings.ECARNET_REFERRALS_ENABLED: return disabled_response()
        profile = professional_for_user(request.user); referral = CareReferral.objects.select_for_update().select_related("patient", "from_establishment", "to_establishment").filter(pk=pk, from_professional=profile).first()
        if not referral: return Response({"success": False, "message": "Adressage introuvable."}, status=404)
        if action == "send" and referral.status == "draft":
            if not referral.items.exists(): return Response({"success": False, "message": "Ajoutez au moins un élément."}, status=400)
            referral.status = "proposed"; referral.proposed_at = timezone.now(); referral.save(update_fields=("status", "proposed_at", "updated_at"))
            record_event(event_type="referral.sent", actor=request.user, actor_role="professional", patient=referral.patient, establishment=referral.from_establishment, metadata={"action": "sent", "referral_id": str(referral.id), "counterparty_establishment_id": str(referral.to_establishment_id)})
            notify_patient(referral.patient, kind="referral.proposed", title="Nouvel adressage à valider", body=f"Un professionnel vous propose un partage vers {referral.to_establishment.name}.", metadata={"referral_id": str(referral.id)}, coalesce_key=f"referral:{referral.id}")
        elif action == "cancel" and referral.status in ("draft", "proposed"):
            referral.status = "cancelled"; referral.save(update_fields=("status", "updated_at")); record_event(event_type="referral.cancelled", actor=request.user, actor_role="professional", patient=referral.patient, establishment=referral.from_establishment, metadata={"action": "cancelled", "referral_id": str(referral.id)})
        else: return Response({"success": False, "message": "Action impossible dans cet état."}, status=409)
        return Response({"success": True, "data": payload(referral)})

class PatientReferralListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        if not settings.ECARNET_REFERRALS_ENABLED: return disabled_response()
        patient = profile_for_user(request.user)
        if not patient: return Response({"success": True, "data": []})
        return Response({"success": True, "data": [payload(x) for x in CareReferral.objects.filter(patient=patient).select_related("from_establishment", "to_establishment").prefetch_related("items")]})

class PatientReferralDecisionView(APIView):
    permission_classes = [IsAuthenticated]; throttle_classes = [ScopedRateThrottle]; throttle_scope = "referral_changes"
    @transaction.atomic
    def post(self, request, pk, action):
        if not settings.ECARNET_REFERRALS_ENABLED: return disabled_response()
        patient = profile_for_user(request.user); referral = CareReferral.objects.select_for_update().select_related("from_establishment", "to_establishment").filter(pk=pk, patient=patient).first()
        if not referral: return Response({"success": False, "message": "Adressage introuvable."}, status=404)
        if action == "decline" and referral.status == "proposed": referral.status = "declined"; referral.patient_decided_at = timezone.now()
        elif action == "revoke" and referral.status in ("accepted", "consulted"): referral.status = "revoked"; referral.revoked_at = timezone.now()
        elif action == "accept" and referral.status == "proposed":
            days = int(request.data.get("duration_days", 30)); selected = {str(x) for x in request.data.get("item_ids", [])}; items = list(referral.items.all())
            if days not in ALLOWED_READ_DAYS or not selected or not selected.issubset({str(x.id) for x in items}): return Response({"success": False, "message": "Sélection d’éléments ou durée invalide."}, status=400)
            snapshot = {"patient_id": str(patient.id), "from_establishment_id": str(referral.from_establishment_id), "to_establishment_id": str(referral.to_establishment_id), "items": [record_snapshot(x.record_type, x.record_id) for x in items if str(x.id) in selected]}
            for item in items: item.accepted_by_patient = str(item.id) in selected; item.save(update_fields=("accepted_by_patient",))
            CareSnapshot.objects.create(referral=referral, payload=snapshot, payload_hash=CareSnapshot.digest(snapshot)); referral.status = "accepted"; referral.read_until = timezone.now() + timedelta(days=days); referral.patient_decided_at = timezone.now()
        else: return Response({"success": False, "message": "Action impossible dans cet état."}, status=409)
        referral.save(update_fields=("status", "patient_decided_at", "revoked_at", "read_until", "updated_at")); record_event(event_type=f"referral.{action}d" if action in ("accept", "decline") else "referral.revoked", actor=request.user, actor_role="patient", patient=patient, establishment=referral.to_establishment, metadata={"action": action, "referral_id": str(referral.id), "counterparty_establishment_id": str(referral.from_establishment_id)})
        return Response({"success": True, "data": payload(referral)})

class ReferralInboxView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, establishment_id):
        if not settings.ECARNET_REFERRALS_ENABLED: return disabled_response()
        profile = professional_for_user(request.user)
        professional_allowed = profile and str(profile.active_establishment_id) == str(establishment_id) and not professional_clinical_access_error(profile)
        admin_allowed = EstablishmentAdministrator.objects.filter(user=request.user, establishment_id=establishment_id, status="active", establishment__status="active").exists()
        if not professional_allowed and not admin_allowed: return Response({"success": False, "message": "Rattachement professionnel ou rôle administrateur actif requis."}, status=403)
        items = CareReferral.objects.filter(to_establishment_id=establishment_id, status__in=("accepted", "consulted", "closed"), read_until__gt=timezone.now()).select_related("patient", "from_establishment")
        return Response({"success": True, "data": [{"id": str(x.id), "patient_id": str(x.patient_id), "patient_name": x.patient.display_first_name(), "from_establishment": x.from_establishment.name, "reason_category": x.reason_category, "status": x.status, "read_until": x.read_until.isoformat()} for x in items]})

class ReferralOpenView(APIView):
    permission_classes = [IsAuthenticated]; throttle_classes = [ScopedRateThrottle]; throttle_scope = "referral_reads"
    def post(self, request, pk):
        if not settings.ECARNET_REFERRALS_ENABLED: return disabled_response()
        profile = professional_for_user(request.user)
        referral = CareReferral.objects.filter(pk=pk, to_establishment=getattr(profile, "active_establishment", None), status="accepted", read_until__gt=timezone.now()).first()
        if not profile or not referral or professional_clinical_access_error(profile): return Response({"success": False, "message": "Adressage introuvable ou expiré."}, status=404)
        return Response({"success": True, "data": {"id": str(referral.id), "patient_id": str(referral.patient_id), "from_establishment": referral.from_establishment.name, "reason_category": referral.reason_category, "read_until": referral.read_until.isoformat()}})

class ReferralSnapshotView(APIView):
    permission_classes = [IsAuthenticated]; throttle_classes = [ScopedRateThrottle]; throttle_scope = "referral_reads"
    def get(self, request, pk):
        if not settings.ECARNET_REFERRALS_ENABLED: return disabled_response()
        profile = professional_for_user(request.user); referral = CareReferral.objects.select_related("to_establishment").filter(pk=pk, to_establishment=getattr(profile, "active_establishment", None), status__in=("accepted", "consulted", "closed"), read_until__gt=timezone.now()).first()
        if not profile or not referral or professional_clinical_access_error(profile): return Response({"success": False, "message": "Adressage introuvable ou expiré."}, status=404)
        referral.status = "consulted"; referral.save(update_fields=("status", "updated_at")); record_event(event_type="referral.read", actor=request.user, actor_role="professional", patient=referral.patient, establishment=referral.to_establishment, metadata={"action": "read", "referral_id": str(referral.id), "counterparty_establishment_id": str(referral.from_establishment_id)})
        notify_patient(referral.patient, kind="referral.read", title="Un adressage a été consulté", body=f"Votre adressage vers {referral.to_establishment.name} a été consulté.", metadata={"referral_id": str(referral.id)}, coalesce_key=f"referral-read:{referral.id}")
        response = Response({"success": True, "data": referral.snapshot.payload}); response["Cache-Control"] = "no-store"; return response

class ReferralAcknowledgeView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, pk):
        if not settings.ECARNET_REFERRALS_ENABLED: return disabled_response()
        profile = professional_for_user(request.user); referral = CareReferral.objects.filter(pk=pk, to_establishment=getattr(profile, "active_establishment", None), status="consulted").first()
        if not referral: return Response({"success": False, "message": "Adressage introuvable."}, status=404)
        referral.status = "closed"; referral.save(update_fields=("status", "updated_at")); record_event(event_type="referral.closed", actor=request.user, actor_role="professional", patient=referral.patient, establishment=referral.to_establishment, metadata={"action": "closed", "referral_id": str(referral.id)})
        return Response({"success": True, "data": {"status": referral.status}})

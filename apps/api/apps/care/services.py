import secrets
from datetime import timedelta
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.patients.models import PatientProfile
from apps.professionals.access import professional_clinical_access_error
from .models import AccessGrant, PatientAccessQrToken

# Décision A9 V1 : QR opaque, usage unique, valable cinq minutes.
QR_TOKEN_TTL_SECONDS = int(getattr(settings, "ECARNET_QR_TTL_SECONDS", 300))
ALLOWED_SCOPES = {"preconsultation", "declarations", "consultations"}
DEFAULT_SCOPES = ["preconsultation", "declarations"]
PENDING_GRANT_TTL = timedelta(days=7)
REFUSED_GRANT_COOLDOWN = timedelta(days=30)


@transaction.atomic
def create_patient_qr_token(*, patient):
    raw = secrets.token_urlsafe(32)
    PatientAccessQrToken.objects.create(
        patient=patient,
        token_hash=PatientAccessQrToken.digest(raw),
        expires_at=timezone.now() + timedelta(seconds=QR_TOKEN_TTL_SECONDS),
    )
    return raw


def patient_from_qr_token(raw_token):
    token = PatientAccessQrToken.objects.select_related("patient").filter(
        token_hash=PatientAccessQrToken.digest(raw_token),
        consumed_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()
    if not token:
        raise ValidationError("Ce QR est expiré, déjà utilisé ou invalide.")
    return token


@transaction.atomic
def create_professional_grant(*, professional, patient_id=None, qr_token=None, scope=None):
    access_error = professional_clinical_access_error(professional)
    if access_error:
        raise ValidationError(access_error)
    establishment = professional.active_establishment
    token = patient_from_qr_token(qr_token) if qr_token else None
    patient = token.patient if token else PatientProfile.objects.filter(id=patient_id).first()
    if not patient:
        raise ValidationError("Patient introuvable dans le carnet demandé.")
    requested_scope = list(dict.fromkeys(scope or DEFAULT_SCOPES))
    if not requested_scope or any(item not in ALLOWED_SCOPES for item in requested_scope):
        raise ValidationError("Le périmètre demandé contient une valeur non autorisée en V1.")
    stale_pending = AccessGrant.objects.select_for_update().filter(
        patient=patient,
        professional=professional,
        establishment=establishment,
        status__in=("pending", "active"),
        expires_at__lte=timezone.now(),
    )
    for grant in stale_pending:
        grant.refresh_expiration()
    existing = AccessGrant.objects.filter(patient=patient, professional=professional, establishment=establishment, status__in=("pending", "active")).first()
    if existing:
        raise ValidationError("Une demande active existe déjà pour ce patient et cet établissement.")
    cutoff = timezone.now() - REFUSED_GRANT_COOLDOWN
    if AccessGrant.objects.filter(
        patient=patient,
        professional=professional,
        establishment=establishment,
        status="refused",
        refused_at__gt=cutoff,
    ).exists():
        raise ValidationError("Une nouvelle demande est possible 30 jours après le refus.")
    try:
        with transaction.atomic():
            grant = AccessGrant.objects.create(
                patient=patient,
                professional=professional,
                establishment=establishment,
                professional_name=f"{professional.user.first_name} {professional.user.last_name}".strip() or professional.professional_title,
                facility_label=establishment.name,
                scope=requested_scope,
                expires_at=timezone.now() + PENDING_GRANT_TTL,
            )
    except IntegrityError:
        if AccessGrant.objects.filter(
            patient=patient,
            professional=professional,
            establishment=establishment,
            status__in=("pending", "active"),
        ).exists():
            raise ValidationError("Une demande active existe déjà pour ce patient et cet établissement.") from None
        raise
    if token:
        token.consumed_at = timezone.now()
        token.save(update_fields=("consumed_at",))
    return grant

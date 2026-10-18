import secrets
from datetime import timedelta
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.professionals.access import professional_clinical_access_error
from .models import AccessGrant, PatientAccessQrToken

# Décision A9 V1 : QR opaque, usage unique, valable cinq minutes.
QR_TOKEN_TTL_SECONDS = int(getattr(settings, "ECARNET_QR_TTL_SECONDS", 300))
ALLOWED_SCOPES = {"preconsultation", "declarations", "consultations", "documents"}
DEFAULT_SCOPES = ["preconsultation", "declarations"]
PENDING_GRANT_TTL = timedelta(days=7)
REFUSED_GRANT_COOLDOWN = timedelta(days=30)
# Les jetons expirés ou utilisés ne servent plus à rien : ils sont purgés après ce délai (commande `cleanup_access_qr_tokens`).
QR_TOKEN_RETENTION = timedelta(days=1)
SCOPE_NOT_GRANTED_MESSAGE = "Cette autorisation ne couvre pas cette information."
GRANT_NOT_ACTIVE_MESSAGE = "L’autorisation du patient n’est plus active."
QR_INVALID_MESSAGE = "Ce QR est expiré, déjà utilisé ou invalide."
QR_REQUIRED_MESSAGE = "Scannez le QR affiché par le patient : il est exigé pour chaque demande d’accès."


def require_scope(grant, scope):
    """Porte unique de lecture clinique : l’autorisation est active **et** couvre ce périmètre.

    Tout endpoint qui lit une donnée du patient pour un professionnel passe par ici avec le périmètre qu’il expose
    (`preconsultation`, `declarations`, `consultations`, `documents`). Le patient accorde ces périmètres à l’acceptation ; sans cette
    vérification, un périmètre refusé resterait lisible. Lève `PermissionDenied` (403) : l’appelant n’a rien d’autre à tester.

    Ne vérifie pas l’établissement ni le professionnel : ces contrôles dépendent du contexte de la requête et restent à l’appelant.
    """
    if scope not in ALLOWED_SCOPES:
        # Une faute de frappe côté code ne doit jamais ouvrir ni fermer un accès par hasard.
        raise ValueError(f"Périmètre inconnu : {scope!r}")
    grant.refresh_expiration()
    if grant.status != "active":
        raise PermissionDenied(GRANT_NOT_ACTIVE_MESSAGE)
    if scope not in (grant.scope or []):
        raise PermissionDenied(SCOPE_NOT_GRANTED_MESSAGE)
    return grant


@transaction.atomic
def create_patient_qr_token(*, patient):
    """Crée le QR courant du patient. Un seul QR est valable à la fois : les précédents, non utilisés, sont invalidés."""
    now = timezone.now()
    PatientAccessQrToken.objects.filter(patient=patient, consumed_at__isnull=True, expires_at__gt=now).update(expires_at=now)
    PatientAccessQrToken.objects.filter(patient=patient, expires_at__lt=now - QR_TOKEN_RETENTION).delete()
    raw = secrets.token_urlsafe(32)
    PatientAccessQrToken.objects.create(
        patient=patient,
        token_hash=PatientAccessQrToken.digest(raw),
        expires_at=now + timedelta(seconds=QR_TOKEN_TTL_SECONDS),
    )
    return raw


def patient_from_qr_token(raw_token, *, for_update=False):
    """Retrouve un jeton valable. `for_update=True` verrouille la ligne jusqu’à la fin de la transaction."""
    queryset = PatientAccessQrToken.objects.select_related("patient")
    if for_update:
        queryset = queryset.select_for_update(of=("self",))
    token = queryset.filter(
        token_hash=PatientAccessQrToken.digest(raw_token),
        consumed_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()
    if not token:
        raise ValidationError(QR_INVALID_MESSAGE)
    return token


def consume_qr_token(token):
    """Marque le jeton utilisé par une mise à jour conditionnelle : un seul appelant peut réussir, même sans verrou de ligne."""
    now = timezone.now()
    consumed = PatientAccessQrToken.objects.filter(pk=token.pk, consumed_at__isnull=True, expires_at__gt=now).update(consumed_at=now)
    if consumed != 1:
        raise ValidationError(QR_INVALID_MESSAGE)


@transaction.atomic
def create_professional_grant(*, professional, qr_token=None, scope=None):
    """Ouvre une demande d’accès. Le QR du patient est exigé à chaque demande : aucun identifiant de patient n’est accepté."""
    access_error = professional_clinical_access_error(professional)
    if access_error:
        raise ValidationError(access_error)
    establishment = professional.active_establishment
    if not isinstance(qr_token, str) or not qr_token.strip():
        raise ValidationError(QR_REQUIRED_MESSAGE)
    token = patient_from_qr_token(qr_token.strip(), for_update=True)
    patient = token.patient
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
    consume_qr_token(token)
    return grant

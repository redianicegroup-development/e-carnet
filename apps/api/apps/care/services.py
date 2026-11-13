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
ALLOWED_SCOPES = {"preconsultation", "declarations", "consultations", "documents", "care_history"}
DEFAULT_SCOPES = ["preconsultation", "declarations"]
# Le QR professionnel propose toujours les documents en lecture seule ; le patient voit ce périmètre et doit encore l'accepter.
REQUIRED_SCOPES = ("documents",)
PENDING_GRANT_TTL = timedelta(days=7)
# Règle du 08/11/2026 : présenter son QR vaut accord. Le scan ouvre l'accès tout de suite, pour deux heures, à UN SEUL professionnel à la fois
# (comme une connexion Bluetooth : tant qu'une personne est connectée, personne d'autre ne peut se connecter).
AUTO_GRANT_DURATION = timedelta(hours=2)
# Ce que le QR ouvre sans autre décision du patient. Au-delà (consultations passées, historique d'autres structures), le patient décide encore.
AUTO_GRANT_SCOPES = frozenset({"preconsultation", "declarations", "documents"})
ANOTHER_PROFESSIONAL_CONNECTED_MESSAGE = "Ce patient est déjà connecté à un autre professionnel. L’accès en cours doit se terminer (par le patient ou par ce professionnel) avant d’en ouvrir un nouveau."
REFUSED_GRANT_COOLDOWN = timedelta(days=30)
# Les jetons expirés ou utilisés ne servent plus à rien : ils sont purgés après ce délai (commande `cleanup_access_qr_tokens`).
QR_TOKEN_RETENTION = timedelta(days=1)
SCOPE_NOT_GRANTED_MESSAGE = "Cette autorisation ne couvre pas cette information."
GRANT_NOT_ACTIVE_MESSAGE = "L’autorisation du patient n’est plus active."
QR_INVALID_MESSAGE = "Ce QR est expiré, déjà utilisé ou invalide."
QR_REQUIRED_MESSAGE = "Scannez le QR affiché par le patient : il est exigé pour chaque demande d’accès."


SELF_ACCESS_MESSAGE = "Vous ne pouvez pas ouvrir votre propre dossier en tant que professionnel. Consultez-le depuis votre espace patient : un confrère peut vous soigner par le circuit habituel (QR, autorisation, consultation signée par lui)."


class SelfAccessRefused(ValidationError):
    """Un professionnel a présenté le QR de son propre dossier patient."""


def is_own_patient_file(professional, patient):
    """Vrai quand le dossier patient appartient au compte du professionnel (même utilisateur, deux espaces)."""
    user_id = getattr(professional, "user_id", None)
    return bool(user_id) and getattr(patient, "user_id", None) == user_id


def other_professional_connected(patient, professional, *, exclude_grant_id=None):
    """Retourne l'accès actif d'un AUTRE professionnel sur ce patient (expiré = ignoré), ou None : la « connexion » est exclusive."""
    now = timezone.now()
    queryset = AccessGrant.objects.filter(patient=patient, status="active").exclude(professional=professional)
    if exclude_grant_id:
        queryset = queryset.exclude(pk=exclude_grant_id)
    for grant in queryset.select_for_update(of=("self",)):
        grant.refresh_expiration()
        if grant.status == "active" and grant.expires_at and grant.expires_at > now:
            return grant
    return None


# Pourquoi un accès a été fermé avant son échéance (journal d'audit, metadata.reason_code : clé déjà autorisée par la liste blanche du journal).
END_REASON_PROFESSIONAL = "professional_ended"
END_REASON_CONSULTATION_SIGNED = "consultation_signed"
END_REASON_WAITING_RESULTS = "waiting_results"
_END_NOTIFICATIONS = {
    END_REASON_PROFESSIONAL: ("Accès terminé", "{who} de {where} a mis fin à son accès à votre carnet."),
    END_REASON_WAITING_RESULTS: ("Consultation en attente de résultats", "{who} de {where} attend les résultats de vos examens. Son accès à votre carnet s’est fermé : montrez votre QR d’examen au laboratoire, puis votre QR d’accès à votre médecin pour reprendre."),
    END_REASON_CONSULTATION_SIGNED: ("Consultation terminée", "{who} de {where} a terminé votre consultation. Son accès à votre carnet s’est fermé automatiquement : vous n’avez rien à faire."),
}


@transaction.atomic
def end_access_grant(grant, *, actor, reason):
    """Ferme tout de suite un accès ACTIF, sans attendre l'expiration des 2 h : le patient peut se connecter à quelqu'un d'autre.

    Point unique pour les deux façons de finir : le professionnel clique « Terminer l'accès », ou il signe la consultation
    (l'accès se ferme alors tout seul : le patient n'a pas à le révoquer par oubli du professionnel).
    La fermeture est une mise à jour conditionnelle : si l'accès n'est plus actif (révoqué, expiré, déjà terminé en parallèle),
    rien n'est écrit, aucun événement ni notification n'est créé, et la fonction renvoie False.
    """
    from apps.audit.services import record_event

    from .notifications import notify_patient

    now = timezone.now()
    closed = AccessGrant.objects.filter(pk=grant.pk, status="active", expires_at__gt=now).update(status="expired", expires_at=now)
    if not closed:
        return False
    grant.status, grant.expires_at = "expired", now
    record_event(event_type="access_grant.ended", actor=actor, actor_role="professional", patient=grant.patient, establishment=grant.establishment, access_grant=grant, metadata={"action": "ended", "status": "expired", "reason_code": reason})
    title, body = _END_NOTIFICATIONS[reason]
    notify_patient(grant.patient, kind="access.ended", title=title, body=body.format(who=grant.professional_name, where=grant.facility_label), metadata={"access_grant_id": str(grant.id), "reason": reason})
    return True


def require_scope(grant, scope):
    """Porte unique de lecture clinique : l’autorisation est active **et** couvre ce périmètre.

    Tout endpoint qui lit une donnée du patient pour un professionnel passe par ici avec le périmètre qu’il expose
    (`preconsultation`, `declarations`, `consultations`, `documents`). Le patient accorde ces périmètres à l’acceptation ; sans cette
    vérification, un périmètre refusé resterait lisible. Lève `PermissionDenied` (403) : l’appelant n’a rien d’autre à tester.

    Le rattachement au professionnel reste vérifié par l’appelant; un établissement suspendu ne peut plus servir de contexte à
    une lecture clinique, même si le patient avait précédemment accordé une autorisation encore active.
    """
    if scope not in ALLOWED_SCOPES:
        # Une faute de frappe côté code ne doit jamais ouvrir ni fermer un accès par hasard.
        raise ValueError(f"Périmètre inconnu : {scope!r}")
    grant.refresh_expiration()
    if grant.status != "active":
        raise PermissionDenied(GRANT_NOT_ACTIVE_MESSAGE)
    if grant.establishment.status != "active":
        raise PermissionDenied("L’établissement associé à cette autorisation est suspendu.")
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
def create_professional_grant(*, professional, qr_token=None, scope=None, source_establishments=None):
    """Ouvre l’accès d’un professionnel à un patient. Le QR du patient est exigé à chaque fois : aucun identifiant de patient n’est accepté.

    Le scan vaut accord : pour le périmètre de base (pré-consultation, déclarations, documents en lecture seule) l’accès est actif tout de suite,
    deux heures, et un seul professionnel peut être connecté à la fois. Un périmètre plus large (consultations passées, historique d’autres
    structures) reste une demande en attente que le patient doit accepter."""
    access_error = professional_clinical_access_error(professional)
    if access_error:
        raise ValidationError(access_error)
    establishment = professional.active_establishment
    if not isinstance(qr_token, str) or not qr_token.strip():
        raise ValidationError(QR_REQUIRED_MESSAGE)
    token = patient_from_qr_token(qr_token.strip(), for_update=True)
    patient = token.patient
    if is_own_patient_file(professional, patient):
        # Un professionnel ne s'ouvre jamais son propre dossier : le jeton n'est pas consommé, il reste utilisable côté patient.
        raise SelfAccessRefused(SELF_ACCESS_MESSAGE)
    requested_scope = list(dict.fromkeys([*(scope or DEFAULT_SCOPES), *REQUIRED_SCOPES]))
    if not requested_scope or any(item not in ALLOWED_SCOPES for item in requested_scope):
        raise ValidationError("Le périmètre demandé contient une valeur non autorisée en V1.")
    selected_sources = [str(item) for item in (source_establishments or [])]
    if "care_history" in requested_scope and not selected_sources:
        raise ValidationError("Sélectionnez au moins une structure source pour l’historique de soins.")
    if selected_sources:
        from .models import Consultation, HealthMeasurement, MedicalDocument, Vaccination
        available_sources = set(Consultation.objects.filter(patient=patient, establishment__isnull=False).values_list("establishment_id", flat=True))
        available_sources.update(HealthMeasurement.objects.filter(patient=patient, establishment__isnull=False, validated_at__isnull=False).values_list("establishment_id", flat=True))
        available_sources.update(MedicalDocument.objects.filter(patient=patient, establishment__isnull=False, validated_at__isnull=False, verified=True).values_list("establishment_id", flat=True))
        available_sources.update(Vaccination.objects.filter(patient=patient, establishment__isnull=False, status="confirmed").values_list("establishment_id", flat=True))
        if not set(selected_sources).issubset({str(item) for item in available_sources}):
            raise ValidationError("Une structure source ne possède aucun soin validé partageable pour ce patient.")
    auto_accept = set(requested_scope) <= AUTO_GRANT_SCOPES
    if auto_accept:
        # Sérialise les ouvertures concurrentes sur ce patient : deux professionnels ne peuvent pas se connecter en même temps.
        from apps.patients.models import PatientProfile
        PatientProfile.objects.select_for_update().get(pk=patient.pk)
        if other_professional_connected(patient, professional):
            raise ValidationError(ANOTHER_PROFESSIONAL_CONNECTED_MESSAGE)
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
        raise ValidationError("Vous êtes déjà connecté à ce patient dans cet établissement." if existing.status == "active" else "Une demande active existe déjà pour ce patient et cet établissement.")
    cutoff = timezone.now() - REFUSED_GRANT_COOLDOWN
    # Le délai de 30 jours protège le patient des demandes répétées ; un QR qu'il présente lui-même est, au contraire, sa propre initiative.
    if not auto_accept and AccessGrant.objects.filter(
        patient=patient,
        professional=professional,
        establishment=establishment,
        status="refused",
        refused_at__gt=cutoff,
    ).exists():
        raise ValidationError("Une nouvelle demande est possible 30 jours après le refus.")
    now = timezone.now()
    try:
        with transaction.atomic():
            grant = AccessGrant.objects.create(
                patient=patient,
                professional=professional,
                establishment=establishment,
                professional_name=f"{professional.user.first_name} {professional.user.last_name}".strip() or professional.professional_title,
                facility_label=establishment.name,
                scope=requested_scope,
                source_establishments=selected_sources,
                status="active" if auto_accept else "pending",
                starts_at=now if auto_accept else None,
                expires_at=now + (AUTO_GRANT_DURATION if auto_accept else PENDING_GRANT_TTL),
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

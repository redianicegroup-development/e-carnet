"""Mode invité (décision du 16/11/2026) : un patient sans téléphone est retrouvé par nom + date de naissance + téléphone.

Ces trois informations IDENTIFIENT, elles ne sont pas des secrets : elles servent à retrouver le bon dossier, pas à prouver qui est là.
La preuve est visuelle : le professionnel compare le profil affiché (avec sa photo) à la personne présente, puis confirme. L'accès reste borné :
périmètre minimal, deux heures, un seul professionnel à la fois, patient alerté, chaque étape tracée, essais limités.
"""
import hashlib
import hmac
import re
import secrets
import unicodedata
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.patients.models import PatientProfile
from apps.professionals.access import professional_clinical_access_error

from .models import AccessGrant, GuestLookupAttempt, GuestProfessionalLookupAttempt
from .services import (
    ANOTHER_PROFESSIONAL_CONNECTED_MESSAGE,
    AUTO_GRANT_DURATION,
    SELF_ACCESS_MESSAGE,
    SelfAccessRefused,
    is_own_patient_file,
    other_professional_connected,
)

GUEST_ACCESS_MODE = "guest"  # patient sans téléphone, retrouvé sur le téléphone du médecin
GUEST_PRO_ACCESS_MODE = "guest_pro"  # médecin sans téléphone, retrouvé sur le téléphone du patient
GUEST_METHOD = "guest_identity"
# Périmètre minimal : la pré-consultation de CE patient dans CET établissement, ce qu'il faut pour écrire et signer la consultation.
# Ni documents, ni déclarations, ni historique : élargir ce périmètre est une décision à part (voir la note de livraison).
GUEST_SCOPES = ["preconsultation"]

CONFIRMATION_TTL = timedelta(minutes=5)
MAX_FAILED_PER_PROFESSIONAL = 5
PROFESSIONAL_WINDOW = timedelta(minutes=15)
MAX_FAILED_PER_TARGET = 10
TARGET_WINDOW = timedelta(hours=1)
ATTEMPT_RETENTION = timedelta(days=30)
MIN_PHONE_DIGITS = 8

# Une seule phrase pour « aucun dossier », « plusieurs dossiers » et « téléphone différent » : la réponse ne révèle jamais qui est patient.
LOOKUP_FAILED_MESSAGE = "Aucun dossier ne correspond à ces informations. Vérifiez-les avec le patient."
LOOKUP_LOCKED_MESSAGE = "Trop de recherches sans résultat. Réessayez dans quelques minutes."
CONFIRMATION_INVALID_MESSAGE = "Cette confirmation a expiré ou a déjà servi. Refaites la recherche."


class GuestLookupLocked(Exception):
    """Trop d'essais sans résultat : la recherche est suspendue un moment."""


def _fold(value):
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", text.casefold()).strip()


def _name_tokens(first_name, last_name):
    """Jeu de mots du nom complet : l'ordre prénom/nom, les accents, la casse et les tirets ne comptent pas (un oubli de format ne doit pas bloquer)."""
    return frozenset(_fold(f"{first_name} {last_name}").split())


def _digits(value):
    return re.sub(r"\D", "", str(value or ""))


def phones_match(left, right):
    """Même numéro, avec ou sans indicatif (+225) : on compare les 10 derniers chiffres, ou les 8 derniers quand l'un des deux est à l'ancien format."""
    a, b = _digits(left), _digits(right)
    if len(a) < MIN_PHONE_DIGITS or len(b) < MIN_PHONE_DIGITS:
        return False
    size = 10 if len(a) >= 10 and len(b) >= 10 else 8
    return a[-size:] == b[-size:]


def _target_hash(tokens, birth_date):
    """Empreinte de l'identité visée (sans le téléphone, pour que deviner des numéros sur la même personne compte comme une seule cible)."""
    message = f"{'|'.join(sorted(tokens))}#{birth_date.isoformat()}".encode("utf-8")
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()


def _digest(raw_token):
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _recent_failures(since, **filters):
    return GuestLookupAttempt.objects.filter(succeeded=False, created_at__gt=since, **filters).count()


def _check_not_locked(professional, target_hash):
    now = timezone.now()
    if _recent_failures(now - PROFESSIONAL_WINDOW, professional=professional) >= MAX_FAILED_PER_PROFESSIONAL:
        raise GuestLookupLocked(LOOKUP_LOCKED_MESSAGE)
    if _recent_failures(now - TARGET_WINDOW, target_hash=target_hash) >= MAX_FAILED_PER_TARGET:
        raise GuestLookupLocked(LOOKUP_LOCKED_MESSAGE)


def _professional_display_name(professional):
    return f"{professional.user.first_name} {professional.user.last_name}".strip() or professional.professional_title


def find_guest_patient(*, professional, first_name, last_name, birth_date, phone):
    """Retrouve UN dossier à partir des trois informations, ou refuse sans dire pourquoi.

    Retourne (patient, jeton) : le jeton est opaque, à usage unique, valable cinq minutes, lié à ce professionnel. Aucun identifiant de patient
    ne circule entre les deux étapes. Un échec est compté (professionnel et personne visée) ; au-delà du seuil la recherche est suspendue."""
    access_error = professional_clinical_access_error(professional)
    if access_error:
        raise ValidationError(access_error)
    tokens = _name_tokens(first_name, last_name)
    if not tokens or len(_digits(phone)) < MIN_PHONE_DIGITS:
        raise ValidationError(LOOKUP_FAILED_MESSAGE)
    target_hash = _target_hash(tokens, birth_date)
    GuestLookupAttempt.objects.filter(created_at__lt=timezone.now() - ATTEMPT_RETENTION).delete()
    _check_not_locked(professional, target_hash)
    candidates = PatientProfile.objects.filter(birth_date=birth_date).select_related("user")
    matches = [
        patient for patient in candidates
        if _name_tokens(patient.display_first_name(), patient.display_last_name()) == tokens and phones_match(patient.phone, phone)
    ]
    if len(matches) != 1:
        GuestLookupAttempt.objects.create(professional=professional, target_hash=target_hash, succeeded=False)
        raise ValidationError(LOOKUP_FAILED_MESSAGE)
    patient = matches[0]
    if is_own_patient_file(professional, patient):
        raise SelfAccessRefused(SELF_ACCESS_MESSAGE)
    raw = secrets.token_urlsafe(32)
    GuestLookupAttempt.objects.create(professional=professional, target_hash=target_hash, succeeded=True, patient=patient, token_hash=_digest(raw))
    return patient, raw


@transaction.atomic
def start_guest_grant(*, professional, confirmation_token):
    """Ouvre l'accès invité après la confirmation visuelle du professionnel. Mêmes garde-fous que le QR : un seul professionnel connecté à la fois."""
    access_error = professional_clinical_access_error(professional)
    if access_error:
        raise ValidationError(access_error)
    if not isinstance(confirmation_token, str) or not confirmation_token.strip():
        raise ValidationError(CONFIRMATION_INVALID_MESSAGE)
    now = timezone.now()
    attempt = (
        GuestLookupAttempt.objects.select_for_update(of=("self",))
        .select_related("patient")
        .filter(
            token_hash=_digest(confirmation_token.strip()),
            professional=professional,
            succeeded=True,
            consumed_at__isnull=True,
            created_at__gt=now - CONFIRMATION_TTL,
            patient__isnull=False,
        )
        .first()
    )
    if not attempt:
        raise ValidationError(CONFIRMATION_INVALID_MESSAGE)
    patient = attempt.patient
    if is_own_patient_file(professional, patient):
        raise SelfAccessRefused(SELF_ACCESS_MESSAGE)
    grant = _open_guest_grant(patient=patient, professional=professional, access_mode=GUEST_ACCESS_MODE, now=now)
    attempt.consumed_at = now
    attempt.save(update_fields=("consumed_at",))
    return grant


def _open_guest_grant(*, patient, professional, access_mode, now):
    """Ouvre l'accès invité (2 h, pré-consultation seulement). Mêmes garde-fous que le QR : un seul professionnel connecté à la fois."""
    establishment = professional.active_establishment
    # Sérialise les ouvertures concurrentes sur ce patient : deux professionnels ne peuvent pas être connectés en même temps.
    PatientProfile.objects.select_for_update().get(pk=patient.pk)
    if other_professional_connected(patient, professional):
        raise ValidationError(ANOTHER_PROFESSIONAL_CONNECTED_MESSAGE)
    for stale in AccessGrant.objects.select_for_update().filter(patient=patient, professional=professional, establishment=establishment, status__in=("pending", "active"), expires_at__lte=now):
        stale.refresh_expiration()
    if AccessGrant.objects.filter(patient=patient, professional=professional, establishment=establishment, status__in=("pending", "active")).exists():
        raise ValidationError("Vous êtes déjà connecté à ce patient dans cet établissement.")
    try:
        with transaction.atomic():
            return AccessGrant.objects.create(
                patient=patient,
                professional=professional,
                establishment=establishment,
                professional_name=_professional_display_name(professional),
                facility_label=establishment.name,
                scope=list(GUEST_SCOPES),
                access_mode=access_mode,
                status="active",
                starts_at=now,
                expires_at=now + AUTO_GRANT_DURATION,
            )
    except IntegrityError:
        raise ValidationError("Une demande active existe déjà pour ce patient et cet établissement.") from None


# --- Médecin sans téléphone : il est retrouvé sur le téléphone du patient (nom + date de naissance + téléphone du MÉDECIN) ---------------
PROFESSIONAL_LOOKUP_FAILED_MESSAGE = "Aucun professionnel ne correspond à ces informations. Vérifiez-les avec lui."


def _eligible_professional(profile):
    """Retrouvé par une identification faible (nom + naissance + téléphone), un professionnel doit être vérifié, en plus de pouvoir exercer."""
    ok = profile and profile.verification_status == "verified" and not professional_clinical_access_error(profile) and profile.active_establishment
    return profile if ok else None


def find_guest_professional(*, patient, first_name, last_name, birth_date, phone):
    """Retrouve UN professionnel à partir de ses trois informations, saisies par lui sur le téléphone du patient.

    Un professionnel garde son identité (naissance, téléphone) sur son propre carnet : c'est elle qui est comparée. Seuls les professionnels
    vérifiés et pouvant exercer (rattachement actif dans un établissement actif) sont retrouvés. Même réponse pour « personne », « plusieurs » et « téléphone différent »."""
    tokens = _name_tokens(first_name, last_name)
    if not tokens or len(_digits(phone)) < MIN_PHONE_DIGITS:
        raise ValidationError(PROFESSIONAL_LOOKUP_FAILED_MESSAGE)
    target_hash = _target_hash(tokens, birth_date)
    now = timezone.now()
    GuestProfessionalLookupAttempt.objects.filter(created_at__lt=now - ATTEMPT_RETENTION).delete()
    failures = GuestProfessionalLookupAttempt.objects.filter(succeeded=False)
    if failures.filter(patient=patient, created_at__gt=now - PROFESSIONAL_WINDOW).count() >= MAX_FAILED_PER_PROFESSIONAL \
            or failures.filter(target_hash=target_hash, created_at__gt=now - TARGET_WINDOW).count() >= MAX_FAILED_PER_TARGET:
        raise GuestLookupLocked(LOOKUP_LOCKED_MESSAGE)
    candidates = PatientProfile.objects.filter(birth_date=birth_date, user__professional_profile__isnull=False).select_related("user", "user__professional_profile")
    matches = [
        candidate.user.professional_profile for candidate in candidates
        if _name_tokens(candidate.display_first_name(), candidate.display_last_name()) == tokens and phones_match(candidate.phone, phone)
        and _eligible_professional(candidate.user.professional_profile)
    ]
    if len(matches) != 1:
        GuestProfessionalLookupAttempt.objects.create(patient=patient, target_hash=target_hash, succeeded=False)
        raise ValidationError(PROFESSIONAL_LOOKUP_FAILED_MESSAGE)
    professional = matches[0]
    if is_own_patient_file(professional, patient):
        raise SelfAccessRefused(SELF_ACCESS_MESSAGE)
    raw = secrets.token_urlsafe(32)
    GuestProfessionalLookupAttempt.objects.create(patient=patient, target_hash=target_hash, succeeded=True, professional=professional, token_hash=_digest(raw))
    return professional, raw


@transaction.atomic
def start_guest_professional_grant(*, patient, confirmation_token):
    """Le patient a comparé le profil du médecin avec la personne devant lui et confirme : une session limitée s'ouvre pour qu'il écrive la consultation."""
    if not isinstance(confirmation_token, str) or not confirmation_token.strip():
        raise ValidationError(CONFIRMATION_INVALID_MESSAGE)
    now = timezone.now()
    attempt = (
        GuestProfessionalLookupAttempt.objects.select_for_update(of=("self",))
        .select_related("professional")
        .filter(token_hash=_digest(confirmation_token.strip()), patient=patient, succeeded=True, consumed_at__isnull=True, created_at__gt=now - CONFIRMATION_TTL, professional__isnull=False)
        .first()
    )
    if not attempt:
        raise ValidationError(CONFIRMATION_INVALID_MESSAGE)
    professional = _eligible_professional(attempt.professional)
    if not professional:
        raise ValidationError(PROFESSIONAL_LOOKUP_FAILED_MESSAGE)
    if is_own_patient_file(professional, patient):
        raise SelfAccessRefused(SELF_ACCESS_MESSAGE)
    grant = _open_guest_grant(patient=patient, professional=professional, access_mode=GUEST_PRO_ACCESS_MODE, now=now)
    attempt.consumed_at = now
    attempt.save(update_fields=("consumed_at",))
    return grant

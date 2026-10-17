"""Réinitialisation du mot de passe par question secrète.

Décision produit : tant que l'OTP n'existe pas, la réponse à la question secrète suffit pour choisir un nouveau mot de passe ;
l'OTP viendra ensuite la confirmer (il s'ajoutera dans `verify_recovery_proof`, point d'extension unique).

Une question secrète est un secret faible (réponses devinables, parfois publiques). Ce module compense par :
- l'uniformité : un e-mail inconnu, un compte sans question ou un compte exclu reçoivent la même réponse qu'un vrai compte
  (question « leurre » stable, même message d'échec, même temps de calcul grâce à un faux hachage) : on ne peut pas s'en servir
  pour savoir si une adresse a un compte ;
- le verrouillage durable par compte : tous les 5 échecs d'affilée, la récupération se ferme 15 min, puis 30 min, 1 h… jusqu'à 24 h ;
  un échec n'apprend jamais à l'appelant si le compte est verrouillé (même message) ;
- la limitation de débit par IP et par adresse (voir RecoveryEmailThrottle) ;
- l'exclusion des comptes d'administration (staff, superuser) : on ne prend pas la main sur un compte d'équipe avec une question ;
- l'invalidation des autres sessions (changer le mot de passe change le hachage d'authentification de session de Django) ;
- l'alerte : un événement d'audit et un e-mail au titulaire à chaque réinitialisation réussie (jamais le mot de passe).
"""
import hashlib
import hmac
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.services import record_event
from .models import AccountProfile

FAILURES_PER_LOCK = 5
BASE_LOCK = timedelta(minutes=15)
MAX_LOCK = timedelta(hours=24)

GENERIC_FAILURE = "Les informations ne correspondent pas. Vérifiez votre réponse, ou écrivez à l’équipe si vous ne vous en souvenez plus."

# Les questions proposées à l'inscription (RecoverySetup.tsx). Un compte inconnu reçoit l'une d'elles, toujours la même pour une adresse donnée.
PRESET_QUESTIONS = (
    "Quel était le nom de votre première école ?",
    "Quel était votre ancien pseudonyme ?",
    "Quel surnom utilisiez-vous pendant votre enfance ?",
)
# Haché une fois au chargement : sert à dépenser le même temps de calcul quand il n'y a pas de vrai hachage à comparer.
_DUMMY_HASH = make_password("ecarnet-recovery-timing-equalizer")


def normalize_answer(value: str) -> str:
    """Même normalisation qu'à l'enregistrement (RecoverySetupSerializer + casefold) : espaces et casse ne comptent pas."""
    return " ".join(str(value).split()).casefold()


def _account_for(email: str):
    """Même règle qu'à la connexion : une adresse qui désigne plusieurs comptes n'en désigne aucun."""
    matches = get_user_model().objects.filter(email__iexact=email.strip())
    user = matches.first() if matches.count() == 1 else None
    if not user:
        return None, None
    profile = AccountProfile.objects.filter(user=user).first()
    eligible = bool(
        profile and user.is_active and not user.is_staff and not user.is_superuser
        and profile.recovery_question and profile.recovery_answer_hash
    )
    return (user, profile) if eligible else (None, None)


def decoy_question(email: str) -> str:
    digest = hmac.new(settings.SECRET_KEY.encode(), f"recovery-decoy:{email.strip().lower()}".encode(), hashlib.sha256).digest()
    return PRESET_QUESTIONS[digest[0] % len(PRESET_QUESTIONS)]


def question_for(email: str) -> str:
    """La question à afficher : la vraie si le compte peut se récupérer, sinon un leurre stable. L'appelant ne peut pas les distinguer."""
    _, profile = _account_for(email)
    return profile.recovery_question if profile else decoy_question(email)


def verify_recovery_proof(profile, answer: str) -> bool:
    """Point d'extension : la preuve de possession accepte aujourd'hui la seule réponse secrète ; l'OTP s'y ajoutera (et sera exigé)."""
    hashed = profile.recovery_answer_hash if profile else _DUMMY_HASH
    matches = check_password(normalize_answer(answer), hashed)
    return bool(profile) and matches


def _lock_duration(failures: int) -> timedelta:
    # L'exposant est plafonné avant le calcul : 15 min × 2^7 dépasse déjà les 24 h, et un exposant non borné finirait par faire déborder timedelta.
    doublings = min(max(0, failures // FAILURES_PER_LOCK - 1), 7)
    return min(BASE_LOCK * (2 ** doublings), MAX_LOCK)


def validate_new_password(new_password: str) -> None:
    """Contrôle indépendant du compte et de la réponse : il ne peut donc pas servir à savoir si la réponse était la bonne."""
    try:
        validate_password(new_password)
    except DjangoValidationError as exc:
        raise ValidationError({"new_password": list(exc.messages)})


@transaction.atomic
def reset_password_with_answer(*, email: str, answer: str, new_password: str) -> bool:
    """Vrai si le mot de passe a été changé. Faux pour toute autre raison, sans distinction (inconnu, verrouillé, mauvaise réponse…)."""
    user, profile = _account_for(email)
    if profile:
        profile = AccountProfile.objects.select_for_update().get(pk=profile.pk)
    now = timezone.now()
    locked = bool(profile and profile.recovery_locked_until and profile.recovery_locked_until > now)
    # Un compte verrouillé dépense quand même le calcul de hachage, avec une réponse qui ne peut pas réussir.
    proven = verify_recovery_proof(None if locked else profile, answer)
    if not proven:
        if profile and not locked:
            # Plafonné (multiple de 5) : le champ est un entier court, et au-delà le verrou est de toute façon à son maximum de 24 h.
            profile.recovery_failures = min((profile.recovery_failures or 0) + 1, 30000)
            update = ["recovery_failures", "updated_at"]
            if profile.recovery_failures % FAILURES_PER_LOCK == 0:
                profile.recovery_locked_until = now + _lock_duration(profile.recovery_failures)
                update.append("recovery_locked_until")
                record_event(event_type="account.recovery_locked", actor=user, actor_role="account", metadata={"action": "locked", "extension_count": profile.recovery_failures})
            profile.save(update_fields=update)
        return False
    user.set_password(new_password)
    user.save(update_fields=["password"])
    profile.recovery_failures = 0
    profile.recovery_locked_until = None
    profile.save(update_fields=["recovery_failures", "recovery_locked_until", "updated_at"])
    record_event(event_type="account.password_reset_by_recovery", actor=user, actor_role="account", metadata={"action": "password_reset", "status": "success"})
    _notify_owner(user)
    return True


def _notify_owner(user) -> None:
    """Alerte au titulaire : s'il n'est pas à l'origine du changement, il le sait tout de suite. Au mieux : un échec d'envoi ne défait rien."""
    try:
        send_mail(
            "Mon E‑Carnet : votre mot de passe a été réinitialisé",
            "Bonjour,\n\nLe mot de passe de votre compte Mon E‑Carnet vient d’être réinitialisé avec votre question secrète.\n"
            "Si c’est bien vous, rien à faire. Sinon, écrivez-nous sans attendre depuis la page de contact du site : "
            "nous sécuriserons votre compte.\n\nPar sécurité, vos autres appareils ont été déconnectés.\n",
            None,
            [user.email],
            fail_silently=True,
        )
    except Exception:  # noqa: BLE001 — l'alerte est un plus, jamais une raison de refuser la réinitialisation
        pass

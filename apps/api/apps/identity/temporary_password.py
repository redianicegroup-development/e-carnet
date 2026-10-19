"""Mot de passe temporaire à usage unique, remis par l'équipe Mon E‑Carnet (ex. responsable d'établissement).

Principe :
- le serveur génère un mot de passe aléatoire, le hache comme n'importe quel mot de passe et ne le conserve jamais en clair ;
  il n'est révélé qu'une fois, dans la réponse réservée au staff qui l'a émis, pour transmission hors application ;
- le compte porte `must_change_password` : tant que ce drapeau est levé, `ForcePasswordChangeMiddleware` ferme toute l'API
  sauf la lecture du compte, le changement de mot de passe et la déconnexion ;
- le mot de passe temporaire expire (`TEMPORARY_PASSWORD_TTL`) : passé ce délai, la connexion est refusée comme n'importe
  quel mauvais mot de passe, et l'équipe en émet un nouveau ;
- le changement le remplace (donc « usage unique ») et lève le drapeau.
"""
import secrets
from datetime import datetime, timedelta

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone

from .models import AccountProfile

TEMPORARY_PASSWORD_TTL = timedelta(days=7)
# Sans caractères ambigus (0/O, 1/l/I) : le mot de passe se dicte au téléphone ou se recopie à la main.
_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
_LOWER = "abcdefghijkmnopqrstuvwxyz"
_DIGITS = "23456789"
_ALPHABET = _UPPER + _LOWER + _DIGITS
GROUPS, GROUP_LENGTH = 4, 4  # « Xk7m-Qp2d-Vt9a-Hw4n » : 16 caractères aléatoires, lisibles par groupes


def generate_temporary_password(user=None) -> str:
    """Mot de passe aléatoire conforme à la politique du site (majuscule, minuscule, chiffre, validateurs Django)."""
    for _ in range(50):
        candidate = "-".join("".join(secrets.choice(_ALPHABET) for _ in range(GROUP_LENGTH)) for _ in range(GROUPS))
        if not (any(c in _UPPER for c in candidate) and any(c in _LOWER for c in candidate) and any(c in _DIGITS for c in candidate)):
            continue
        try:
            validate_password(candidate, user=user)
        except DjangoValidationError:
            continue
        return candidate
    raise RuntimeError("Impossible de générer un mot de passe temporaire conforme.")


def issue_temporary_password(user) -> tuple[str, datetime]:
    """Remplace le mot de passe du compte par un mot de passe temporaire et impose son changement à la prochaine connexion.

    Renvoie (mot de passe en clair, expiration). L'appelant le remet au staff une seule fois ; il n'est stocké nulle part."""
    password = generate_temporary_password(user)
    expires_at = timezone.now() + TEMPORARY_PASSWORD_TTL
    user.set_password(password)
    user.save(update_fields=["password"])
    profile, _ = AccountProfile.objects.get_or_create(user=user)
    profile.must_change_password = True
    profile.temporary_password_expires_at = expires_at
    profile.save(update_fields=["must_change_password", "temporary_password_expires_at", "updated_at"])
    return password, expires_at


def disable_temporary_password(user) -> None:
    """Retire l'accès d'un compte qui n'a jamais été activé : le mot de passe temporaire ne fonctionne plus."""
    user.set_unusable_password()
    user.save(update_fields=["password"])
    AccountProfile.objects.filter(user=user).update(temporary_password_expires_at=timezone.now())


def has_pending_temporary_password(user) -> bool:
    """Le compte attend encore son premier changement de mot de passe."""
    return AccountProfile.objects.filter(user=user, must_change_password=True).exists()


def temporary_password_expired(profile) -> bool:
    return bool(profile and profile.must_change_password and profile.temporary_password_expires_at and profile.temporary_password_expires_at <= timezone.now())

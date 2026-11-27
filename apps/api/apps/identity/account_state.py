"""État d'un compte : suspension demandée par la personne, désactivation par l'équipe, journal des connexions.

Deux causes distinctes ferment un compte (`User.is_active = False`) :

* **Suspension** demandée par la personne : immédiate, d'une durée choisie (1 à 90 jours). Le compte se rouvre tout seul à l'échéance,
  à la première tentative de connexion qui suit (`lift_expired_suspension`).
* **Désactivation par l'équipe** (console → Utilisateurs) : tant que `AccountProfile.staff_deactivated_at` est posé, aucune échéance ne rouvre
  le compte. Seule la réactivation par l'équipe le fait.

L'équipe ne gère pas les suspensions des personnes : elle voit un journal en lecture seule (motif et durée), rien d'autre.
"""
import logging
from datetime import timedelta

from django.db import DatabaseError
from django.utils import timezone

from .models import AccountActionRequest, AccountProfile, LoginEvent

logger = logging.getLogger(__name__)

LOGIN_EVENT_RETENTION_DAYS = 90
SUSPENDED_CODE = "account_suspended"
DEACTIVATED_CODE = "account_deactivated"


def record_login(user, outcome, method="password"):
    """Ajoute une ligne au journal des connexions. Un échec d'écriture ne doit jamais bloquer une connexion."""
    try:
        LoginEvent.objects.create(user=user, outcome=outcome, method=method)
    except DatabaseError:
        logger.exception("journal des connexions: écriture impossible")


def active_suspension(user, now=None):
    """Suspension demandée par la personne et encore en cours, ou None."""
    now = now or timezone.now()
    return (
        AccountActionRequest.objects.filter(user=user, request_type="suspension", suspended_until__gt=now, lifted_at__isnull=True)
        .order_by("-suspended_until").first()
    )


def lift_expired_suspension(user, now=None):
    """Rouvre un compte dont la suspension est arrivée à échéance. Renvoie True si le compte vient d'être rouvert.

    Ne fait rien pour un compte désactivé par l'équipe, ni pour un compte supprimé (identité effacée, mot de passe inutilisable)."""
    now = now or timezone.now()
    if user.is_active or not user.has_usable_password():
        return False
    profile = AccountProfile.objects.filter(user=user).first()
    if profile and profile.staff_deactivated_at:
        return False
    ended = AccountActionRequest.objects.filter(user=user, request_type="suspension", suspended_until__lte=now, lifted_at__isnull=True)
    if not ended.exists():
        return False
    ended.update(lifted_at=now)
    if active_suspension(user, now):  # une autre suspension, plus longue, est encore en cours
        return False
    user.is_active = True
    user.save(update_fields=("is_active",))
    return True


def block_state(user, now=None):
    """Pourquoi un compte fermé l'est : {code, message, until}. Réservé aux personnes qui viennent de prouver leur mot de passe."""
    now = now or timezone.now()
    profile = AccountProfile.objects.filter(user=user).first()
    if profile and profile.staff_deactivated_at:
        return {"code": DEACTIVATED_CODE, "until": None, "message": "Ce compte est désactivé. Écrivez à l’équipe Mon E‑Carnet pour demander sa réactivation."}
    suspension = active_suspension(user, now)
    if suspension:
        until = timezone.localtime(suspension.suspended_until).strftime("%d/%m/%Y à %H:%M")
        return {"code": SUSPENDED_CODE, "until": suspension.suspended_until.isoformat(), "message": f"Votre compte est suspendu jusqu’au {until}. Il se rouvrira de lui-même : reconnectez-vous à partir de cette date."}
    return {"code": DEACTIVATED_CODE, "until": None, "message": "Ce compte est désactivé. Écrivez à l’équipe Mon E‑Carnet pour demander sa réactivation."}


def user_state(user, now=None):
    """État lisible d'un compte pour la console : active, suspended (par la personne) ou disabled (par l'équipe ou autre cause)."""
    now = now or timezone.now()
    if user.is_active:
        return "active"
    profile = getattr(user, "account_profile", None)
    if profile and profile.staff_deactivated_at:
        return "disabled"
    return "suspended" if active_suspension(user, now) else "disabled"


def staff_deactivate(user, now=None):
    now = now or timezone.now()
    profile, _ = AccountProfile.objects.get_or_create(user=user)
    profile.staff_deactivated_at = now
    profile.save(update_fields=("staff_deactivated_at", "updated_at"))
    user.is_active = False
    user.save(update_fields=("is_active",))


def staff_reactivate(user, now=None):
    now = now or timezone.now()
    AccountProfile.objects.filter(user=user).update(staff_deactivated_at=None)
    AccountActionRequest.objects.filter(user=user, request_type="suspension", lifted_at__isnull=True).update(lifted_at=now)
    user.is_active = True
    user.save(update_fields=("is_active",))


def delete_old_login_events(now=None):
    cutoff = (now or timezone.now()) - timedelta(days=LOGIN_EVENT_RETENTION_DAYS)
    deleted, _ = LoginEvent.objects.filter(created_at__lt=cutoff).delete()
    return deleted

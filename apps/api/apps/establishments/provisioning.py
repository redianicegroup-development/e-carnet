"""Accès du responsable d'un établissement, ouvert par l'équipe Mon E‑Carnet.

L'équipe saisit le nom vérifié de la structure et l'e‑mail de son responsable. Le serveur mémorise cet e‑mail, crée le compte
correspondant avec un mot de passe temporaire aléatoire et rattache ce compte à l'établissement. Ce mot de passe n'est révélé
qu'une fois, au staff, pour transmission hors application ; le responsable se connecte avec son e‑mail et ce mot de passe, est
obligé de le remplacer (voir identity/temporary_password.py), puis complète la fiche de son établissement.

Aucun courriel n'est nécessaire : l'ouverture d'un accès ne dépend plus de la disponibilité du SMTP.
"""
from dataclasses import dataclass
from datetime import datetime

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.audit.services import record_event
from apps.identity.models import AccountContext
from apps.identity.temporary_password import has_pending_temporary_password, issue_temporary_password

from .models import Establishment, EstablishmentAdministrator

User = get_user_model()


class AccountConflict(Exception):
    """L'e‑mail désigne déjà un compte : on ne lui impose pas de mot de passe sans confirmation explicite du staff."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass
class ProvisionedAccess:
    user: object
    temporary_password: str | None
    expires_at: datetime | None
    account_created: bool


def login_url() -> str:
    return f"{settings.WEB_ORIGIN.rstrip('/')}/connexion"


def provision_administrator(
    *, establishment: Establishment, assigned_by, email: str, first_name: str = "", last_name: str = "", use_existing_account: bool = False
) -> ProvisionedAccess:
    """Crée (ou rattache) le compte du responsable et le désigne administrateur actif de la structure.

    À appeler dans une transaction. Lève AccountConflict, sans rien écrire, si l'e‑mail désigne un compte que le staff n'a pas
    explicitement choisi de rattacher (le mot de passe d'un compte existant n'est jamais modifié)."""
    email = email.strip().lower()
    matches = list(User.objects.filter(email__iexact=email)[:2])
    if len(matches) > 1:
        raise AccountConflict("ambiguous_account")
    existing = matches[0] if matches else None
    # Un compte ouvert par l'équipe et jamais activé (révoqué, ou rouvert pour une autre structure) reste « le nôtre » :
    # son mot de passe temporaire est simplement renouvelé, sans confirmation.
    pending = existing is not None and has_pending_temporary_password(existing)
    if existing and not (use_existing_account or pending):
        raise AccountConflict("account_exists")

    temporary_password = expires_at = None
    if existing:
        user = existing
    else:
        user = User.objects.create_user(username=email, email=email, first_name=first_name.strip()[:120], last_name=last_name.strip()[:120])
    if pending or not existing:
        temporary_password, expires_at = issue_temporary_password(user)

    now = timezone.now()
    current = EstablishmentAdministrator.objects.filter(establishment=establishment, status="active")
    current.exclude(user=user).update(status="ended", ended_at=now)
    if not current.filter(user=user).exists():
        EstablishmentAdministrator.objects.create(establishment=establishment, user=user, assigned_by=assigned_by, status="active")

    establishment.responsible_name = f"{user.first_name} {user.last_name}".strip()
    # L'e‑mail de contact de la structure est celui du compte ouvert : verrouillé, jamais ressaisi dans la fiche.
    establishment.email = user.email
    establishment.save(update_fields=("responsible_name", "email", "updated_at"))

    context, _ = AccountContext.objects.get_or_create(user=user, role="establishment")
    context.is_active = True
    # L'onboarding de l'établissement est la fiche à compléter : il n'est « terminé » qu'une fois la fiche renseignée.
    context.onboarding_completed = establishment.is_profile_complete
    context.save(update_fields=("is_active", "onboarding_completed", "updated_at"))

    record_event(
        event_type="establishment.administrator.provisioned",
        actor=assigned_by,
        actor_role="ecarnet_staff",
        establishment=establishment,
        metadata={"action": "provisioned", "status": "temporary_password" if temporary_password else "existing_account"},
    )
    return ProvisionedAccess(user=user, temporary_password=temporary_password, expires_at=expires_at, account_created=existing is None)

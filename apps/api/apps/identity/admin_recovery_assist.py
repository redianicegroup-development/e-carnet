"""Aide de l'équipe à la récupération de compte : retrouver un compte, lever un blocage, remettre un mot de passe temporaire.

Principe : l'équipe n'a jamais besoin de LIRE un secret pour aider.
- La réponse à la question secrète n'est conservée que sous forme de hachage à sens unique (`AccountProfile.recovery_answer_hash`) : personne,
  administrateur compris, ne peut la lire, et ce n'est pas souhaitable : une réponse lue par un tiers est un identifiant volé en puissance.
- Ce que l'équipe voit pour vérifier qu'elle parle bien au titulaire : la question choisie (la personne doit s'en souvenir même si elle a oublié
  la réponse), la date d'inscription, le dernier accès, les rôles, le nombre d'échecs et un éventuel blocage. Jamais la réponse, jamais un mot de passe.
- Pour dépanner : lever le blocage, ou remettre un mot de passe TEMPORAIRE (mécanisme existant, `temporary_password.py`) : généré par le serveur,
  affiché une seule fois à l'administrateur pour transmission hors application, valable 7 jours, remplacé obligatoirement à la première connexion,
  jamais journalisé. Le titulaire est prévenu par e-mail et chaque action laisse un événement d'audit (acteur : l'administrateur ; compte : `resource_id`).
- Les comptes d'équipe (staff, superadministrateur) et les comptes désactivés ou supprimés sont exclus.
"""
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event
from .admin_views import IsSuperuserOnly, RECOVERY_HELP_MARK
from .models import AccountContext, AccountProfile, ContactMessage
from .temporary_password import issue_temporary_password

PROTECTED = "Les comptes de l’équipe sont protégés : ils ne se récupèrent pas par cette voie."


def account_summary(user) -> dict:
    """Ce que l'équipe peut voir d'un compte pour l'aider. Aucun secret, aucune donnée de santé."""
    profile = AccountProfile.objects.filter(user=user).first()
    now = timezone.now()
    locked_until = profile.recovery_locked_until if profile and profile.recovery_locked_until and profile.recovery_locked_until > now else None
    return {
        "id": user.pk,
        "name": f"{user.first_name} {user.last_name}".strip(),
        "email": user.email,
        "joined_at": user.date_joined.isoformat(),
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "roles": list(AccountContext.objects.filter(user=user).order_by("role").values_list("role", flat=True)),
        "has_recovery_question": bool(profile and profile.recovery_question and profile.recovery_answer_hash),
        # La question seule (déjà montrée à quiconque la demande au formulaire de récupération) : un point de vérification, pas un secret.
        "recovery_question": profile.recovery_question if profile and profile.recovery_answer_hash else "",
        "failures": profile.recovery_failures if profile else 0,
        "locked_until": locked_until.isoformat() if locked_until else None,
        "temporary_password_pending": bool(profile and profile.must_change_password),
        "temporary_password_expires_at": profile.temporary_password_expires_at.isoformat() if profile and profile.must_change_password and profile.temporary_password_expires_at else None,
        "protected": bool(user.is_staff or user.is_superuser),
        "active": bool(user.is_active),
    }


def _helpable_account(user_id):
    return get_object_or_404(get_user_model().objects.exclude(email=""), pk=user_id)


def _refuse(user):
    if user.is_staff or user.is_superuser:
        return Response({"success": False, "message": PROTECTED}, status=403)
    if not user.is_active:
        return Response({"success": False, "message": "Ce compte est désactivé : il n’y a rien à récupérer."}, status=409)
    return None


class AdminRecoveryAccountView(APIView):
    """GET ?email=… : retrouve le compte de la personne qui demande de l'aide (adresse exacte, une seule correspondance)."""
    permission_classes = [IsSuperuserOnly]

    def get(self, request):
        email = str(request.query_params.get("email", "")).strip()
        if "@" not in email:
            return Response({"success": False, "message": "Saisissez l’adresse e-mail complète du compte."}, status=400)
        matches = list(get_user_model().objects.filter(email__iexact=email)[:2])
        if not matches:
            return Response({"success": False, "message": "Aucun compte ne correspond à cette adresse."}, status=404)
        if len(matches) > 1:
            return Response({"success": False, "message": "Plusieurs comptes portent cette adresse : traitez-les un par un depuis la base."}, status=409)
        return Response({"success": True, "data": account_summary(matches[0])})


class AdminRecoveryUnlockView(APIView):
    """POST : remet à zéro les échecs et lève le blocage de la récupération (la personne peut retenter sa réponse)."""
    permission_classes = [IsSuperuserOnly]

    @transaction.atomic
    def post(self, request, user_id):
        user = _helpable_account(user_id)
        refusal = _refuse(user)
        if refusal:
            return refusal
        profile, _ = AccountProfile.objects.select_for_update().get_or_create(user=user)
        profile.recovery_failures = 0
        profile.recovery_locked_until = None
        profile.save(update_fields=["recovery_failures", "recovery_locked_until", "updated_at"])
        record_event(event_type="account.recovery_unlocked_by_admin", actor=request.user, actor_role="admin", metadata={"action": "unlocked", "resource_id": str(user.pk)})
        return Response({"success": True, "data": account_summary(user)})


class AdminRecoveryTemporaryPasswordView(APIView):
    """POST : remet un mot de passe temporaire, une fois l'identité vérifiée par l'administrateur (case à cocher obligatoire).

    Corps : `identity_checked: true` ; `help_request_id` (facultatif) clôt la demande « Écrire à l'équipe » correspondante."""
    permission_classes = [IsSuperuserOnly]

    @transaction.atomic
    def post(self, request, user_id):
        if request.data.get("identity_checked") is not True:
            return Response({"success": False, "message": "Confirmez que vous avez vérifié l’identité de la personne avant de remettre un mot de passe."}, status=400)
        user = _helpable_account(user_id)
        refusal = _refuse(user)
        if refusal:
            return refusal
        password, expires_at = issue_temporary_password(user)
        # Le mot de passe est remplacé : les échecs de la réponse secrète ne doivent pas bloquer la suite.
        AccountProfile.objects.filter(user=user).update(recovery_failures=0, recovery_locked_until=None)
        record_event(event_type="account.temporary_password_issued_by_admin", actor=request.user, actor_role="admin", metadata={"action": "temporary_password_issued", "resource_id": str(user.pk)})
        help_request_id = request.data.get("help_request_id")
        if help_request_id:
            ContactMessage.objects.filter(pk=help_request_id, message__startswith=RECOVERY_HELP_MARK).update(status="resolved", updated_at=timezone.now())
        _notify_owner(user)
        return Response({"success": True, "data": {"temporary_password": password, "expires_at": expires_at.isoformat(), "account": account_summary(user)}})


def _notify_owner(user) -> None:
    """Le titulaire est prévenu (sans mot de passe) : s'il n'a rien demandé, il le sait. Au mieux : un échec d'envoi ne défait rien."""
    try:
        send_mail(
            "Mon E‑Carnet : l’équipe a remis un mot de passe temporaire sur votre compte",
            "Bonjour,\n\nSuite à votre demande d’aide, l’équipe Mon E‑Carnet vient de remplacer le mot de passe de votre compte par un mot de passe "
            "temporaire, qui vous est transmis par un autre canal (appel ou message). Vous devrez le changer dès votre prochaine connexion.\n"
            "Si vous n’avez fait aucune demande, écrivez-nous sans attendre depuis la page de contact du site : nous sécuriserons votre compte.\n\n"
            "Par sécurité, vos autres appareils ont été déconnectés.\n",
            None,
            [user.email],
            fail_silently=True,
        )
    except Exception:  # noqa: BLE001 — l'alerte est un plus, jamais une raison de refuser l'aide
        pass

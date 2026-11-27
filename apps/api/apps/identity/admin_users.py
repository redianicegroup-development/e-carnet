"""Console → Utilisateurs : liste, recherche, filtres, fiche, désactivation/réactivation, fermeture des sessions, journal des connexions.

L'équipe y voit des IDENTITÉS DE COMPTE (nom, e-mail, rôle, structure, état) et jamais de contenu médical. Les comptes de l'équipe sont protégés :
on ne les désactive pas depuis la console, et personne ne peut agir sur son propre compte.
"""
from datetime import timedelta

from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event
from apps.establishments.models import EstablishmentAdministrator, EstablishmentMembership

from .account_state import staff_deactivate, staff_reactivate, user_state
from .admin_platform import ACTIVE_WINDOW_DAYS, real_users
from .admin_views import IsSuperuserOnly
from .models import LoginEvent
from .session_control import end_all_sessions

DEFAULT_LIMIT = 30
MAX_LIMIT = 60
LOGIN_EVENTS_LIMIT = 100
ROLES = ("patient", "professional", "establishment", "laboratory", "staff")
STATUSES = ("active", "inactive", "disabled")
ROLE_LABELS = {"patient": "Patient", "professional": "Professionnel", "establishment": "Administrateur d’établissement", "laboratory": "Laboratoire", "staff": "Équipe Mon E‑Carnet"}


def _clamp(value, default, low, high):
    try:
        return max(low, min(high, int(value)))
    except (TypeError, ValueError):
        return default


def _admin_exists(is_laboratory):
    return Exists(EstablishmentAdministrator.objects.filter(user=OuterRef("pk"), status="active", establishment__is_laboratory=is_laboratory))


def _full_name(user):
    return " ".join(part for part in (user.first_name, user.last_name) if part).strip()


def _roles_for(users):
    """Rôles, structures et professions de la page affichée : quelques requêtes groupées, pas une par compte."""
    ids = [user.pk for user in users]
    from apps.patients.models import PatientProfile
    from apps.professionals.models import ProfessionalProfile

    patients = set(PatientProfile.objects.filter(user_id__in=ids).values_list("user_id", flat=True))
    professionals = {row.user_id: row for row in ProfessionalProfile.objects.filter(user_id__in=ids)}
    memberships = {}
    for membership in EstablishmentMembership.objects.filter(professional__user_id__in=ids, status="active").select_related("establishment", "professional"):
        memberships.setdefault(membership.professional.user_id, []).append(membership.establishment.name)
    admins = {}
    for admin in EstablishmentAdministrator.objects.filter(user_id__in=ids, status="active").select_related("establishment"):
        admins.setdefault(admin.user_id, []).append(admin)

    result = {}
    for user in users:
        roles = []
        if user.is_superuser or user.is_staff:
            roles.append({"code": "staff", "label": ROLE_LABELS["staff"], "detail": ""})
        if user.pk in patients:
            roles.append({"code": "patient", "label": ROLE_LABELS["patient"], "detail": ""})
        profile = professionals.get(user.pk)
        if profile and profile.professional_title != "Compte anonymisé":
            detail = " · ".join(part for part in (profile.specialty, ", ".join(memberships.get(user.pk, []))) if part)
            roles.append({"code": "professional", "label": ROLE_LABELS["professional"], "detail": detail})
        for admin in admins.get(user.pk, []):
            code = "laboratory" if admin.establishment.is_laboratory else "establishment"
            roles.append({"code": code, "label": ROLE_LABELS[code], "detail": admin.establishment.name})
        result[user.pk] = roles
    return result


def user_payload(user, roles, now):
    profile = getattr(user, "account_profile", None)
    return {
        "id": user.pk,
        "name": _full_name(user) or "Sans nom",
        "first_name": user.first_name,
        "email": user.email,
        "photo": profile.avatar_url if profile and profile.avatar_url else "",
        "roles": roles,
        "state": user_state(user, now),
        "date_joined": user.date_joined.isoformat(),
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "protected": bool(user.is_staff or user.is_superuser),
    }


class AdminUsersView(APIView):
    permission_classes = [IsSuperuserOnly]

    def get(self, request):
        now = timezone.now()
        window = now - timedelta(days=ACTIVE_WINDOW_DAYS)
        users = real_users()
        base_counts = {
            "total": users.count(),
            "active": users.filter(is_active=True, last_login__gte=window).count(),
            "inactive": users.filter(is_active=True).exclude(last_login__gte=window).count(),
            "disabled": users.filter(is_active=False).count(),
        }

        query = (request.query_params.get("q") or "").strip()[:80]
        role = request.query_params.get("role") or ""
        status_filter = request.query_params.get("status") or ""
        if query:
            users = users.filter(Q(email__icontains=query) | Q(first_name__icontains=query) | Q(last_name__icontains=query))
        if role in ROLES:
            if role == "patient":
                users = users.filter(patient_profile__isnull=False)
            elif role == "professional":
                users = users.filter(professional_profile__isnull=False)
            elif role == "establishment":
                users = users.filter(_admin_exists(False))
            elif role == "laboratory":
                users = users.filter(_admin_exists(True))
            else:
                users = users.filter(Q(is_staff=True) | Q(is_superuser=True))
        if status_filter in STATUSES:
            if status_filter == "active":
                users = users.filter(is_active=True, last_login__gte=window)
            elif status_filter == "inactive":
                users = users.filter(is_active=True).exclude(last_login__gte=window)
            else:
                users = users.filter(is_active=False)

        limit = _clamp(request.query_params.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT)
        offset = _clamp(request.query_params.get("offset"), 0, 0, 1_000_000)
        total = users.count()
        page = list(users.select_related("account_profile").order_by("-date_joined", "-pk")[offset:offset + limit])
        roles = _roles_for(page)
        return Response({"success": True, "data": {
            "summary": {**base_counts, "window_days": ACTIVE_WINDOW_DAYS},
            "total": total, "offset": offset, "limit": limit, "has_more": offset + len(page) < total,
            "items": [user_payload(user, roles[user.pk], now) for user in page],
        }})


class _ManagedUserMixin:
    """Garde-fous communs : compte réel, pas soi-même, pas un compte de l'équipe."""

    @staticmethod
    def locked_user(request, user_id):
        user = get_object_or_404(real_users().select_for_update(), pk=user_id)
        if user.pk == request.user.pk:
            return None, Response({"success": False, "message": "Vous ne pouvez pas agir sur votre propre compte depuis la console."}, status=409)
        if user.is_staff or user.is_superuser:
            return None, Response({"success": False, "message": "Les comptes de l’équipe sont protégés : ils ne se gèrent pas depuis cette liste."}, status=403)
        return user, None


class AdminUserStatusView(_ManagedUserMixin, APIView):
    """Désactive (et ferme toutes les sessions) ou réactive un compte. Chaque changement est inscrit au journal d'audit."""
    permission_classes = [IsSuperuserOnly]

    @transaction.atomic
    def post(self, request, user_id):
        user, refusal = self.locked_user(request, user_id)
        if refusal:
            return refusal
        action = request.data.get("action")
        now = timezone.now()
        if action == "deactivate":
            staff_deactivate(user, now)
            end_all_sessions(user)
        elif action == "reactivate":
            staff_reactivate(user, now)
        else:
            return Response({"success": False, "message": "Action inconnue."}, status=400)
        record_event(event_type=f"admin.account.{action}d", actor=request.user, actor_role="ecarnet_staff", metadata={"action": action})
        user.refresh_from_db()
        return Response({"success": True, "data": user_payload(user, _roles_for([user])[user.pk], now)})


class AdminUserSessionsView(_ManagedUserMixin, APIView):
    """« Réinitialiser les accès » : ferme toutes les sessions du compte. La personne se reconnecte avec son mot de passe."""
    permission_classes = [IsSuperuserOnly]

    @transaction.atomic
    def post(self, request, user_id):
        user, refusal = self.locked_user(request, user_id)
        if refusal:
            return refusal
        closed = end_all_sessions(user)
        record_event(event_type="admin.account.sessions_revoked", actor=request.user, actor_role="ecarnet_staff", metadata={"action": "revoke_sessions"})
        return Response({"success": True, "data": {"closed": closed}})


class AdminLoginEventsView(APIView):
    """Journal des connexions : 100 derniers événements, filtrables par résultat. Sans IP ni appareil."""
    permission_classes = [IsSuperuserOnly]

    def get(self, request):
        now = timezone.now()
        outcome = request.query_params.get("outcome") or ""
        events = LoginEvent.objects.select_related("user")
        day = events.filter(created_at__gte=now - timedelta(hours=24))
        summary = {key: day.filter(outcome=key).count() for key in ("success", "failure", "blocked")}
        if outcome in {"success", "failure", "blocked"}:
            events = events.filter(outcome=outcome)
        items = []
        for event in events[:LOGIN_EVENTS_LIMIT]:
            user = event.user
            items.append({
                "id": str(event.id), "outcome": event.outcome, "method": event.method, "created_at": event.created_at.isoformat(),
                "user": {"id": user.pk, "name": _full_name(user) or "Sans nom", "email": user.email} if user and user.email else None,
            })
        return Response({"success": True, "data": {"summary_24h": summary, "items": items}})

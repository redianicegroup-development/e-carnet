"""Console → Accueil : indicateurs de la plateforme (utilisateurs, abonnements, revenus, alertes, activité récente).

Aucune donnée de santé ici : seulement des comptages, des montants d'abonnement et le TYPE des derniers événements d'audit (jamais leur contenu).
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditEvent
from apps.billing.models import Invoice, Payment, Subscription
from apps.establishments.models import Establishment, EstablishmentAdministrator
from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile

from .admin_views import IsSuperuserOnly
from .models import LoginEvent, SiteFeedback

ACTIVE_WINDOW_DAYS = 30
CHART_DAYS = 30
FAILED_LOGIN_ALERT_THRESHOLD = 10
RECENT_ACTIVITY_LIMIT = 10


def real_users():
    """Comptes réels : on écarte les ancres anonymes laissées par une suppression de compte."""
    return get_user_model().objects.exclude(username__startswith="deleted-")


def _daily(queryset, field, days, now):
    start = (now - timedelta(days=days - 1)).date()
    rows = {row["day"]: row["n"] for row in queryset.filter(**{f"{field}__date__gte": start}).annotate(day=TruncDate(field)).values("day").annotate(n=Count("id"))}
    return [{"date": (start + timedelta(days=offset)).isoformat(), "count": rows.get(start + timedelta(days=offset), 0)} for offset in range(days)]


def build_overview(now=None):
    now = now or timezone.now()
    users = real_users()
    window = now - timedelta(days=ACTIVE_WINDOW_DAYS)
    members = users.filter(is_staff=False, is_superuser=False)

    total = users.count()
    disabled = users.filter(is_active=False).count()
    active = users.filter(is_active=True, last_login__gte=window).count()
    inactive = users.filter(is_active=True).exclude(last_login__gte=window).count()

    care_sites = Establishment.objects.filter(is_laboratory=False)
    labs = Establishment.objects.filter(is_laboratory=True)
    overdue = Invoice.objects.filter(status="overdue")
    confirmed = Payment.objects.filter(status="confirmed")
    revenue = confirmed.aggregate(total=Sum("amount_fcfa"))["total"] or 0
    revenue_30d = confirmed.filter(confirmed_at__gte=window).aggregate(total=Sum("amount_fcfa"))["total"] or 0
    failed_24h = LoginEvent.objects.filter(outcome="failure", created_at__gte=now - timedelta(hours=24)).count()
    suspended_sites = care_sites.filter(status="suspended").count()
    overdue_count = overdue.count()
    new_feedback = SiteFeedback.objects.filter(status="new").count()

    alerts = []
    if overdue_count:
        alerts.append({"id": "overdue", "level": "warning", "title": f"{overdue_count} facture(s) en retard", "detail": "Des établissements n’ont pas payé à l’échéance.", "tab": "billing"})
    if suspended_sites:
        alerts.append({"id": "suspended", "level": "warning", "title": f"{suspended_sites} établissement(s) suspendu(s)", "detail": "Leur espace professionnel est fermé.", "tab": "establishments"})
    if failed_24h >= FAILED_LOGIN_ALERT_THRESHOLD:
        alerts.append({"id": "failed-logins", "level": "critical", "title": f"{failed_24h} échecs de connexion en 24 h", "detail": "Plus que d’habitude : consultez le journal des connexions.", "tab": "users"})
    if new_feedback:
        alerts.append({"id": "feedback", "level": "info", "title": f"{new_feedback} retour(s) à lire", "detail": "Des visiteurs ont écrit à l’équipe.", "tab": "feedback"})
    if disabled:
        alerts.append({"id": "disabled", "level": "info", "title": f"{disabled} compte(s) fermé(s)", "detail": "Suspendus par leur titulaire ou désactivés par l’équipe.", "tab": "users"})

    recent = [
        {"event_type": item.event_type, "actor_role": item.actor_role, "created_at": item.created_at.isoformat()}
        for item in AuditEvent.objects.order_by("-created_at")[:RECENT_ACTIVITY_LIMIT]
    ]

    return {
        "generated_at": now.isoformat(),
        "users": {
            "total": total, "active_30d": active, "inactive": inactive, "disabled": disabled,
            "new_7d": users.filter(date_joined__gte=now - timedelta(days=7)).count(),
            "patients": PatientProfile.objects.filter(user__in=members).count(),
            "professionals": ProfessionalProfile.objects.filter(user__in=members).count(),
            "establishment_admins": EstablishmentAdministrator.objects.filter(user__in=members, status="active", establishment__is_laboratory=False).values("user").distinct().count(),
            "laboratory_admins": EstablishmentAdministrator.objects.filter(user__in=members, status="active", establishment__is_laboratory=True).values("user").distinct().count(),
            "staff": users.filter(is_superuser=True).count() + users.filter(is_staff=True, is_superuser=False).count(),
        },
        "establishments": {
            "total": care_sites.count(), "active": care_sites.filter(status="active").count(), "suspended": suspended_sites, "laboratories": labs.count(),
        },
        "billing": {
            "subscriptions_active": Subscription.objects.filter(status="active").count(),
            "overdue_invoices": overdue_count,
            "transactions_total": confirmed.count(),
            "transactions_30d": confirmed.filter(confirmed_at__gte=window).count(),
            "revenue_total_fcfa": revenue,
            "revenue_30d_fcfa": revenue_30d,
        },
        "alerts": alerts,
        "recent_activity": recent,
        "registrations_daily": _daily(users, "date_joined", CHART_DAYS, now),
        "logins_daily": _daily(LoginEvent.objects.filter(outcome="success"), "created_at", CHART_DAYS, now),
        "failed_logins_24h": failed_24h,
    }


class AdminPlatformOverviewView(APIView):
    permission_classes = [IsSuperuserOnly]

    def get(self, request):
        return Response({"success": True, "data": build_overview()})

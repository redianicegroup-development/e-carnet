from datetime import datetime, time, timedelta
import os
import time as monotonic_time

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.db.models import Avg, Count, Sum
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditEvent
from .models import (
    AccountProfile,
    AnonymousVisitor,
    ContactMessage,
    ProductExperienceSurveyResponse,
    ProductSurveyResponse,
    SiteFeedback,
    VisitorDiscoverySurveyResponse,
)


class IsSuperuserOnly(BasePermission):
    message = "Accès réservé aux administrateurs autorisés."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class IsOperationsAdmin(IsSuperuserOnly):
    """Superadmin autorisé par e-mail pour la surveillance technique.

    Fermé par défaut : si ECARNET_OPERATIONS_ADMIN_EMAILS est vide, personne n'y accède,
    sauf en développement local (DEBUG) où les superadmins de test restent acceptés.
    En staging/production, la liste est donc obligatoire.
    """

    message = "Accès réservé aux e-mails d’exploitation configurés."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        allowed = getattr(settings, "ECARNET_OPERATIONS_ADMIN_EMAILS", ())
        if not allowed:
            return bool(settings.DEBUG)
        return request.user.email.strip().lower() in allowed


class AdminDashboardView(APIView):
    permission_classes = [IsSuperuserOnly]

    def get(self, request):
        now = timezone.now()
        day_ago = now - timedelta(hours=24)
        queryset = AnonymousVisitor.objects.all()
        visitors = list(queryset.order_by("-last_seen").values(
            "visitor_id", "first_seen", "last_seen", "page_view_count", "auth_page_view_count",
            "login_success_count", "login_failure_count", "registration_count", "oauth_success_count",
            "oauth_link_count", "last_page_category", "last_auth_event", "last_auth_event_at",
            "click_count", "last_click_category", "last_click_page_category", "last_click_at",
            "public_page_view_count", "visitor_survey_prompted_at", "visitor_survey_completed_at",
            "first_product_action_at", "product_survey_prompted_at", "product_survey_completed_at",
        )[:200])
        for visitor in visitors:
            visitor["visitor_id"] = str(visitor["visitor_id"])
            for field in ("first_seen", "last_seen", "last_auth_event_at", "last_click_at", "visitor_survey_prompted_at", "visitor_survey_completed_at", "first_product_action_at", "product_survey_prompted_at", "product_survey_completed_at"):
                visitor[field] = visitor[field].isoformat() if visitor[field] else None
        totals = queryset.aggregate(
            page_views=Sum("page_view_count"), clicks=Sum("click_count"),
            login_successes=Sum("login_success_count"), registrations=Sum("registration_count"),
            oauth_successes=Sum("oauth_success_count"), login_failures=Sum("login_failure_count"),
        )
        feedback_items = list(SiteFeedback.objects.order_by("-submitted_at").values(
            "id", "category", "message", "page_category", "status", "submitted_at", "updated_at",
        )[:200])
        for item in feedback_items:
            item["id"] = str(item["id"])
            item["submitted_at"] = item["submitted_at"].isoformat()
            item["updated_at"] = item["updated_at"].isoformat()

        visitor_survey_queryset = VisitorDiscoverySurveyResponse.objects.all()
        visitor_survey_prompted = queryset.filter(visitor_survey_prompted_at__isnull=False).count()
        visitor_survey_responses = list(visitor_survey_queryset.order_by("-submitted_at").values(
            "id", "persona", "found_what", "barriers", "missing", "submitted_at",
        )[:200])
        for item in visitor_survey_responses:
            item["id"] = str(item["id"])
            item["submitted_at"] = item["submitted_at"].isoformat()

        product_survey_queryset = ProductExperienceSurveyResponse.objects.all()
        product_survey_aggregate = product_survey_queryset.aggregate(average=Avg("ease_rating"), count=Count("id"))
        product_survey_total = product_survey_aggregate["count"]
        product_survey_prompted = queryset.filter(product_survey_prompted_at__isnull=False).count()
        product_survey_distribution = {str(star): product_survey_queryset.filter(ease_rating=star).count() for star in range(1, 6)}
        product_survey_responses = list(product_survey_queryset.order_by("-submitted_at").values(
            "id", "ease_rating", "appreciated", "pain_points", "improvement_suggestion", "submitted_at",
        )[:200])
        for item in product_survey_responses:
            item["id"] = str(item["id"])
            item["rating"] = item["ease_rating"]
            item["submitted_at"] = item["submitted_at"].isoformat()

        # Preserve and label responses from the previous survey version instead of mixing them in new metrics.
        legacy_survey_responses = list(ProductSurveyResponse.objects.order_by("-submitted_at").values(
            "id", "rating", "appreciated", "pain_points", "improvement_suggestion", "submitted_at",
        )[:200])
        for item in legacy_survey_responses:
            item["id"] = str(item["id"])
            item["submitted_at"] = item["submitted_at"].isoformat()
        product_survey_average = round(float(product_survey_aggregate["average"]), 1) if product_survey_aggregate["average"] is not None else None

        # Les compteurs de vues/clics sont cumulatifs et ne conservent pas d’événements bruts.
        # Les courbes ci-dessous ne tracent donc que les événements réellement horodatés.
        today = timezone.localdate(now)
        first_day = today - timedelta(days=29)
        first_moment = timezone.make_aware(datetime.combine(first_day, time.min), timezone.get_current_timezone())
        visitor_by_day = {
            row["day"]: row["total"]
            for row in queryset.filter(first_seen__gte=first_moment)
            .annotate(day=TruncDate("first_seen"))
            .values("day").annotate(total=Count("visitor_id"))
        }
        feedback_by_day = {
            row["day"]: row["total"]
            for row in SiteFeedback.objects.filter(submitted_at__gte=first_moment)
            .annotate(day=TruncDate("submitted_at"))
            .values("day").annotate(total=Count("id"))
        }
        visitor_survey_by_day = {
            row["day"]: row
            for row in visitor_survey_queryset.filter(submitted_at__gte=first_moment)
            .annotate(day=TruncDate("submitted_at"))
            .values("day").annotate(total=Count("id"))
        }
        product_survey_by_day = {
            row["day"]: row
            for row in product_survey_queryset.filter(submitted_at__gte=first_moment)
            .annotate(day=TruncDate("submitted_at"))
            .values("day").annotate(total=Count("id"), average=Avg("ease_rating"))
        }
        daily_activity = []
        for offset in range(30):
            day = first_day + timedelta(days=offset)
            visitor_survey_day = visitor_survey_by_day.get(day)
            product_survey_day = product_survey_by_day.get(day)
            daily_activity.append({
                "date": day.isoformat(),
                "new_visitors": visitor_by_day.get(day, 0),
                "feedback_submissions": feedback_by_day.get(day, 0),
                "visitor_survey_responses": visitor_survey_day["total"] if visitor_survey_day else 0,
                "product_survey_responses": product_survey_day["total"] if product_survey_day else 0,
                "survey_responses": product_survey_day["total"] if product_survey_day else 0,
                "average_rating": round(float(product_survey_day["average"]), 1) if product_survey_day and product_survey_day["average"] is not None else None,
            })

        data = {
            "generated_at": now.isoformat(),
            "visitors_total": queryset.count(),
            "visitors_active_24h": queryset.filter(last_seen__gte=day_ago).count(),
            "page_views_total": totals["page_views"] or 0,
            "clicks_total": totals["clicks"] or 0,
            "auth_successes_total": (totals["login_successes"] or 0) + (totals["registrations"] or 0) + (totals["oauth_successes"] or 0),
            "login_failures_total": totals["login_failures"] or 0,
            "feedback_total": SiteFeedback.objects.count(),
            "feedback_new_total": SiteFeedback.objects.filter(status="new").count(),
            "visitor_survey_prompted_total": visitor_survey_prompted,
            "visitor_survey_responses_total": visitor_survey_queryset.count(),
            "visitor_survey_completion_rate": round(visitor_survey_queryset.count() * 100 / visitor_survey_prompted, 1) if visitor_survey_prompted else 0,
            "visitor_survey_responses": visitor_survey_responses,
            "product_survey_prompted_total": product_survey_prompted,
            "product_survey_responses_total": product_survey_total,
            "product_survey_completion_rate": round(product_survey_total * 100 / product_survey_prompted, 1) if product_survey_prompted else 0,
            "product_survey_average_rating": product_survey_average,
            "product_survey_distribution": product_survey_distribution,
            "product_survey_responses": product_survey_responses,
            "legacy_survey_responses_total": ProductSurveyResponse.objects.count(),
            "legacy_survey_responses": legacy_survey_responses,
            "survey_prompted_total": product_survey_prompted,
            "survey_responses_total": product_survey_total,
            "survey_completion_rate": round(product_survey_total * 100 / product_survey_prompted, 1) if product_survey_prompted else 0,
            "survey_average_rating": product_survey_average,
            "survey_distribution": product_survey_distribution,
            "survey_responses": product_survey_responses,
            "daily_activity": daily_activity,
            "visitors": visitors,
            "feedback": feedback_items,
        }
        return Response({"success": True, "data": data})


class AdminFeedbackStatusView(APIView):
    permission_classes = [IsSuperuserOnly]

    def patch(self, request, feedback_id):
        new_status = request.data.get("status")
        if not isinstance(new_status, str) or new_status not in {"new", "in_progress", "resolved"}:
            return Response({"success": False, "message": "Statut de feedback invalide."}, status=400)
        feedback = get_object_or_404(SiteFeedback, pk=feedback_id)
        feedback.status = new_status
        feedback.save(update_fields=("status", "updated_at"))
        return Response({"success": True, "data": {"id": str(feedback.id), "status": feedback.status}})


RECOVERY_EVENT_LABELS = {
    "account.recovery_answer_failed": "Réponse secrète incorrecte",
    "account.recovery_attempt_blocked": "Tentative pendant un blocage",
    "account.recovery_locked": "Récupération bloquée (trop d’échecs)",
    "account.recovery_answer_verified": "Réponse secrète acceptée",
    "account.password_reset_by_recovery": "Mot de passe réinitialisé",
    "account.recovery_method_configured": "Question secrète enregistrée",
}
RECOVERY_HELP_MARK = "[Récupération de compte]"


class AdminRecoveryView(APIView):
    """Récupérations de compte vues par l'équipe : ce qui s'est passé, quels comptes sont bloqués, qui a demandé de l'aide.

    Jamais la réponse secrète ni le mot de passe (ils ne sont d'ailleurs conservés nulle part en clair). Réservé aux superadministrateurs."""
    permission_classes = [IsSuperuserOnly]

    def get(self, request):
        now = timezone.now()
        day_ago = now - timedelta(hours=24)
        events_queryset = AuditEvent.objects.filter(event_type__in=RECOVERY_EVENT_LABELS)
        recent = events_queryset.filter(created_at__gte=day_ago)

        def count(event_type):
            return recent.filter(event_type=event_type).count()

        events = [{
            "id": str(event.id),
            "event_type": event.event_type,
            "label": RECOVERY_EVENT_LABELS[event.event_type],
            "email": event.actor.email if event.actor else "",
            "name": f"{event.actor.first_name} {event.actor.last_name}".strip() if event.actor else "",
            "failures": event.metadata.get("extension_count"),
            "created_at": event.created_at.isoformat(),
        } for event in events_queryset.select_related("actor").order_by("-created_at")[:200]]
        locked = [{
            "email": profile.user.email,
            "name": f"{profile.user.first_name} {profile.user.last_name}".strip(),
            "failures": profile.recovery_failures,
            "locked_until": profile.recovery_locked_until.isoformat(),
        } for profile in AccountProfile.objects.filter(recovery_locked_until__gt=now).select_related("user").order_by("-recovery_locked_until")[:100]]
        help_requests = [{
            "id": str(item.id),
            "name": f"{item.first_name} {item.last_name}".strip(),
            "contact_kind": item.contact_kind,
            "contact_value": item.contact_value,
            "message": item.message[len(RECOVERY_HELP_MARK):].strip() if item.message.startswith(RECOVERY_HELP_MARK) else item.message,
            "status": item.status,
            "submitted_at": item.submitted_at.isoformat(),
        } for item in ContactMessage.objects.filter(message__startswith=RECOVERY_HELP_MARK).order_by("-submitted_at")[:100]]
        return Response({"success": True, "data": {
            "generated_at": now.isoformat(),
            "summary": {
                "failed_24h": count("account.recovery_answer_failed"),
                "blocked_24h": count("account.recovery_attempt_blocked"),
                "locked_now": len(locked),
                "verified_24h": count("account.recovery_answer_verified"),
                "resets_24h": count("account.password_reset_by_recovery"),
                "help_open": ContactMessage.objects.filter(message__startswith=RECOVERY_HELP_MARK).exclude(status="resolved").count(),
            },
            "events": events,
            "locked_accounts": locked,
            "help_requests": help_requests,
        }})


class AdminContactMessageStatusView(APIView):
    permission_classes = [IsSuperuserOnly]

    def patch(self, request, message_id):
        new_status = request.data.get("status")
        if not isinstance(new_status, str) or new_status not in {"new", "in_progress", "resolved"}:
            return Response({"success": False, "message": "Statut invalide."}, status=400)
        message = get_object_or_404(ContactMessage, pk=message_id)
        message.status = new_status
        message.save(update_fields=("status", "updated_at"))
        return Response({"success": True, "data": {"id": str(message.id), "status": message.status}})

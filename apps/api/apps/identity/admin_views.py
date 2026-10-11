from datetime import timedelta

from django.db.models import Avg, Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AnonymousVisitor, ProductSurveyResponse, SiteFeedback


class IsSuperuserOnly(BasePermission):
    message = "Accès réservé aux administrateurs autorisés."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


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
            "public_page_view_count", "survey_prompted_at", "survey_completed_at",
        )[:200])
        for visitor in visitors:
            visitor["visitor_id"] = str(visitor["visitor_id"])
            for field in ("first_seen", "last_seen", "last_auth_event_at", "last_click_at", "survey_prompted_at", "survey_completed_at"):
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

        survey_queryset = ProductSurveyResponse.objects.all()
        survey_aggregate = survey_queryset.aggregate(average=Avg("rating"), count=Count("id"))
        survey_total = survey_aggregate["count"]
        survey_prompted_total = queryset.filter(survey_prompted_at__isnull=False).count()
        survey_distribution = {str(star): survey_queryset.filter(rating=star).count() for star in range(1, 6)}
        survey_responses = list(survey_queryset.order_by("-submitted_at").values(
            "id", "rating", "appreciated", "pain_points", "improvement_suggestion", "submitted_at",
        )[:200])
        for item in survey_responses:
            item["id"] = str(item["id"])
            item["submitted_at"] = item["submitted_at"].isoformat()
        survey_average = round(float(survey_aggregate["average"]), 1) if survey_aggregate["average"] is not None else None

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
            "survey_prompted_total": survey_prompted_total,
            "survey_responses_total": survey_total,
            "survey_completion_rate": round(survey_total * 100 / survey_prompted_total, 1) if survey_prompted_total else 0,
            "survey_average_rating": survey_average,
            "survey_distribution": survey_distribution,
            "visitors": visitors,
            "feedback": feedback_items,
            "survey_responses": survey_responses,
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

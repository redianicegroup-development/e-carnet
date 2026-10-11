from datetime import timedelta

from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AnonymousVisitor, SiteFeedback


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
        )[:200])
        for visitor in visitors:
            visitor["visitor_id"] = str(visitor["visitor_id"])
            for field in ("first_seen", "last_seen", "last_auth_event_at", "last_click_at"):
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

from datetime import timedelta

from django.utils import timezone
from django.db.models import Sum
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AnonymousVisitor


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
        )[:100])
        for visitor in visitors:
            visitor["visitor_id"] = str(visitor["visitor_id"])
            visitor["first_seen"] = visitor["first_seen"].isoformat()
            visitor["last_seen"] = visitor["last_seen"].isoformat()
            visitor["last_auth_event_at"] = visitor["last_auth_event_at"].isoformat() if visitor["last_auth_event_at"] else None
        totals = queryset.aggregate(
            page_views=Sum("page_view_count"), login_successes=Sum("login_success_count"),
            registrations=Sum("registration_count"), oauth_successes=Sum("oauth_success_count"),
            login_failures=Sum("login_failure_count"),
        )
        data = {
            "generated_at": now.isoformat(),
            "visitors_total": queryset.count(),
            "visitors_active_24h": queryset.filter(last_seen__gte=day_ago).count(),
            "page_views_total": totals["page_views"] or 0,
            "auth_successes_total": (totals["login_successes"] or 0) + (totals["registrations"] or 0) + (totals["oauth_successes"] or 0),
            "login_failures_total": totals["login_failures"] or 0,
            "visitors": visitors,
        }
        return Response({"success": True, "data": data})

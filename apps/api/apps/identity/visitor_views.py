import uuid

from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from .models import SiteFeedback
from .visitor_tracking import (
    VISITOR_COOKIE,
    _visitor_identity,
    attach_visitor_cookie,
    normalize_page_category,
    record_click,
    record_page_view,
)


class VisitorCookieThrottle(SimpleRateThrottle):
    scope = "visitor_analytics"

    def get_cache_key(self, request, view):
        raw_cookie = request.COOKIES.get(VISITOR_COOKIE, "")
        try:
            visitor_id = str(uuid.UUID(raw_cookie))
        except (ValueError, TypeError, AttributeError):
            # Let the first request through; it installs the random cookie used to limit repeats.
            return None
        return self.cache_format % {"scope": self.scope, "ident": visitor_id}


class VisitorClickThrottle(VisitorCookieThrottle):
    scope = "visitor_clicks"


class VisitorFeedbackThrottle(VisitorCookieThrottle):
    scope = "visitor_feedback"


class AnonymousVisitView(APIView):
    """Record one coarse page category for a browser without collecting direct identifiers."""
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]
    throttle_classes = [VisitorCookieThrottle]

    def post(self, request):
        raw_path = request.data.get("path", "/")
        if not isinstance(raw_path, str) or len(raw_path) > 512:
            return Response({"success": False, "message": "Chemin invalide."}, status=400)
        visitor_id, set_cookie = record_page_view(request, raw_path)
        response = Response({"success": True})
        attach_visitor_cookie(request, response, visitor_id, set_cookie)
        response["Cache-Control"] = "no-store"
        return response


class AnonymousClickView(APIView):
    """Count coarse interactions on public/auth pages only; never store labels or URLs."""
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]
    throttle_classes = [VisitorClickThrottle]

    def post(self, request):
        category = request.data.get("category", "other")
        raw_path = request.data.get("path", "/")
        if not isinstance(category, str) or len(category) > 40 or not isinstance(raw_path, str) or len(raw_path) > 512:
            return Response({"success": False, "message": "Événement invalide."}, status=400)
        visitor_id, set_cookie = record_click(request, category, raw_path)
        response = Response({"success": True})
        attach_visitor_cookie(request, response, visitor_id, set_cookie)
        response["Cache-Control"] = "no-store"
        return response


class PublicFeedbackView(APIView):
    """Accept a short anonymous product comment, without collecting contact or health data."""
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]
    throttle_classes = [VisitorFeedbackThrottle]

    def post(self, request):
        category = request.data.get("category", "")
        message = request.data.get("message", "")
        raw_path = request.data.get("path", "/")
        allowed_categories = dict(SiteFeedback.CATEGORY_CHOICES)
        if not isinstance(category, str) or category not in allowed_categories:
            return Response({"success": False, "message": "Choisissez un type de retour valide."}, status=400)
        if not isinstance(message, str):
            return Response({"success": False, "message": "Le message doit être du texte."}, status=400)
        message = message.strip()
        if len(message) < 5 or len(message) > 2000:
            return Response({"success": False, "message": "Le message doit contenir entre 5 et 2 000 caractères."}, status=400)
        if not isinstance(raw_path, str) or len(raw_path) > 512:
            return Response({"success": False, "message": "Page invalide."}, status=400)

        feedback = SiteFeedback.objects.create(
            category=category,
            message=message,
            page_category=normalize_page_category(raw_path),
        )
        visitor_id, set_cookie = _visitor_identity(request)
        response = Response({"success": True, "data": {"id": str(feedback.id)}}, status=201)
        attach_visitor_cookie(request, response, visitor_id, set_cookie)
        response["Cache-Control"] = "no-store"
        return response

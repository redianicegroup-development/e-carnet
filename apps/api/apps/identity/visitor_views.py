import uuid

from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from .visitor_tracking import VISITOR_COOKIE, attach_visitor_cookie, record_page_view


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

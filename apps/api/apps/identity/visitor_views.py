import uuid

from django.db import transaction
from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from .models import AnonymousVisitor, ProductSurveyResponse, SiteFeedback
from .visitor_tracking import (
    VISITOR_COOKIE,
    _visitor_identity,
    attach_visitor_cookie,
    normalize_page_category,
    record_click,
    record_page_view,
)

SURVEY_PUBLIC_VIEW_THRESHOLD = 5
PUBLIC_PAGE_CATEGORIES = {"landing", "public"}


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


class VisitorSurveyThrottle(VisitorCookieThrottle):
    scope = "visitor_survey"


def claim_survey_prompt(visitor_id):
    """Reserve the one-time survey invitation once the fifth public view is recorded."""
    with transaction.atomic():
        visitor = AnonymousVisitor.objects.select_for_update().filter(visitor_id=visitor_id).first()
        if not visitor or visitor.public_page_view_count < SURVEY_PUBLIC_VIEW_THRESHOLD:
            return False
        if visitor.survey_prompted_at or visitor.survey_completed_at:
            return False
        visitor.survey_prompted_at = timezone.now()
        visitor.save(update_fields=("survey_prompted_at",))
        return True


class AnonymousVisitView(APIView):
    """Record a coarse page category and raise one survey invitation after five public views."""
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]
    throttle_classes = [VisitorCookieThrottle]

    def post(self, request):
        raw_path = request.data.get("path", "/")
        if not isinstance(raw_path, str) or len(raw_path) > 512:
            return Response({"success": False, "message": "Chemin invalide."}, status=400)
        page_category = normalize_page_category(raw_path)
        visitor_id, set_cookie = record_page_view(request, raw_path)
        survey_due = page_category in PUBLIC_PAGE_CATEGORIES and claim_survey_prompt(visitor_id)
        response = Response({"success": True, "data": {"survey_due": survey_due}})
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


def _choice_list(value, choices):
    allowed = dict(choices)
    if not isinstance(value, list) or len(value) > len(allowed):
        return None
    if any(not isinstance(item, str) or item not in allowed for item in value):
        return None
    if len(set(value)) != len(value):
        return None
    return value


class ProductSurveySubmitView(APIView):
    """Store one anonymous UX survey per visitor after the server-side five-view invitation."""
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]
    throttle_classes = [VisitorSurveyThrottle]

    def post(self, request):
        try:
            visitor_id = uuid.UUID(request.COOKIES.get(VISITOR_COOKIE, ""))
        except (ValueError, TypeError, AttributeError):
            return Response({"success": False, "message": "La session visiteur est introuvable. Rechargez le site puis réessayez."}, status=403)

        rating = request.data.get("rating")
        if isinstance(rating, bool) or not isinstance(rating, int) or rating < 1 or rating > 5:
            return Response({"success": False, "message": "Choisissez une note de 1 à 5 étoiles."}, status=400)
        appreciated = _choice_list(request.data.get("appreciated", []), ProductSurveyResponse.APPRECIATED_CHOICES)
        pain_points = _choice_list(request.data.get("pain_points", []), ProductSurveyResponse.PAIN_POINT_CHOICES)
        if appreciated is None or pain_points is None or ("none" in pain_points and len(pain_points) > 1):
            return Response({"success": False, "message": "Vérifiez les réponses cochées."}, status=400)
        suggestion = request.data.get("improvement_suggestion", "")
        if not isinstance(suggestion, str):
            return Response({"success": False, "message": "La suggestion doit être du texte."}, status=400)
        suggestion = suggestion.strip()
        if len(suggestion) > 1200:
            return Response({"success": False, "message": "La suggestion est limitée à 1 200 caractères."}, status=400)

        with transaction.atomic():
            visitor = AnonymousVisitor.objects.select_for_update().filter(visitor_id=visitor_id).first()
            if not visitor or not visitor.survey_prompted_at:
                return Response({"success": False, "message": "Le questionnaire n’est pas disponible pour cette visite."}, status=403)
            if visitor.survey_completed_at or ProductSurveyResponse.objects.filter(visitor=visitor).exists():
                return Response({"success": False, "message": "Vous avez déjà répondu à ce questionnaire."}, status=409)
            ProductSurveyResponse.objects.create(
                visitor=visitor,
                rating=rating,
                appreciated=appreciated,
                pain_points=pain_points,
                improvement_suggestion=suggestion,
            )
            visitor.survey_completed_at = timezone.now()
            visitor.save(update_fields=("survey_completed_at",))

        return Response({"success": True, "message": "Merci pour votre réponse. Votre avis aide l’équipe à améliorer E‑Carnet."}, status=201)


class ProductSurveySummaryView(APIView):
    """Expose only aggregate star ratings publicly, never individual survey answers."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        queryset = ProductSurveyResponse.objects.all()
        aggregate = queryset.aggregate(average=Avg("rating"), count=Count("id"))
        average = round(float(aggregate["average"]), 1) if aggregate["average"] is not None else None
        response = Response({
            "success": True,
            "data": {"average_rating": average, "responses_total": aggregate["count"]},
        })
        response["Cache-Control"] = "no-store"
        return response

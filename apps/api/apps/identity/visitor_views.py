import uuid

from django.db import transaction
from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from .models import (
    AnonymousVisitor,
    ProductExperienceSurveyResponse,
    SiteFeedback,
    VisitorDiscoverySurveyResponse,
)
from .visitor_tracking import (
    VISITOR_COOKIE,
    _visitor_identity,
    attach_visitor_cookie,
    has_analytics_consent,
    normalize_page_category,
    record_click,
    record_page_view,
)

SURVEY_PUBLIC_VIEW_THRESHOLD = 5
PUBLIC_RATING_MINIMUM_RESPONSES = 30
PUBLIC_PAGE_CATEGORIES = {"landing", "public"}


class VisitorCookieThrottle(SimpleRateThrottle):
    scope = "visitor_analytics"

    def get_cache_key(self, request, view):
        raw_cookie = request.COOKIES.get(VISITOR_COOKIE, "")
        try:
            visitor_id = str(uuid.UUID(raw_cookie))
        except (ValueError, TypeError, AttributeError):
            # Until an opted-in cookie exists, throttle transiently by IP.
            return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}
        return self.cache_format % {"scope": self.scope, "ident": visitor_id}


class VisitorClickThrottle(VisitorCookieThrottle):
    scope = "visitor_clicks"


class VisitorFeedbackThrottle(VisitorCookieThrottle):
    scope = "visitor_feedback"


class VisitorSurveyThrottle(VisitorCookieThrottle):
    scope = "visitor_survey"


def claim_visitor_survey_prompt(visitor_id):
    """Reserve the discovery survey once the fifth public view is recorded."""
    with transaction.atomic():
        visitor = AnonymousVisitor.objects.select_for_update().filter(visitor_id=visitor_id).first()
        if not visitor or visitor.public_page_view_count < SURVEY_PUBLIC_VIEW_THRESHOLD:
            return False
        if visitor.visitor_survey_prompted_at or visitor.visitor_survey_completed_at:
            return False
        visitor.visitor_survey_prompted_at = timezone.now()
        visitor.save(update_fields=("visitor_survey_prompted_at",))
        return True


class AnonymousVisitView(APIView):
    """Record a coarse page category and raise one visitor survey after five public views."""
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]
    throttle_classes = [VisitorCookieThrottle]

    def post(self, request):
        if not has_analytics_consent(request):
            return Response({"success": True, "data": {"survey_due": False}})
        raw_path = request.data.get("path", "/")
        if not isinstance(raw_path, str) or len(raw_path) > 512:
            return Response({"success": False, "message": "Chemin invalide."}, status=400)
        page_category = normalize_page_category(raw_path)
        visitor_id, set_cookie = record_page_view(request, raw_path)
        survey_due = page_category in PUBLIC_PAGE_CATEGORIES and claim_visitor_survey_prompt(visitor_id)
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
        if not has_analytics_consent(request):
            return Response({"success": True})
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
    """Store one anonymous discovery survey per visitor after five public pages."""
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]
    throttle_classes = [VisitorSurveyThrottle]

    def post(self, request):
        if not has_analytics_consent(request):
            return Response({"success": False, "message": "La mesure d’audience n’est pas activée."}, status=403)
        try:
            visitor_id = uuid.UUID(request.COOKIES.get(VISITOR_COOKIE, ""))
        except (ValueError, TypeError, AttributeError):
            return Response({"success": False, "message": "La session visiteur est introuvable. Rechargez le site puis réessayez."}, status=403)

        persona = request.data.get("persona")
        if not isinstance(persona, str) or persona not in dict(VisitorDiscoverySurveyResponse.PERSONA_CHOICES):
            return Response({"success": False, "message": "Choisissez le profil qui vous correspond."}, status=400)
        found_what = request.data.get("found_what")
        if not isinstance(found_what, str) or found_what not in dict(VisitorDiscoverySurveyResponse.FOUND_CHOICES):
            return Response({"success": False, "message": "Indiquez si vous avez trouvé ce que vous cherchiez."}, status=400)
        barriers = _choice_list(request.data.get("barriers", []), VisitorDiscoverySurveyResponse.BARRIER_CHOICES)
        if barriers is None or ("none" in barriers and len(barriers) > 1):
            return Response({"success": False, "message": "Vérifiez les freins sélectionnés."}, status=400)
        missing = request.data.get("missing", "")
        if not isinstance(missing, str) or len(missing.strip()) > 1200:
            return Response({"success": False, "message": "La suggestion doit contenir au plus 1 200 caractères."}, status=400)

        with transaction.atomic():
            visitor = AnonymousVisitor.objects.select_for_update().filter(visitor_id=visitor_id).first()
            if not visitor or not visitor.visitor_survey_prompted_at:
                return Response({"success": False, "message": "Le questionnaire n’est pas disponible pour cette visite."}, status=403)
            if visitor.visitor_survey_completed_at or VisitorDiscoverySurveyResponse.objects.filter(visitor=visitor).exists():
                return Response({"success": False, "message": "Vous avez déjà répondu à ce questionnaire."}, status=409)
            VisitorDiscoverySurveyResponse.objects.create(
                visitor=visitor,
                persona=persona,
                found_what=found_what,
                barriers=barriers,
                missing=missing.strip(),
            )
            visitor.visitor_survey_completed_at = timezone.now()
            visitor.save(update_fields=("visitor_survey_completed_at",))

        return Response({"success": True, "message": "Merci, votre réponse nous aidera à améliorer le site."}, status=201)


class ProductActionSurveyTriggerView(APIView):
    """Offer one product survey after the first completed, authenticated product action."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [VisitorSurveyThrottle]

    def post(self, request):
        if not has_analytics_consent(request):
            return Response({"success": True, "data": {"survey_due": False}})
        visitor_id, set_cookie = _visitor_identity(request)
        now = timezone.now()
        AnonymousVisitor.objects.get_or_create(visitor_id=visitor_id, defaults={"last_seen": now})
        due = False
        with transaction.atomic():
            visitor = AnonymousVisitor.objects.select_for_update().get(visitor_id=visitor_id)
            visitor.last_seen = now
            updates = ["last_seen"]
            if not visitor.first_product_action_at:
                visitor.first_product_action_at = now
                updates.append("first_product_action_at")
            if not visitor.product_survey_prompted_at and not visitor.product_survey_completed_at:
                visitor.product_survey_prompted_at = now
                updates.append("product_survey_prompted_at")
                due = True
            if updates:
                visitor.save(update_fields=updates)
        response = Response({"success": True, "data": {"survey_due": due}})
        attach_visitor_cookie(request, response, visitor_id, set_cookie)
        response["Cache-Control"] = "no-store"
        return response


class ProductExperienceSurveySubmitView(APIView):
    """Store one pseudonymous ease-of-use response after a successful product action."""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]
    throttle_classes = [VisitorSurveyThrottle]

    def post(self, request):
        if not has_analytics_consent(request):
            return Response({"success": False, "message": "La mesure d’audience n’est pas activée."}, status=403)
        try:
            visitor_id = uuid.UUID(request.COOKIES.get(VISITOR_COOKIE, ""))
        except (ValueError, TypeError, AttributeError):
            return Response({"success": False, "message": "La session est introuvable. Rechargez puis réessayez."}, status=403)

        rating = request.data.get("ease_rating")
        if isinstance(rating, bool) or not isinstance(rating, int) or not 1 <= rating <= 5:
            return Response({"success": False, "message": "Choisissez une réponse de 1 à 5."}, status=400)
        appreciated = _choice_list(request.data.get("appreciated", []), ProductExperienceSurveyResponse.APPRECIATED_CHOICES)
        pain_points = _choice_list(request.data.get("pain_points", []), ProductExperienceSurveyResponse.PAIN_POINT_CHOICES)
        if appreciated is None or pain_points is None or ("none" in pain_points and len(pain_points) > 1):
            return Response({"success": False, "message": "Vérifiez les réponses cochées."}, status=400)
        suggestion = request.data.get("improvement_suggestion", "")
        if not isinstance(suggestion, str) or len(suggestion.strip()) > 1200:
            return Response({"success": False, "message": "La suggestion doit contenir au plus 1 200 caractères."}, status=400)

        with transaction.atomic():
            visitor = AnonymousVisitor.objects.select_for_update().filter(visitor_id=visitor_id).first()
            if not visitor or not visitor.product_survey_prompted_at:
                return Response({"success": False, "message": "Le questionnaire apparaît après une première action terminée."}, status=403)
            if visitor.product_survey_completed_at or ProductExperienceSurveyResponse.objects.filter(visitor=visitor).exists():
                return Response({"success": False, "message": "Vous avez déjà répondu à ce questionnaire."}, status=409)
            ProductExperienceSurveyResponse.objects.create(
                visitor=visitor,
                ease_rating=rating,
                appreciated=appreciated,
                pain_points=pain_points,
                improvement_suggestion=suggestion.strip(),
            )
            visitor.product_survey_completed_at = timezone.now()
            visitor.save(update_fields=("product_survey_completed_at",))
        return Response({"success": True, "message": "Merci pour votre retour sur votre première action."}, status=201)


class ProductSurveySummaryView(APIView):
    """Expose only product ease-of-use averages once a meaningful sample is reached."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        queryset = ProductExperienceSurveyResponse.objects.all()
        # Score is ease_rating; keep visitor discovery responses and legacy visitor ratings out.
        aggregate = queryset.aggregate(average=Avg("ease_rating"), count=Count("id"))
        count = aggregate["count"]
        average = round(float(aggregate["average"]), 1) if count >= PUBLIC_RATING_MINIMUM_RESPONSES and aggregate["average"] is not None else None
        response = Response({
            "success": True,
            "data": {"average_rating": average, "responses_total": count, "minimum_responses": PUBLIC_RATING_MINIMUM_RESPONSES},
        })
        response["Cache-Control"] = "no-store"
        return response

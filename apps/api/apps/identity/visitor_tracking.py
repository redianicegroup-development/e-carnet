import uuid
from urllib.parse import urlsplit

from django.conf import settings
from django.db import DatabaseError
from django.db.models import F
from django.utils import timezone

from .models import AnonymousVisitor

VISITOR_COOKIE = "ecarnet_visitor"
ANALYTICS_CONSENT_COOKIE = "ecarnet_analytics_consent"
VISITOR_COOKIE_AGE = 60 * 60 * 24 * 30
AUTH_COUNTERS = {
    "login_success": "login_success_count",
    "login_failure": "login_failure_count",
    "registration": "registration_count",
    "oauth_success": "oauth_success_count",
    "oauth_link": "oauth_link_count",
}
AUTH_PAGE_PREFIXES = (
    "/connexion", "/inscription", "/onboarding", "/patient/acces",
    "/professionnel/acces", "/etablissement/activation",
)


def has_analytics_consent(request):
    """Only collect product analytics after the user's explicit, browser-held opt-in."""
    return request.COOKIES.get(ANALYTICS_CONSENT_COOKIE) == "accepted"


def normalize_page_category(raw_path):
    """Store only a coarse route category, never a raw URL, query string, or record ID."""
    if not isinstance(raw_path, str) or len(raw_path) > 512:
        return "other"
    parsed = urlsplit(raw_path)
    if parsed.scheme or parsed.netloc or parsed.path.startswith("//"):
        return "other"
    path = parsed.path or "/"
    if not path.startswith("/") or path.startswith("//"):
        return "other"
    if path == "/":
        return "landing"
    if any(path == prefix or path.startswith(prefix + "/") for prefix in AUTH_PAGE_PREFIXES):
        return "auth"
    if path == "/patient" or path.startswith("/patient/"):
        return "patient"
    if path == "/professionnel" or path.startswith("/professionnel/"):
        return "professional"
    if path == "/etablissement" or path.startswith("/etablissement/"):
        return "establishment"
    return "public" if path in {"/aide", "/faq", "/a-propos", "/securite", "/conditions-rattachement"} else "other"


def _visitor_identity(request):
    raw_cookie = request.COOKIES.get(VISITOR_COOKIE, "")
    try:
        visitor_id = uuid.UUID(raw_cookie)
        return visitor_id, str(visitor_id) != raw_cookie
    except (ValueError, TypeError, AttributeError):
        return uuid.uuid4(), True


def _touch(visitor_id, *, page_category=None, auth_event=None, click_category=None, click_page_category=None):
    now = timezone.now()
    visitor, _ = AnonymousVisitor.objects.get_or_create(visitor_id=visitor_id, defaults={"last_seen": now})
    updates = {"last_seen": now}
    if page_category:
        updates["last_page_category"] = page_category
        updates["page_view_count"] = F("page_view_count") + 1
        if page_category in {"landing", "public"}:
            updates["public_page_view_count"] = F("public_page_view_count") + 1
        if page_category == "auth":
            updates["auth_page_view_count"] = F("auth_page_view_count") + 1
            updates["last_auth_event"] = "auth_page"
            updates["last_auth_event_at"] = now
    if auth_event:
        counter = AUTH_COUNTERS.get(auth_event)
        if not counter:
            raise ValueError("Unsupported authentication event")
        updates[counter] = F(counter) + 1
        updates["last_page_category"] = "auth"
        updates["last_auth_event"] = auth_event
        updates["last_auth_event_at"] = now
    if click_category is not None:
        allowed_clicks = dict(AnonymousVisitor.CLICK_CATEGORIES)
        if click_category not in allowed_clicks:
            click_category = "other"
        updates["click_count"] = F("click_count") + 1
        updates["last_click_category"] = click_category
        updates["last_click_page_category"] = click_page_category or "other"
        updates["last_click_at"] = now
    AnonymousVisitor.objects.filter(visitor_id=visitor.visitor_id).update(**updates)
    return visitor_id


def record_page_view(request, raw_path):
    if not has_analytics_consent(request):
        return None, False
    visitor_id, set_cookie = _visitor_identity(request)
    _touch(visitor_id, page_category=normalize_page_category(raw_path))
    return visitor_id, set_cookie


def record_auth_event(request, event):
    if not has_analytics_consent(request):
        return None, False
    visitor_id, set_cookie = _visitor_identity(request)
    _touch(visitor_id, auth_event=event)
    return visitor_id, set_cookie


def record_click(request, category, raw_path):
    if not has_analytics_consent(request):
        return None, False
    visitor_id, set_cookie = _visitor_identity(request)
    _touch(
        visitor_id,
        click_category=category,
        click_page_category=normalize_page_category(raw_path),
    )
    return visitor_id, set_cookie


def track_auth_response(request, response, event):
    """Best-effort analytics event after opt-in; never store credentials or block authentication."""
    if not has_analytics_consent(request):
        return response
    try:
        visitor_id, set_cookie = record_auth_event(request, event)
        return attach_visitor_cookie(request, response, visitor_id, set_cookie)
    except DatabaseError:
        return response


def attach_visitor_cookie(request, response, visitor_id, set_cookie):
    if has_analytics_consent(request) and visitor_id and set_cookie:
        secure_cookie = not settings.DEBUG or request.is_secure()
        response.set_cookie(
            VISITOR_COOKIE,
            str(visitor_id),
            max_age=VISITOR_COOKIE_AGE,
            httponly=True,
            secure=secure_cookie,
            samesite="None" if secure_cookie else "Lax",
            path="/",
        )
    return response

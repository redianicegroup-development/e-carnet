from django.db import DatabaseError, connections
from django.http import JsonResponse
from django.urls import include, path
from django.conf import settings
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie


def health_live(_request):
    return JsonResponse({"status": "ok"})


def health_ready(_request):
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except DatabaseError:
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ready"})


@ensure_csrf_cookie
def csrf_token(request):
    # Le jeton est aussi renvoyé en JSON : le front peut le garder en mémoire quand le cookie n'est pas lisible (domaines différents).
    return JsonResponse({"success": True, "csrfToken": get_token(request)})


urlpatterns = [
    path("api/v1/health/", health_live), path("api/v1/health/live/", health_live),
    path("api/v1/health/ready/", health_ready), path("api/v1/csrf/", csrf_token),
    path("api/v1/identity/", include("apps.identity.urls")), path("api/v1/patient/", include("apps.patients.urls")),
    path("api/v1/patient/care/", include("apps.care.urls")), path("api/v1/establishments/", include("apps.establishments.urls")),
    path("api/v1/professionals/", include("apps.professionals.urls")),
]

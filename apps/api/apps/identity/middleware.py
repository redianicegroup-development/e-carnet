from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse

LIMIT = 10
WINDOW_SECONDS = 15 * 60


def client_ip(request):
    """IP du client selon le nombre de proxys de confiance (même règle que DRF NUM_PROXIES)."""
    proxies = settings.REST_FRAMEWORK.get("NUM_PROXIES")
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if proxies and forwarded:
        addresses = [item.strip() for item in forwarded.split(",") if item.strip()]
        if addresses:
            return addresses[-min(proxies, len(addresses))]
    return request.META.get("REMOTE_ADDR", "unknown")


class AdminLoginThrottleMiddleware:
    """Limite les essais de connexion à la console d'administration Django (compte staff sans MFA en V1)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "POST" and request.path == f"/{settings.ADMIN_URL}login/":
            key = f"admin-login:{client_ip(request)}"
            if cache.add(key, 1, WINDOW_SECONDS):
                count = 1
            else:
                try:
                    count = cache.incr(key)
                except ValueError:
                    cache.set(key, 1, WINDOW_SECONDS)
                    count = 1
            if count > LIMIT:
                return HttpResponse("Trop de tentatives. Réessayez plus tard.", status=429, content_type="text/plain; charset=utf-8")
        return self.get_response(request)

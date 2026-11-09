import time

from django.conf import settings
from django.contrib.auth import logout
from django.core.cache import cache
from django.http import HttpResponse, JsonResponse

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


# Chemins qui restent ouverts tant que le mot de passe temporaire n'a pas été changé : lire son compte (le front y lit le
# drapeau), changer le mot de passe, se déconnecter, et le strict nécessaire au chargement de la page.
PASSWORD_CHANGE_ALLOWED_PATHS = frozenset({
    "/api/v1/identity/me/",
    "/api/v1/identity/me/password/",
    "/api/v1/identity/me/theme/",
    "/api/v1/identity/logout/",
    "/api/v1/identity/analytics/visits/",
    "/api/v1/identity/analytics/clicks/",
    "/api/v1/csrf/",
})
PASSWORD_CHANGE_ALLOWED_PREFIXES = ("/api/v1/health/",)
PASSWORD_CHANGE_REQUIRED_MESSAGE = "Vous devez d’abord remplacer votre mot de passe temporaire."


class ForcePasswordChangeMiddleware:
    """Ferme l'API aux comptes dont le mot de passe est temporaire (`AccountProfile.must_change_password`).

    Le contrôle est côté serveur : cacher les écrans côté navigateur ne suffirait pas, un mot de passe temporaire transmis
    hors application ne doit donner accès à rien d'autre qu'au choix du mot de passe définitif."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if path.startswith("/api/") and path not in PASSWORD_CHANGE_ALLOWED_PATHS and not path.startswith(PASSWORD_CHANGE_ALLOWED_PREFIXES):
            user = getattr(request, "user", None)
            if user is not None and user.is_authenticated and self._must_change(user):
                return JsonResponse(
                    {"success": False, "code": "password_change_required", "message": PASSWORD_CHANGE_REQUIRED_MESSAGE},
                    status=403,
                )
        return self.get_response(request)

    @staticmethod
    def _must_change(user) -> bool:
        from .models import AccountProfile  # import tardif : le middleware est chargé avant que les modèles soient prêts

        return AccountProfile.objects.filter(user=user, must_change_password=True).exists()


class ApiPrivateNoStoreMiddleware:
    """Aucune réponse de l'API n'est mise en cache par un navigateur ou un intermédiaire, sauf si la vue le décide elle-même.

    Les réponses dépendent de la session (dossier patient, consultations, équipe) : un cache partagé ne doit jamais pouvoir
    les resservir à un autre compte. Les vues qui fixent déjà `Cache-Control` (logo, photo en cache privé d'une heure) gardent le leur."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith("/api/") and not response.has_header("Cache-Control"):
            response["Cache-Control"] = "private, no-store"
        return response


# Chemins qui ne comptent pas comme une activité de la personne : sondes, jeton CSRF, compteurs de visite.
IDLE_EXEMPT_PREFIXES = ("/api/v1/health/", "/api/v1/csrf/", "/api/v1/identity/analytics/", "/api/v1/patient/care/notifications/pulse/")
SESSION_LAST_SEEN_KEY = "last_seen_at"
IDLE_TIMEOUT_MESSAGE = "Votre session a expiré après une période d’inactivité. Reconnectez-vous."


class PrivilegedIdleTimeoutMiddleware:
    """SEC-04 : déconnecte côté serveur, après une inactivité, les comptes qui ouvrent des dossiers de patients.

    Sont concernés le staff et les comptes ayant un contexte professionnel ou établissement actif. L'instant de la dernière
    requête est gardé dans la session pour tout le monde (un patient qui bascule en contexte professionnel n'est pas
    déconnecté à tort) ; la limite, elle, ne s'applique qu'aux comptes concernés. Au-delà, la session est fermée et l'API
    répond 401 `session_idle`. La requête qui ferme la session est la première après la pause : le contrôle se fait donc
    sans tâche de fond."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        limit = int(getattr(settings, "ECARNET_PRIVILEGED_IDLE_SECONDS", 0))
        path = request.path
        if limit > 0 and path.startswith("/api/") and not path.startswith(IDLE_EXEMPT_PREFIXES):
            user = getattr(request, "user", None)
            if user is not None and user.is_authenticated:
                now = int(time.time())
                last = request.session.get(SESSION_LAST_SEEN_KEY)
                if isinstance(last, int) and now - last > limit and self._is_privileged(user):
                    logout(request)
                    return JsonResponse({"success": False, "code": "session_idle", "message": IDLE_TIMEOUT_MESSAGE}, status=401)
                request.session[SESSION_LAST_SEEN_KEY] = now
        return self.get_response(request)

    @staticmethod
    def _is_privileged(user) -> bool:
        if user.is_staff or user.is_superuser:
            return True
        from .models import AccountContext  # import tardif : le middleware est chargé avant que les modèles soient prêts

        return AccountContext.objects.filter(user=user, is_active=True, role__in=("professional", "establishment")).exists()

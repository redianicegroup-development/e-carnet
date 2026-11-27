"""Portail de surveillance technique : un accès À PART de la console d'administration.

La personne qui surveille n'a pas besoin d'un compte Mon E‑Carnet. Elle ouvre `/surveillance` et saisit deux valeurs que l'hébergeur
a posées dans les variables d'environnement du serveur :

* `ECARNET_OPS_PORTAL_ID`      : l'identifiant d'exploitation ;
  plusieurs adresses e-mail peuvent être séparées par des virgules ;
* `ECARNET_OPS_PORTAL_SECRET`  : le secret (24 caractères au minimum).

Fermé par défaut : tant que ces deux variables ne sont pas posées (ou si le secret est trop court), le portail répond « non configuré ».

Garde-fous :
* comparaison à temps constant (aucune fuite par le temps de réponse), jamais de secret dans une réponse ni dans les journaux ;
* limite par adresse IP ET verrou général après trop d'échecs, pour résister à une attaque répartie ;
* session = cookie signé, HttpOnly, limité au chemin de l'API du portail, valable 30 minutes (réglable), qui meurt si le secret change ;
* chaque action qui modifie quelque chose exige l'en-tête `X-Ops-Csrf` (valeur remise à la connexion) : un site tiers ne peut pas la déclencher ;
* connexions et échecs inscrits au journal d'audit, sans contenu.
"""
import hashlib
import hmac
import logging
import secrets

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from rest_framework import status
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event

from .throttles import IpScopedThrottle

logger = logging.getLogger(__name__)

COOKIE_NAME = "ecarnet_ops"
COOKIE_PATH = "/api/v1/identity/ops/"
SALT = "ecarnet.ops-portal.v1"
CSRF_HEADER = "HTTP_X_OPS_CSRF"
MIN_SECRET_LENGTH = 24
MIN_ID_LENGTH = 4
LOCK_KEY = "ecarnet:ops-portal:failures"
LOCK_LIMIT = 20
LOCK_WINDOW_SECONDS = 15 * 60
NOT_CONFIGURED_MESSAGE = "Le portail de surveillance n’est pas activé sur ce serveur. Posez ECARNET_OPS_PORTAL_ID et ECARNET_OPS_PORTAL_SECRET (24 caractères minimum), puis redémarrez le serveur."


def _session_seconds():
    return max(300, int(getattr(settings, "ECARNET_OPS_PORTAL_SESSION_SECONDS", 1800)))


def _configured_identifiers():
    return [
        identifier.strip()
        for identifier in getattr(settings, "ECARNET_OPS_PORTAL_ID", "").split(",")
        if identifier.strip()
    ]


def portal_configured():
    secret = getattr(settings, "ECARNET_OPS_PORTAL_SECRET", "")
    return any(len(identifier) >= MIN_ID_LENGTH for identifier in _configured_identifiers()) and len(secret) >= MIN_SECRET_LENGTH


def _fingerprint():
    """Empreinte des secrets : si l'hébergeur les change, toutes les sessions ouvertes meurent d'un coup."""
    raw = f"{settings.ECARNET_OPS_PORTAL_ID}:{settings.ECARNET_OPS_PORTAL_SECRET}".encode()
    return hashlib.sha256(raw).hexdigest()[:20]


def _same(provided, expected):
    """Comparaison à temps constant, quelle que soit la longueur des valeurs."""
    return hmac.compare_digest(hashlib.sha256(provided.encode()).digest(), hashlib.sha256(expected.encode()).digest())


class OpsPrincipal:
    """Personne authentifiée par le portail : ce n'est PAS un compte Mon E‑Carnet (aucun accès à l'administration ni aux données)."""
    is_authenticated = True
    is_active = True
    is_anonymous = False
    is_staff = False
    is_superuser = False
    pk = None
    id = None
    email = ""

    def __str__(self):
        return "portail de surveillance"


class OpsPortalAuthentication(BaseAuthentication):
    def authenticate(self, request):
        raw = request.COOKIES.get(COOKIE_NAME)
        if not raw or not portal_configured():
            return None
        try:
            token = signing.loads(raw, salt=SALT, max_age=_session_seconds())
        except signing.BadSignature:  # inclut SignatureExpired
            return None
        if not isinstance(token, dict) or not hmac.compare_digest(str(token.get("fp", "")), _fingerprint()):
            return None
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            sent = request.META.get(CSRF_HEADER, "")
            if not sent or not hmac.compare_digest(sent, str(token.get("csrf", ""))):
                raise PermissionDenied("Jeton de sécurité du portail manquant ou invalide. Reconnectez-vous.")
        return OpsPrincipal(), token

    def authenticate_header(self, request):
        return "OpsPortal"


class IsOpsPortal(BasePermission):
    message = "Connexion au portail de surveillance requise."

    def has_permission(self, request, view):
        return isinstance(request.user, OpsPrincipal)


class OpsLoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [IpScopedThrottle]
    throttle_scope = "ops_login"

    def post(self, request):
        if not portal_configured():
            return Response({"success": False, "code": "not_configured", "message": NOT_CONFIGURED_MESSAGE}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        failures = cache.get(LOCK_KEY, 0)
        if failures >= LOCK_LIMIT:
            return Response({"success": False, "code": "locked", "message": "Trop d’essais. Le portail est verrouillé quelques minutes."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        identifier = request.data.get("identifier", "")
        secret = request.data.get("secret", "")
        valid_identifier = False
        if isinstance(identifier, str):
            for configured_identifier in _configured_identifiers():
                valid_identifier |= _same(identifier.strip(), configured_identifier)
        valid = isinstance(identifier, str) and isinstance(secret, str) and valid_identifier & _same(secret, settings.ECARNET_OPS_PORTAL_SECRET)
        if not valid:
            try:
                cache.add(LOCK_KEY, 0, timeout=LOCK_WINDOW_SECONDS)
                cache.incr(LOCK_KEY)
            except ValueError:  # la clé a expiré entre les deux appels
                cache.set(LOCK_KEY, 1, timeout=LOCK_WINDOW_SECONDS)
            record_event(event_type="operations.portal.login_failed", actor=None, actor_role="ops_portal", metadata={"action": "login_failed"})
            return Response({"success": False, "code": "invalid_credentials", "message": "Identifiant ou secret incorrect."}, status=status.HTTP_401_UNAUTHORIZED)
        cache.delete(LOCK_KEY)
        csrf = secrets.token_urlsafe(24)
        seconds = _session_seconds()
        response = Response({"success": True, "data": {"csrf": csrf, "expires_in": seconds}})
        response.set_cookie(
            COOKIE_NAME, signing.dumps({"fp": _fingerprint(), "csrf": csrf}, salt=SALT), max_age=seconds, httponly=True,
            secure=settings.SESSION_COOKIE_SECURE, samesite=settings.SESSION_COOKIE_SAMESITE, domain=settings.SESSION_COOKIE_DOMAIN, path=COOKIE_PATH,
        )
        record_event(event_type="operations.portal.login", actor=None, actor_role="ops_portal", metadata={"action": "login"})
        return response


class OpsSessionView(APIView):
    """Dit si la session du portail est valable (et redonne le jeton de sécurité de l'écran)."""
    authentication_classes = [OpsPortalAuthentication]
    permission_classes = [IsOpsPortal]

    def get(self, request):
        return Response({"success": True, "data": {"csrf": request.auth["csrf"], "expires_in": _session_seconds()}})


class OpsLogoutView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response({"success": True, "data": None})
        response.delete_cookie(COOKIE_NAME, path=COOKIE_PATH, domain=settings.SESSION_COOKIE_DOMAIN, samesite=settings.SESSION_COOKIE_SAMESITE)
        return response

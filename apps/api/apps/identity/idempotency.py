"""SEC-05 : une écriture rejouée avec la même clé `Idempotency-Key` n'est exécutée qu'une fois.

Le web envoie une clé par action de la personne (voir `apiSend` dans le client API) et ne reprend une écriture en échec
réseau qu'avec cette clé. Si la première tentative est arrivée au serveur mais que la réponse s'est perdue, la reprise
renvoie la réponse déjà calculée au lieu de créer une deuxième déclaration, un deuxième rendez-vous ou un deuxième document.

- Seules les réponses réussies (2xx) sont gardées 24 h ; une erreur (validation, droits, limite de débit) est réévaluée.
- Une même clé en cours de traitement reçoit 409 ; la même clé avec un autre contenu reçoit 422.
- Le compte (ou l'IP hors connexion), la méthode et le chemin font partie de l'empreinte : une clé ne vaut que pour la même action.
- Les routes qui ouvrent ou ferment une session (connexion, inscription, déconnexion, OAuth) sont exclues : rejouer leur
  réponse sans le cookie qu'elles posent laisserait l'appareil sans session.
- Stockage : le cache Django (table `ecarnet_cache` en production, partagée entre les workers).
"""
import hashlib
import re

from django.core.cache import cache
from django.http import HttpResponse, JsonResponse

from .middleware import client_ip

IDEMPOTENT_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
KEY_PATTERN = re.compile(r"^[A-Za-z0-9_\-]{16,80}$")
RESULT_TTL_SECONDS = 24 * 60 * 60
LOCK_TTL_SECONDS = 60
MAX_STORED_BYTES = 256 * 1024
EXCLUDED_PATHS = frozenset({
    "/api/v1/identity/login/",
    "/api/v1/identity/register/",
    "/api/v1/identity/logout/",
    "/api/v1/identity/logout-all/",
})
EXCLUDED_PREFIXES = ("/api/v1/identity/oauth/",)


def _fingerprint(request) -> str:
    # Le corps n'est pas relu (envoi de documents volumineux) : le type et la taille suffisent à repérer une clé réutilisée.
    return f"{request.META.get('CONTENT_TYPE', '')}|{request.META.get('CONTENT_LENGTH', '')}"


class IdempotencyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        key = request.META.get("HTTP_IDEMPOTENCY_KEY")
        path = request.path
        if (
            not key
            or request.method not in IDEMPOTENT_METHODS
            or not path.startswith("/api/")
            or path in EXCLUDED_PATHS
            or path.startswith(EXCLUDED_PREFIXES)
        ):
            return self.get_response(request)
        if not KEY_PATTERN.match(key):
            return JsonResponse({"success": False, "code": "idempotency_key_invalid", "message": "Clé d’idempotence invalide."}, status=400)

        user = getattr(request, "user", None)
        scope = f"u{user.pk}" if user is not None and user.is_authenticated else f"ip{client_ip(request)}"
        digest = hashlib.sha256(f"{scope}|{request.method}|{path}|{key}".encode()).hexdigest()
        result_key, lock_key = f"idem:r:{digest}", f"idem:l:{digest}"
        fingerprint = _fingerprint(request)

        stored = cache.get(result_key)
        if stored is not None:
            return self._replay(stored, fingerprint)
        if not cache.add(lock_key, "1", LOCK_TTL_SECONDS):
            stored = cache.get(result_key)  # la première tentative vient de se terminer
            if stored is not None:
                return self._replay(stored, fingerprint)
            return JsonResponse({"success": False, "code": "idempotency_in_progress", "message": "Cette action est déjà en cours de traitement."}, status=409)
        try:
            response = self.get_response(request)
            if 200 <= response.status_code < 300 and not getattr(response, "streaming", False) and len(response.content) <= MAX_STORED_BYTES:
                cache.set(result_key, {
                    "status": response.status_code,
                    "body": response.content,
                    "content_type": response.get("Content-Type", "application/json"),
                    "fingerprint": fingerprint,
                }, RESULT_TTL_SECONDS)
            return response
        finally:
            cache.delete(lock_key)

    @staticmethod
    def _replay(stored: dict, fingerprint: str):
        if stored.get("fingerprint") != fingerprint:
            return JsonResponse({"success": False, "code": "idempotency_key_reused", "message": "Cette clé d’idempotence a déjà servi pour une autre demande."}, status=422)
        response = HttpResponse(stored["body"], status=stored["status"], content_type=stored["content_type"])
        response["Idempotent-Replayed"] = "true"
        return response

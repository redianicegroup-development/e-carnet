import hashlib

from rest_framework.throttling import ScopedRateThrottle, SimpleRateThrottle


class WriteScopedThrottle(ScopedRateThrottle):
    """Comme ScopedRateThrottle mais ignore les lectures (GET/HEAD/OPTIONS) de la même vue."""

    def allow_request(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return super().allow_request(request, view)


class LoginEmailThrottle(SimpleRateThrottle):
    """Limite par adresse email ciblée, pour résister aux attaques réparties sur plusieurs IP."""
    scope = "auth_login_email"

    def get_cache_key(self, request, view):
        email = str(request.data.get("email", "")).strip().lower() if hasattr(request, "data") else ""
        if not email:
            return None
        return self.cache_format % {"scope": self.scope, "ident": hashlib.sha256(email.encode()).hexdigest()[:32]}


class IpScopedThrottle(ScopedRateThrottle):
    """Compte par adresse IP même si la session est connectée.

    Le ScopedRateThrottle standard compte par identifiant d'utilisateur quand la requête est authentifiée : or
    l'inscription ouvre une session sur le compte créé, ce qui changerait de compteur à chaque création."""

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}

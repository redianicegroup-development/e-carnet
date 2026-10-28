"""Web Push (VAPID) : envoi de notifications aux navigateurs/appareils abonnés.

Principes :
- la notification dans l'application reste la source de vérité ; le push n'est qu'un « coup de sonnette » ;
- par défaut le texte poussé est neutre (aucun nom de médicament sur l'écran verrouillé) ;
- aucune donnée de santé dans les journaux ;
- sans clés VAPID ou sans pywebpush, tout est silencieusement désactivé.
"""
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

from django.conf import settings
from django.db import connections

try:  # pywebpush absent (pas encore verrouillé dans requirements.txt) : l'API démarre quand même, push désactivé.
    from pywebpush import WebPushException, webpush
except ImportError:  # pragma: no cover - dépend de l'environnement
    webpush = None

    class WebPushException(Exception):
        def __init__(self, message, response=None):
            super().__init__(message)
            self.response = response

logger = logging.getLogger(__name__)

# Envoi sans bloquer la requête HTTP. Suffisant pour un pilote ; au-delà, voir phase2-celery/.
_POOL = ThreadPoolExecutor(max_workers=4, thread_name_prefix="webpush")


def vapid_public_key() -> str:
    return getattr(settings, "ECARNET_VAPID_PUBLIC_KEY", "")


def push_enabled() -> bool:
    return bool(
        webpush is not None
        and getattr(settings, "ECARNET_VAPID_PUBLIC_KEY", "")
        and getattr(settings, "ECARNET_VAPID_PRIVATE_KEY", "")
        and getattr(settings, "ECARNET_VAPID_SUBJECT", "")
    )


def is_allowed_endpoint(endpoint: str) -> bool:
    """Anti-SSRF : https, port standard, pas d'identifiants, et seulement les services de push connus."""
    try:
        parsed = urlparse(endpoint)
        host = (parsed.hostname or "").lower()
        port = parsed.port
    except ValueError:
        return False
    if parsed.scheme != "https" or not host or parsed.username or parsed.password or port not in (None, 443):
        return False
    return any(host == allowed or host.endswith("." + allowed) for allowed in getattr(settings, "ECARNET_PUSH_ALLOWED_HOSTS", ()))


def build_payload(kind: str, title: str, body: str, url: str = "/patient", data: dict | None = None) -> dict:
    """Charge utile envoyée au service worker. Texte neutre sauf ECARNET_PUSH_SHOW_DETAILS."""
    if not getattr(settings, "ECARNET_PUSH_SHOW_DETAILS", False):
        if kind.startswith("medication"):
            title, body = "Rappel de prise", "Ouvrez Mon E‑Carnet pour voir votre rappel."
        else:
            title, body = "Mon E‑Carnet", "Vous avez une nouvelle notification."
    return {"title": title, "body": body, "url": url, "data": {**(data or {}), "kind": kind}}


def _urgency(kind: str) -> str:
    return "high" if kind.startswith("medication") else "normal"


def deliver(user_id, payload: dict, only=None) -> list:
    """Envoie la charge utile aux abonnements actifs de l'utilisateur.

    Désactive les abonnements morts (404/410). Renvoie les identifiants (texte) des abonnements en échec transitoire :
    ``only`` permet de ne réessayer que ceux-là, sans doubler la notification sur les appareils déjà servis.
    """
    from .models import PushSubscription

    if not push_enabled():
        return []
    body = json.dumps(payload, ensure_ascii=False)
    urgency = _urgency(payload.get("data", {}).get("kind", ""))
    transient = []
    subscriptions = PushSubscription.objects.filter(user_id=user_id, active=True)
    if only is not None:
        subscriptions = subscriptions.filter(pk__in=list(only))
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                data=body,
                vapid_private_key=settings.ECARNET_VAPID_PRIVATE_KEY,
                # Nouveau dictionnaire à chaque appel : pywebpush y écrit « aud » et « exp » et les réutiliserait
                # pour un service de push différent (rejet 403).
                vapid_claims={"sub": settings.ECARNET_VAPID_SUBJECT},
                ttl=settings.ECARNET_PUSH_TTL_SECONDS,
                headers={"Urgency": urgency},
                timeout=10,
            )
        except WebPushException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status in (404, 410):
                PushSubscription.objects.filter(pk=sub.pk).update(active=False)
            else:
                transient.append(str(sub.pk))
                logger.warning("push: échec transitoire abonnement=%s statut=%s", sub.pk, status)
        except Exception:  # noqa: BLE001 - un abonnement défaillant ne doit jamais bloquer les autres
            transient.append(str(sub.pk))
            logger.warning("push: erreur inattendue abonnement=%s", sub.pk, exc_info=False)
    return transient


def _run_in_pool(user_id, payload: dict) -> None:
    try:
        deliver(user_id, payload)
    finally:
        # Un thread du pool ouvre sa propre connexion SQL, jamais refermée par le cycle requête/réponse.
        connections.close_all()


def _dispatch(user_id, payload: dict) -> None:
    if getattr(settings, "ECARNET_PUSH_USE_CELERY", False):
        from .tasks import send_webpush_task  # phase 2 : voir phase2-celery/

        send_webpush_task.delay(str(user_id), payload)
        return
    _POOL.submit(_run_in_pool, user_id, payload)


def send_push_to_user(user_id, kind: str, title: str, body: str, url: str = "/patient", data: dict | None = None) -> None:
    """Point d'entrée sûr : ne lève jamais d'exception vers l'appelant."""
    try:
        if not push_enabled():
            return
        _dispatch(user_id, build_payload(kind, title, body, url, data))
    except Exception:  # noqa: BLE001
        logger.warning("push: envoi non planifié", exc_info=False)

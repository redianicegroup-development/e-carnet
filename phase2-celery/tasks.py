"""Envoi Web Push via Celery (phase 2). À copier dans apps/api/apps/care/tasks.py — voir README.md."""
import logging

from celery import shared_task
from celery.exceptions import MaxRetriesExceededError

from .push import deliver

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=5, ignore_result=True)
def send_webpush_task(self, user_id, payload, only=None):
    """Réessaie uniquement les abonnements en échec transitoire (pas de doublon sur les appareils déjà servis)."""
    failed = deliver(user_id, payload, only=only)
    if not failed:
        return
    try:
        raise self.retry(args=(user_id, payload, failed), countdown=min(30 * 2 ** self.request.retries, 900))
    except MaxRetriesExceededError:
        # Aucune donnée de santé dans les journaux : ni titre ni corps.
        logger.error("push: abandon après %s tentatives, %s abonnement(s) non joint(s)", self.max_retries, len(failed))

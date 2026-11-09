"""SEC-04 : fermeture de toutes les sessions d'un compte (« se déconnecter de tous les appareils »)."""
from django.contrib.sessions.models import Session
from django.utils import timezone


def end_all_sessions(user) -> int:
    """Supprime les sessions actives du compte, celle de la requête en cours comprise, et renvoie leur nombre.

    Les sessions sont en base (moteur par défaut) : on parcourt les sessions non expirées et on retient celles dont
    l'identifiant d'utilisateur correspond. Le coût suit le nombre de sessions actives ; si l'application en compte un jour
    des dizaines de milliers, ajouter un index utilisateur → clé de session plutôt que ce parcours."""
    user_id = str(user.pk)
    closed = 0
    for session in Session.objects.filter(expire_date__gt=timezone.now()).iterator(chunk_size=500):
        try:
            data = session.get_decoded()
        except Exception:  # session illisible (ancienne clé secrète…) : elle ne peut pas appartenir à un compte actif
            continue
        if data.get("_auth_user_id") == user_id:
            session.delete()
            closed += 1
    return closed

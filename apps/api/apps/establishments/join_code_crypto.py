"""Conservation temporaire du code médecin pour l'afficher à l'administrateur pendant sa durée de vie (48 h).

Le code reste vérifié par son empreinte (`code_hash`). Cette copie chiffrée ne sert qu'à le réafficher à l'administrateur de la
structure ; elle est effacée dès que le code est utilisé, révoqué ou expiré. Chiffrement : Fernet, clé dérivée de SECRET_KEY."""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.utils import timezone


def _fernet():
    digest = hashlib.sha256(f"ecarnet-join-code:{settings.SECRET_KEY}".encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def seal_code(raw_code: str) -> str:
    return _fernet().encrypt(raw_code.encode("utf-8")).decode("ascii")


def unseal_code(token: str) -> str:
    """Code en clair, ou chaîne vide si la copie est absente ou illisible (clé changée) : on n'affiche alors rien."""
    if not token:
        return ""
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return ""


def purge_dead_codes(queryset):
    """Efface la copie chiffrée des codes utilisés, révoqués ou expirés. Renvoie le nombre de lignes nettoyées."""
    from django.db.models import Q
    dead = queryset.exclude(code_encrypted="").filter(Q(consumed_at__isnull=False) | Q(revoked_at__isnull=False) | Q(expires_at__lte=timezone.now()))
    return dead.update(code_encrypted="")

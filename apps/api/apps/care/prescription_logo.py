"""Logo de l'établissement pour le PDF de l'ordonnance.

Aucune URL n'est suivie au hasard : le logo vient de la fiche de l'établissement, que le serveur enregistre lui-même.
— développement / tests : l'image WebP conservée en base (aucun appel réseau) ;
— production : l'URL Cloudinary de NOTRE espace (`https://res.cloudinary.com/<notre cloud>/`), jamais un autre hôte, avec délai et taille limités.
Tout échec (image absente, illisible, SVG, stockage injoignable) rend `None` : le PDF dessine alors le monogramme de la structure."""
from __future__ import annotations

import base64
import binascii
from io import BytesIO
from urllib.request import urlopen

from PIL import Image, UnidentifiedImageError

from apps.cloudinary_storage import CLOUDINARY_CLOUD_NAME

MAX_LOGO_BYTES = 3 * 1024 * 1024
MAX_LOGO_SIDE = 480
FETCH_TIMEOUT_SECONDS = 4


def trusted_logo_url(url: str) -> bool:
    return bool(CLOUDINARY_CLOUD_NAME) and (url or "").startswith(f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/")


def _raw_logo(establishment) -> bytes | None:
    if establishment.logo_data:
        try:
            return base64.b64decode(establishment.logo_data.split(",", 1)[1], validate=True)
        except (IndexError, ValueError, binascii.Error):
            return None
    if trusted_logo_url(establishment.logo_url):
        with urlopen(establishment.logo_url, timeout=FETCH_TIMEOUT_SECONDS) as response:  # noqa: S310 - hôte limité à notre espace Cloudinary
            content = response.read(MAX_LOGO_BYTES + 1)
        return content if len(content) <= MAX_LOGO_BYTES else None
    return None


def establishment_logo_png(establishment) -> bytes | None:
    """Le logo en PNG (côté ≤ 480 px), ou `None` : le PDF se rabat alors sur le monogramme."""
    if establishment is None:
        return None
    try:
        raw = _raw_logo(establishment)
        if not raw:
            return None
        with Image.open(BytesIO(raw)) as image:
            image = image.convert("RGBA")
            image.thumbnail((MAX_LOGO_SIDE, MAX_LOGO_SIDE))
            output = BytesIO()
            image.save(output, format="PNG")
        return output.getvalue()
    except (OSError, UnidentifiedImageError, ValueError):
        return None
    except Exception:  # noqa: BLE001 - un logo injoignable ne doit jamais empêcher de produire l'ordonnance
        return None

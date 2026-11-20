"""Photo de profil d'un enfant représenté (PatientProfile sans compte).

Même règle que la photo d'un compte (identity.AccountIdentitySerializer) : une image WebP de 250 Ko maximum, préparée par le navigateur.
Avec Cloudinary, la photo y est envoyée et seule son URL est gardée ; sans Cloudinary (développement, tests), l'image reste dans le profil
sous forme de `data:` URL, que la politique d'images de l'application autorise.
"""
import base64
import binascii
from io import BytesIO

from apps.cloudinary_storage import CLOUDINARY_CONFIGURED, upload as cloudinary_upload

WEBP_PREFIX = "data:image/webp;base64,"
MAX_WEBP_BYTES = 250 * 1024


def clean_avatar_data(value) -> str:
    """Renvoie la `data:` URL WebP validée, une chaîne vide si aucune photo n'est envoyée, ou lève ValueError avec un message lisible."""
    if not value:
        return ""
    if not isinstance(value, str) or not value.startswith(WEBP_PREFIX):
        raise ValueError("La photo doit être une image WebP valide.")
    try:
        image = base64.b64decode(value[len(WEBP_PREFIX):], validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("La photo envoyée est invalide.")
    if len(image) > MAX_WEBP_BYTES or len(image) < 12 or image[:4] != b"RIFF" or image[8:12] != b"WEBP":
        raise ValueError("La photo doit être un WebP valide de 250 Ko maximum.")
    return value


def store_child_avatar(patient, data_url: str) -> None:
    """Enregistre la photo validée dans le profil de l'enfant (Cloudinary si configuré, sinon dans le profil)."""
    if not data_url:
        return
    if CLOUDINARY_CONFIGURED:
        image = base64.b64decode(data_url[len(WEBP_PREFIX):], validate=True)
        result = cloudinary_upload(BytesIO(image), folder="avatars/children", public_id=str(patient.id), resource_type="image", delivery_type="upload")
        patient.avatar_url = result["secure_url"]
        patient.avatar_data = ""
    else:
        patient.avatar_url = ""
        patient.avatar_data = data_url
    patient.save(update_fields=("avatar_url", "avatar_data", "updated_at"))


def child_avatar(patient) -> str:
    """Ce que l'application affiche : l'URL Cloudinary, sinon la `data:` URL gardée dans le profil, sinon rien (initiales)."""
    return patient.avatar_url or patient.avatar_data or ""


def clear_child_avatar(patient) -> None:
    """Retire la photo de l'enfant (retour aux initiales). Le fichier Cloudinary est détruit au mieux : un échec n'empêche pas de retirer la photo."""
    if patient.avatar_url and CLOUDINARY_CONFIGURED:
        try:
            import cloudinary.uploader
            from apps.cloudinary_storage import CLOUDINARY_BASE_FOLDER

            cloudinary.uploader.destroy(f"{CLOUDINARY_BASE_FOLDER}/avatars/children/{patient.id}", resource_type="image", type="upload", invalidate=True)
        except Exception:  # noqa: BLE001 - la photo n'est plus affichée même si la destruction distante échoue
            pass
    patient.avatar_url = ""
    patient.avatar_data = ""
    patient.save(update_fields=("avatar_url", "avatar_data", "updated_at"))

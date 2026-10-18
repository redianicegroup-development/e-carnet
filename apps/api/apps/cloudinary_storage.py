import os
from pathlib import Path
from urllib.request import urlopen

import cloudinary
import cloudinary.uploader
import cloudinary.utils
from django.core.exceptions import ImproperlyConfigured

CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "").strip()
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY", "").strip()
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET", "").strip()
CLOUDINARY_BASE_FOLDER = os.environ.get("CLOUDINARY_BASE_FOLDER", "e-carnet").strip("/") or "e-carnet"
CLOUDINARY_CONFIGURED = all((CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET))

if CLOUDINARY_CONFIGURED:
    cloudinary.config(cloud_name=CLOUDINARY_CLOUD_NAME, api_key=CLOUDINARY_API_KEY, api_secret=CLOUDINARY_API_SECRET, secure=True)


def require_cloudinary():
    if not CLOUDINARY_CONFIGURED:
        raise ImproperlyConfigured("CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET sont requis pour les uploads.")


def upload(file_obj, *, folder: str, public_id: str, resource_type: str = "auto", delivery_type: str = "private") -> dict:
    require_cloudinary()
    return cloudinary.uploader.upload(
        file_obj,
        folder=f"{CLOUDINARY_BASE_FOLDER}/{folder}".strip("/"),
        public_id=public_id,
        resource_type=resource_type,
        type=delivery_type,
        overwrite=True,
        invalidate=True,
        use_filename=False,
        unique_filename=False,
    )


def destroy(public_id: str, *, resource_type: str) -> dict:
    """Destroy exactly the private asset that was uploaded for a medical document."""
    require_cloudinary()
    result = cloudinary.uploader.destroy(
        public_id,
        resource_type=resource_type,
        type="private",
        invalidate=True,
    )
    if result.get("result") != "ok":
        raise RuntimeError(f"Cloudinary destruction refused ({result.get('result', 'unknown')}).")
    return result


def signed_download(public_id: str, *, resource_type: str, extension: str = "") -> bytes:
    require_cloudinary()
    url = cloudinary.utils.private_download_url(public_id, format=extension.lstrip(".") or "bin", resource_type=resource_type, type="private", attachment=False)
    with urlopen(url, timeout=20) as response:
        return response.read()


def extension_from_name(name: str) -> str:
    return Path(name).suffix.lower().lstrip(".")

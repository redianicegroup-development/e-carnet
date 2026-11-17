"""Une seule image source, deux variantes 3:1 générées côté serveur (ordinateur 1500×500, mobile 750×250), en WebP."""
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

SIZES = {"desktop": (1500, 500), "mobile": (750, 250)}
MIN_WIDTH, MIN_HEIGHT = 1200, 400
MAX_SOURCE_BYTES = 5 * 1024 * 1024
MAX_SOURCE_PIXELS = 40_000_000
MAX_VARIANT_BYTES = 200 * 1024
ALLOWED_FORMATS = {"PNG", "JPEG", "WEBP", "GIF"}


class BannerImageError(ValueError):
    """Message affichable tel quel à l'administrateur."""


def _flatten(image):
    # Fond blanc sous la transparence ; première image d'un GIF animé (jamais d'animation : mode économie de données).
    image = ImageOps.exif_transpose(image)
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        base = Image.new("RGB", rgba.size, (255, 255, 255))
        base.paste(rgba, mask=rgba.split()[-1])
        return base
    return image.convert("RGB")


def _crop_3_to_1(image, focus_x, focus_y):
    width, height = image.size
    target_height = width / 3
    if height >= target_height:
        top = round((height - target_height) * focus_y)
        return image.crop((0, top, width, top + round(target_height)))
    target_width = height * 3
    left = round((width - target_width) * focus_x)
    return image.crop((left, 0, left + round(target_width), height))


def _encode(image):
    for quality in (82, 72, 62, 52, 42):
        buffer = BytesIO()
        image.save(buffer, "WEBP", quality=quality, method=4)
        if buffer.tell() <= MAX_VARIANT_BYTES:
            return buffer.getvalue()
    raise BannerImageError("Image trop détaillée pour tenir en 200 Ko : simplifiez-la ou réduisez ses détails.")


def build_variants(data, focus_x=0.5, focus_y=0.5):
    """Retourne {"desktop": bytes, "mobile": bytes}. Lève BannerImageError avec un message clair."""
    if not data:
        raise BannerImageError("Importez une image.")
    if len(data) > MAX_SOURCE_BYTES:
        raise BannerImageError("Image trop lourde (5 Mo au plus).")
    focus_x = min(1.0, max(0.0, float(focus_x)))
    focus_y = min(1.0, max(0.0, float(focus_y)))
    try:
        image = Image.open(BytesIO(data))
        if image.format not in ALLOWED_FORMATS:
            raise BannerImageError("Format non pris en charge : PNG, JPG, WebP ou GIF.")
        if image.width * image.height > MAX_SOURCE_PIXELS:
            raise BannerImageError("Image trop grande en pixels.")
        image.seek(0)
        image.load()
    except BannerImageError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, EOFError):
        raise BannerImageError("Image illisible : importez un PNG, JPG, WebP ou GIF valide.")
    image = _flatten(image)
    if image.width < MIN_WIDTH or image.height < MIN_HEIGHT:
        raise BannerImageError(f"Image trop petite : {MIN_WIDTH} × {MIN_HEIGHT} px au minimum (idéal : 1500 × 500).")
    cropped = _crop_3_to_1(image, focus_x, focus_y)
    return {name: _encode(cropped.resize(size, Image.LANCZOS)) for name, size in SIZES.items()}

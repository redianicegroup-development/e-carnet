import re

DEFAULT_THEME = {
    "font_pair": "sora-bricolage",
    "text_scale": "normal",
    "palette": ["#FFF7E6", "#FFE3B3", "#FFC857", "#4BAA8B", "#1E3A34"],
}


def default_theme():
    """Renvoie une nouvelle valeur pour chaque préférence créée."""
    return {"font_pair": DEFAULT_THEME["font_pair"], "text_scale": DEFAULT_THEME["text_scale"], "palette": list(DEFAULT_THEME["palette"])}


FONT_PAIRS = {"sora-bricolage", "mooli-manrope", "fredoka-quicksand"}
TEXT_SCALES = {"normal", "large", "very-large"}
LEGACY_FONT_PAIRS = {
    "Sora": "sora-bricolage", "Bricolage Grotesque": "sora-bricolage",
    "Mooli": "mooli-manrope", "Manrope": "mooli-manrope",
    "Fredoka": "fredoka-quicksand", "Quicksand": "fredoka-quicksand",
}
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def normalize_theme(value):
    """Convertit au chargement les préférences historiques vers le format V1 actuel."""
    if not isinstance(value, dict):
        return default_theme()
    palette = value.get("palette")
    if not isinstance(palette, list) or len(palette) != 5 or not all(isinstance(color, str) and HEX_COLOR.fullmatch(color) for color in palette):
        palette = list(DEFAULT_THEME["palette"])
    pair = value.get("font_pair")
    if not isinstance(pair, str) or pair not in FONT_PAIRS:
        legacy_font = value.get("font")
        pair = LEGACY_FONT_PAIRS.get(legacy_font, DEFAULT_THEME["font_pair"]) if isinstance(legacy_font, str) else DEFAULT_THEME["font_pair"]
    scale = value.get("text_scale")
    if not isinstance(scale, str) or scale not in TEXT_SCALES:
        scale = DEFAULT_THEME["text_scale"]
    return {"font_pair": pair, "text_scale": scale, "palette": [color.upper() for color in palette]}


def _luminance(color):
    channels = [int(color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def validate_theme(value):
    errors = {}
    if not isinstance(value, dict):
        return {"theme": "Un objet de thème est requis."}
    font_pair = value.get("font_pair")
    text_scale = value.get("text_scale")
    palette = value.get("palette")
    if font_pair not in FONT_PAIRS:
        errors["font_pair"] = "Paire de polices non autorisée. Choisissez une paire proposée."
    if text_scale not in TEXT_SCALES:
        errors["text_scale"] = "Taille de texte non autorisée. Choisissez une taille proposée."
    if not isinstance(palette, list) or len(palette) != 5 or not all(isinstance(color, str) and HEX_COLOR.fullmatch(color) for color in palette):
        errors["palette"] = "Cinq couleurs hexadécimales #RRGGBB sont requises."
    else:
        if _luminance(palette[0]) < 0.6:
            errors["palette"] = "La première couleur (fond) doit rester claire en V1."
        if _luminance(palette[4]) > 0.2:
            errors["palette"] = "La cinquième couleur (encre) doit rester foncée."
    return errors

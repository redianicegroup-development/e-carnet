import re

DEFAULT_THEME = {
    "font": "Unbounded",
    "palette": ["#E6FFF7", "#B9F2E3", "#7AD8C8", "#4AA1A3", "#2A4B5D"],
}


def default_theme():
    """Renvoie une nouvelle valeur pour chaque préférence créée."""
    return {"font": DEFAULT_THEME["font"], "palette": list(DEFAULT_THEME["palette"])}


ALLOWED_FONTS = {
    "Plus Jakarta Sans", "Nunito", "Lexend", "Manrope", "Sora", "Mooli",
    "Unbounded", "Quicksand", "Bricolage Grotesque", "Barlow", "Ubuntu", "Fredoka",
}
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def _luminance(color):
    channels = [int(color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def validate_theme(value):
    errors = {}
    if not isinstance(value, dict):
        return {"theme": "Un objet de thème est requis."}
    font = value.get("font")
    palette = value.get("palette")
    if font not in ALLOWED_FONTS:
        errors["font"] = "Police non autorisée. Choisissez une police de la liste." 
    if not isinstance(palette, list) or len(palette) != 5 or not all(isinstance(color, str) and HEX_COLOR.fullmatch(color) for color in palette):
        errors["palette"] = "Cinq couleurs hexadécimales #RRGGBB sont requises."
    else:
        if _luminance(palette[0]) < 0.6:
            errors["palette"] = "La première couleur (fond) doit rester claire en V1."
        if _luminance(palette[4]) > 0.2:
            errors["palette"] = "La cinquième couleur (encre) doit rester foncée."
    return errors

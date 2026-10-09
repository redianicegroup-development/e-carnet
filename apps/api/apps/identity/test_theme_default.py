import re
from pathlib import Path

from django.test import SimpleTestCase

from .theme import DEFAULT_THEME, default_theme

FRONT_THEMES = Path(__file__).resolve().parents[4] / "packages" / "ui" / "src" / "themes.ts"


class DefaultThemeTests(SimpleTestCase):
    def test_default_theme_is_lagon_with_unbounded_and_is_never_shared_between_accounts(self):
        self.assertEqual(DEFAULT_THEME["font"], "Unbounded")
        self.assertEqual(DEFAULT_THEME["palette"], ["#E6FFF7", "#B9F2E3", "#7AD8C8", "#4AA1A3", "#2A4B5D"])
        first, second = default_theme(), default_theme()
        first["palette"][0] = "#000000"
        self.assertEqual(second["palette"][0], "#E6FFF7")

    def test_front_and_api_defaults_stay_in_sync(self):
        if not FRONT_THEMES.exists():  # image Docker de l'API : le dossier packages/ n'est pas copié
            self.skipTest("packages/ui absent")
        source = FRONT_THEMES.read_text(encoding="utf-8")
        default = re.search(r"DEFAULT_THEME[^=]*=\s*\{\s*palette:\s*PALETTES\.(\w+)\.colors,\s*font:\s*\"([^\"]+)\"", source)
        self.assertIsNotNone(default, "DEFAULT_THEME introuvable dans themes.ts")
        palette = re.search(rf"{default.group(1)}:\s*\{{[^}}]*colors:\s*\[([^\]]+)\]", source)
        colors = re.findall(r"#[0-9A-Fa-f]{6}", palette.group(1))
        self.assertEqual(default.group(2), DEFAULT_THEME["font"])
        self.assertEqual([c.upper() for c in colors], [c.upper() for c in DEFAULT_THEME["palette"]])

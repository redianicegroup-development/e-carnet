import importlib
import re
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from django.test import SimpleTestCase

from .theme import DEFAULT_THEME, default_theme

FRONT_THEMES = Path(__file__).resolve().parents[4] / "packages" / "ui" / "src" / "themes.ts"


class DefaultThemeTests(SimpleTestCase):
    def test_default_theme_is_miel_with_bricolage_grotesque_and_is_never_shared_between_accounts(self):
        self.assertEqual(DEFAULT_THEME["font_pair"], "sora-bricolage")
        self.assertEqual(DEFAULT_THEME["text_scale"], "normal")
        self.assertEqual(DEFAULT_THEME["palette"], ["#FFF7E6", "#FFE3B3", "#FFC857", "#4BAA8B", "#1E3A34"])
        first, second = default_theme(), default_theme()
        first["palette"][0] = "#000000"
        self.assertEqual(second["palette"][0], "#FFF7E6")

    def test_front_and_api_defaults_stay_in_sync(self):
        if not FRONT_THEMES.exists():  # image Docker de l'API : le dossier packages/ n'est pas copié
            self.skipTest("packages/ui absent")
        source = FRONT_THEMES.read_text(encoding="utf-8")
        default = re.search(r"DEFAULT_THEME[^=]*=\s*\{\s*palette:\s*PALETTES\.(\w+)\.colors,\s*font_pair:\s*\"([^\"]+)\",\s*text_scale:\s*\"([^\"]+)\"", source)
        self.assertIsNotNone(default, "DEFAULT_THEME introuvable dans themes.ts")
        palette = re.search(rf"{default.group(1)}:\s*\{{[^}}]*colors:\s*\[([^\]]+)\]", source)
        colors = re.findall(r"#[0-9A-Fa-f]{6}", palette.group(1))
        self.assertEqual(default.group(2), DEFAULT_THEME["font_pair"])
        self.assertEqual(default.group(3), DEFAULT_THEME["text_scale"])
        self.assertEqual([c.upper() for c in colors], [c.upper() for c in DEFAULT_THEME["palette"]])

    def test_migration_updates_only_rows_matching_the_previous_default(self):
        migration = importlib.import_module("apps.identity.migrations.0014_set_default_theme_miel")
        queryset = Mock()
        manager = Mock()
        manager.using.return_value.filter.return_value = queryset
        model = Mock()
        model.objects = manager
        apps = Mock()
        apps.get_model.return_value = model
        schema_editor = SimpleNamespace(connection=SimpleNamespace(alias="test"))

        migration.update_legacy_defaults(apps, schema_editor)

        apps.get_model.assert_called_once_with("identity", "ThemePreference")
        manager.using.assert_called_once_with("test")
        manager.using.return_value.filter.assert_called_once_with(theme=migration.LEGACY_DEFAULT)
        queryset.update.assert_called_once_with(theme=migration.NEW_DEFAULT)

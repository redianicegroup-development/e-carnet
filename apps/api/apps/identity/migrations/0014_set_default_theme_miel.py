from django.db import migrations


LEGACY_DEFAULT = {
    "font": "Unbounded",
    "palette": ["#E6FFF7", "#B9F2E3", "#7AD8C8", "#4AA1A3", "#2A4B5D"],
}
NEW_DEFAULT = {
    "font": "Bricolage Grotesque",
    "palette": ["#FFF7E6", "#FFE3B3", "#FFC857", "#4BAA8B", "#1E3A34"],
}


def update_legacy_defaults(apps, schema_editor):
    """Bascule les comptes restés sur l'ancien défaut sans toucher aux thèmes personnalisés."""
    theme_preference = apps.get_model("identity", "ThemePreference")
    theme_preference.objects.using(schema_editor.connection.alias).filter(theme=LEGACY_DEFAULT).update(theme=NEW_DEFAULT)


class Migration(migrations.Migration):
    dependencies = [("identity", "0013_alter_accountactionrequest_user")]
    operations = [
        migrations.RunPython(update_legacy_defaults, migrations.RunPython.noop),
    ]

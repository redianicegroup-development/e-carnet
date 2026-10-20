from django.db import migrations, models


class Migration(migrations.Migration):
    """Logo de l'établissement et trace de son renommage. Ajouts seuls, avec valeurs par défaut : aucune donnée existante n'est touchée."""

    dependencies = [("establishments", "0008_prescriptiontemplate")]

    operations = [
        migrations.AddField(model_name="establishment", name="logo_url", field=models.URLField(blank=True, default="", max_length=500)),
        migrations.AddField(model_name="establishment", name="logo_data", field=models.TextField(blank=True, default="")),
        migrations.AddField(model_name="establishment", name="original_name", field=models.CharField(blank=True, default="", max_length=180)),
        migrations.AddField(model_name="establishment", name="name_updated_at", field=models.DateTimeField(blank=True, null=True)),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):
    """Cachet et signature de l'établissement figés sur chaque consultation à sa validation (vides pour l'existant)."""

    dependencies = [("care", "0033_guest_professional")]

    operations = [
        migrations.AddField(model_name="consultation", name="establishment_stamp_asset_id", field=models.CharField(blank=True, default="", max_length=500), preserve_default=False),
        migrations.AddField(model_name="consultation", name="establishment_signature_asset_id", field=models.CharField(blank=True, default="", max_length=500), preserve_default=False),
    ]

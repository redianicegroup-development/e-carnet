from django.db import migrations, models


class Migration(migrations.Migration):
    """Cachet et signature de l'établissement (scans privés), lus dans les consultations et les ordonnances."""

    dependencies = [("establishments", "0019_establishment_location")]

    operations = [
        migrations.AddField(model_name="establishment", name="stamp_cloudinary_public_id", field=models.CharField(blank=True, default="", max_length=500)),
        migrations.AddField(model_name="establishment", name="stamp_cloudinary_resource_type", field=models.CharField(blank=True, default="image", max_length=16)),
        migrations.AddField(model_name="establishment", name="stamp_cloudinary_version", field=models.PositiveBigIntegerField(blank=True, null=True)),
        migrations.AddField(model_name="establishment", name="signature_cloudinary_public_id", field=models.CharField(blank=True, default="", max_length=500)),
        migrations.AddField(model_name="establishment", name="signature_cloudinary_resource_type", field=models.CharField(blank=True, default="image", max_length=16)),
        migrations.AddField(model_name="establishment", name="signature_cloudinary_version", field=models.PositiveBigIntegerField(blank=True, null=True)),
    ]

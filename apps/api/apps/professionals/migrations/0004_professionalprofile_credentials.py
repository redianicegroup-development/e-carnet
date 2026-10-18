from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("professionals", "0003_remove_mfadevice")]

    operations = [
        migrations.AddField(model_name="professionalprofile", name="stamp_cloudinary_public_id", field=models.CharField(blank=True, max_length=500)),
        migrations.AddField(model_name="professionalprofile", name="stamp_cloudinary_resource_type", field=models.CharField(blank=True, default="image", max_length=16)),
        migrations.AddField(model_name="professionalprofile", name="stamp_cloudinary_version", field=models.PositiveBigIntegerField(blank=True, null=True)),
        migrations.AddField(model_name="professionalprofile", name="signature_cloudinary_public_id", field=models.CharField(blank=True, max_length=500)),
        migrations.AddField(model_name="professionalprofile", name="signature_cloudinary_resource_type", field=models.CharField(blank=True, default="image", max_length=16)),
        migrations.AddField(model_name="professionalprofile", name="signature_cloudinary_version", field=models.PositiveBigIntegerField(blank=True, null=True)),
    ]

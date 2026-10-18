from django.db import migrations, models
from apps.care.models import medical_document_upload_to


class Migration(migrations.Migration):
    dependencies = [("care", "0011_vaccination")]

    operations = [
        migrations.AlterField(
            model_name="medicaldocument",
            name="file",
            field=models.FileField(blank=True, null=True, upload_to=medical_document_upload_to),
        ),
        migrations.AddField(model_name="medicaldocument", name="cloudinary_public_id", field=models.CharField(blank=True, max_length=500)),
        migrations.AddField(model_name="medicaldocument", name="cloudinary_resource_type", field=models.CharField(blank=True, max_length=16)),
        migrations.AddField(model_name="medicaldocument", name="cloudinary_version", field=models.PositiveBigIntegerField(blank=True, null=True)),
    ]

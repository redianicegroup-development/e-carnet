from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("care", "0017_vaccination_professional_confirmation"),
    ]

    operations = [
        migrations.AddField(
            model_name="patientnotification",
            name="coalesce_key",
            field=models.CharField(blank=True, db_index=True, max_length=255, null=True),
        ),
    ]

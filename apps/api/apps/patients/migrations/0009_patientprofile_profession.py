from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("patients", "0008_declarations_city_and_emergency_contact"),
    ]

    operations = [
        migrations.AddField(
            model_name="patientprofile",
            name="profession",
            field=models.CharField(blank=True, max_length=120),
        ),
    ]

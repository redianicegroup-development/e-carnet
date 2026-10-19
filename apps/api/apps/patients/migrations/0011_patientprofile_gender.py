from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("patients", "0010_declaration_height_weight")]

    operations = [
        migrations.AddField(
            model_name="patientprofile",
            name="gender",
            field=models.CharField(blank=True, default="", choices=[("female", "Femme"), ("male", "Homme"), ("other", "Autre"), ("prefer_not_to_say", "Préfère ne pas préciser")], max_length=24),
        ),
    ]

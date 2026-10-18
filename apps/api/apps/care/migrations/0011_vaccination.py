from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [("care", "0010_medicaldocument")]

    operations = [
        migrations.CreateModel(
            name="Vaccination",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("vaccine_name", models.CharField(max_length=180)),
                ("dose_number", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("administered_on", models.DateField(blank=True, null=True)),
                ("batch_number", models.CharField(blank=True, max_length=100)),
                ("facility", models.CharField(blank=True, max_length=180)),
                ("professional", models.CharField(blank=True, max_length=180)),
                ("next_due_on", models.DateField(blank=True, null=True)),
                ("status", models.CharField(choices=[("declared", "Déclarée"), ("documented", "Documentée"), ("confirmed", "Confirmée par un professionnel")], default="declared", max_length=24)),
                ("notes", models.CharField(blank=True, max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("patient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="vaccinations", to="patients.patientprofile")),
            ],
            options={"ordering": ("-administered_on", "-created_at")},
        ),
    ]

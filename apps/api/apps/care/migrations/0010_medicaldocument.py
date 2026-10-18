from django.db import migrations, models
import django.db.models.deletion
import uuid
from apps.care.models import medical_document_upload_to


class Migration(migrations.Migration):
    dependencies = [("care", "0009_consultation_content_and_vitals")]

    operations = [
        migrations.CreateModel(
            name="MedicalDocument",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("file", models.FileField(upload_to=medical_document_upload_to)),
                ("original_name", models.CharField(max_length=180)),
                ("document_type", models.CharField(choices=[("prescription", "Ordonnance"), ("analysis", "Analyse"), ("imaging", "Imagerie"), ("certificate", "Certificat"), ("report", "Compte rendu"), ("other", "Autre")], default="other", max_length=24)),
                ("document_date", models.DateField(blank=True, null=True)),
                ("issuer", models.CharField(blank=True, max_length=180)),
                ("content_type", models.CharField(max_length=80)),
                ("size_bytes", models.PositiveIntegerField()),
                ("verified", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("patient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="medical_documents", to="patients.patientprofile")),
            ],
            options={"ordering": ("-created_at",)},
        ),
    ]

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("care", "0008_accessgrant_integrity_and_lifecycle"),
    ]

    operations = [
        migrations.AddField(
            model_name="careencounter",
            name="vitals",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="consultation",
            name="symptoms",
            field=models.TextField(blank=True, max_length=4000),
        ),
        migrations.AddField(
            model_name="consultation",
            name="clinical_exam",
            field=models.TextField(blank=True, max_length=4000),
        ),
        migrations.AddField(
            model_name="consultation",
            name="diagnosis",
            field=models.TextField(blank=True, max_length=2000),
        ),
        migrations.AddField(
            model_name="consultation",
            name="vitals",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.CreateModel(
            name="PrescriptionLine",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("position", models.PositiveSmallIntegerField(default=0)),
                ("drug_name", models.CharField(max_length=160)),
                ("dosage", models.CharField(blank=True, max_length=80)),
                ("posology", models.CharField(max_length=160)),
                ("duration", models.CharField(blank=True, max_length=80)),
                ("instructions", models.CharField(blank=True, max_length=240)),
                ("consultation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="prescription_lines", to="care.consultation")),
            ],
            options={"ordering": ("position",)},
        ),
        migrations.CreateModel(
            name="ExamRequest",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("position", models.PositiveSmallIntegerField(default=0)),
                ("kind", models.CharField(choices=[("analysis", "Analyse biologique"), ("imaging", "Imagerie"), ("other", "Autre examen")], max_length=16)),
                ("label", models.CharField(max_length=160)),
                ("status", models.CharField(choices=[("requested", "Demandé"), ("result_received", "Résultat reçu")], default="requested", max_length=16)),
                ("consultation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="exam_requests", to="care.consultation")),
            ],
            options={"ordering": ("position",)},
        ),
    ]

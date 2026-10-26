import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("care", "0018_patientnotification_coalesce_key"),
        ("establishments", "0002_initial"),
        ("professionals", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="healthmeasurement",
            name="establishment",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="health_measurements", to="establishments.establishment"),
        ),
        migrations.AddField(
            model_name="healthmeasurement",
            name="professional",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="health_measurements", to="professionals.professionalprofile"),
        ),
        migrations.AddField(
            model_name="healthmeasurement",
            name="validated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="medicaldocument",
            name="establishment",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="medical_documents", to="establishments.establishment"),
        ),
        migrations.AddField(
            model_name="medicaldocument",
            name="professional",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="medical_documents", to="professionals.professionalprofile"),
        ),
        migrations.AddField(
            model_name="medicaldocument",
            name="validated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="vaccination",
            name="establishment",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="vaccinations", to="establishments.establishment"),
        ),
        migrations.AddConstraint(
            model_name="healthmeasurement",
            constraint=models.CheckConstraint(
                condition=models.Q(establishment__isnull=True) | (models.Q(professional__isnull=False) & models.Q(validated_at__isnull=False)),
                name="care_hm_estab_validator_ck",
            ),
        ),
        migrations.AddConstraint(
            model_name="medicaldocument",
            constraint=models.CheckConstraint(
                condition=models.Q(establishment__isnull=True) | (models.Q(professional__isnull=False) & models.Q(validated_at__isnull=False)),
                name="care_md_estab_validator_ck",
            ),
        ),
    ]

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("care", "0016_unified_health_measurements")]

    operations = [
        migrations.AddField(
            model_name="vaccination",
            name="document",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="vaccination_records", to="care.medicaldocument"),
        ),
        migrations.AddField(
            model_name="vaccination",
            name="confirmed_by",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="confirmed_vaccinations", to="professionals.professionalprofile"),
        ),
        migrations.AddField(
            model_name="vaccination",
            name="confirmed_access_grant",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="confirmed_vaccinations", to="care.accessgrant"),
        ),
        migrations.AddField(
            model_name="vaccination",
            name="confirmed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

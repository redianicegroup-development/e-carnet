from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("patients", "0015_patientprofile_avatar")]
    operations = [
        migrations.AddField(model_name="patientrepresentation", name="deletion_reason", field=models.CharField(blank=True, max_length=24)),
        migrations.AddField(model_name="patientrepresentation", name="deletion_details", field=models.TextField(blank=True, max_length=1200)),
        migrations.AddField(model_name="patientrepresentation", name="deleted_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AlterField(
            model_name="patientrepresentation",
            name="status",
            field=models.CharField(choices=[("active", "Actif"), ("revoked", "Révoqué"), ("transferred", "Transféré au titulaire"), ("deleted", "Supprimé")], default="active", max_length=16),
        ),
    ]

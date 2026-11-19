from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("patients", "0014_clinicaldeclaration_event_date_more_kinds")]
    operations = [
        migrations.AddField(model_name="patientprofile", name="avatar_url", field=models.URLField(blank=True, max_length=500)),
        migrations.AddField(model_name="patientprofile", name="avatar_data", field=models.TextField(blank=True)),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("audit", "0003_auditevent_no_truncate"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="auditevent",
            index=models.Index(
                fields=["establishment", "patient", "event_type", "created_at"],
                name="aud_evt_est_pt_type_time_idx",
            ),
        ),
    ]

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("care", "0022_followupplan_status_history")]

    operations = [
        migrations.AddField(
            model_name="followupplan",
            name="access_grant",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="follow_up_plans", to="care.accessgrant"),
        ),
    ]

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [("care", "0021_pushsubscription_medicationreminderdispatch")]

    operations = [
        migrations.AddField(
            model_name="followupplan",
            name="objective",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="followupplan",
            name="status",
            field=models.CharField(choices=[("active", "Actif"), ("paused", "En pause"), ("completed", "Terminé"), ("cancelled", "Annulé")], default="active", max_length=16),
        ),
        migrations.CreateModel(
            name="FollowUpPlanRevision",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("action", models.CharField(max_length=24)),
                ("snapshot", models.JSONField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("changed_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="follow_up_plan_revisions", to="professionals.professionalprofile")),
                ("plan", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="revisions", to="care.followupplan")),
            ],
            options={"ordering": ("-created_at",)},
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):
    """PAT-14 : récurrence par jours de la semaine (liste vide = tous les jours)."""

    dependencies = [
        ("care", "0023_followupplan_access_grant"),
    ]

    operations = [
        migrations.AddField(
            model_name="medicationreminder",
            name="days_of_week",
            field=models.JSONField(blank=True, default=list),
        ),
    ]

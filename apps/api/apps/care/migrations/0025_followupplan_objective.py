from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("care", "0024_medicationreminder_days_of_week"),
    ]

    operations = [
        migrations.AlterField(
            model_name="followupplan",
            name="objective",
            field=models.CharField(blank=True, max_length=500),
        ),
    ]

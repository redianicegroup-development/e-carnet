from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("identity", "0014_set_default_theme_miel")]

    operations = [
        migrations.AddField(
            model_name="accountprofile",
            name="recovery_question",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="accountprofile",
            name="recovery_answer_hash",
            field=models.CharField(blank=True, max_length=256),
        ),
    ]

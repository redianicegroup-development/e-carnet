from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("identity", "0016_contactmessage")]

    operations = [
        migrations.AddField(
            model_name="accountprofile",
            name="recovery_failures",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="accountprofile",
            name="recovery_locked_until",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

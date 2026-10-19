from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("identity", "0017_accountprofile_recovery_lockout")]

    operations = [
        migrations.AddField(
            model_name="accountprofile",
            name="must_change_password",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="accountprofile",
            name="temporary_password_expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

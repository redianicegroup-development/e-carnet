from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("identity", "0006_accountprofile_public_id")]
    operations = [
        migrations.AddField(
            model_name="accountprofile",
            name="avatar_data",
            field=models.TextField(blank=True),
        ),
    ]

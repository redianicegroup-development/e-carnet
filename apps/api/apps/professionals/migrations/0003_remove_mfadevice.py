from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("professionals", "0002_professionalspecialty")]

    operations = [
        migrations.DeleteModel(name="MfaDevice"),
    ]

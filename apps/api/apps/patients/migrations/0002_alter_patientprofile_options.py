from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='patientprofile',
            options={'ordering': ('created_at',)},
        ),
    ]

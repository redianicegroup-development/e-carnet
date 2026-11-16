"""Note en étoiles pour « Noter l'application » : un retour peut porter une note de 1 à 5, avec ou sans message."""
import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("identity", "0020_monitoringwebhookevent")]
    operations = [
        migrations.AddField(
            model_name="sitefeedback",
            name="rating",
            field=models.PositiveSmallIntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)]),
        ),
        migrations.AlterField(model_name="sitefeedback", name="message", field=models.TextField(blank=True, default="", max_length=2000)),
    ]

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("establishments", "0016_establishmentnotification")]
    operations = [
        migrations.AddField(model_name="establishment", name="is_laboratory", field=models.BooleanField(default=False)),
        migrations.AddField(
            model_name="establishment",
            name="parent",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="laboratories", to="establishments.establishment"),
        ),
    ]

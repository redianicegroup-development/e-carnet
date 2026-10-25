from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("establishments", "0010_joincode_code_encrypted"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name="establishment",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "En attente"),
                    ("active", "Active"),
                    ("suspended", "Suspendue"),
                    ("rejected", "Refusée"),
                ],
                default="pending",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="establishment",
            name="suspended_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="establishment",
            name="suspended_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="suspended_establishments",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="establishment",
            name="suspension_reason",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
    ]

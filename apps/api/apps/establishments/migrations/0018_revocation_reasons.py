"""Révocation avec motif : un établissement retire un professionnel ou un administrateur de laboratoire en disant pourquoi.

Le motif est montré à la personne concernée à sa prochaine connexion (`*_notice_seen_at` vide tant qu'elle ne l'a pas lu)."""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("establishments", "0017_establishment_laboratory"),
    ]
    operations = [
        migrations.AddField(model_name="establishmentmembership", name="terminated_by_establishment", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="establishmentmembership", name="termination_reason", field=models.CharField(blank=True, default="", max_length=500)),
        migrations.AddField(model_name="establishmentmembership", name="termination_notice_seen_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="establishmentadministrator", name="end_reason", field=models.CharField(blank=True, default="", max_length=500)),
        migrations.AddField(
            model_name="establishmentadministrator",
            name="ended_by",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="ended_establishment_administrators", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(model_name="establishmentadministrator", name="end_notice_seen_at", field=models.DateTimeField(blank=True, null=True)),
    ]

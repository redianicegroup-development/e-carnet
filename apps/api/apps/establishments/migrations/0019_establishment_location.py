"""Établissements proches : position GPS confirmée une fois par l'établissement, choix de figurer dans la recherche des patients,
et historique des positions (qui, quand, ancienne et nouvelle position).

Aucune donnée existante n'est touchée : tous les champs sont vides / désactivés, donc aucun établissement n'apparaît dans la
recherche tant que son administrateur n'a pas posé l'épingle ET coché « Apparaître dans la recherche des patients »."""
import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("establishments", "0018_revocation_reasons"),
    ]
    operations = [
        migrations.AddField(model_name="establishment", name="latitude", field=models.FloatField(blank=True, null=True)),
        migrations.AddField(model_name="establishment", name="longitude", field=models.FloatField(blank=True, null=True)),
        migrations.AddField(model_name="establishment", name="location_confirmed_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="establishment", name="is_listed_in_directory", field=models.BooleanField(default=False)),
        migrations.CreateModel(
            name="EstablishmentLocationChange",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("previous_latitude", models.FloatField(blank=True, null=True)),
                ("previous_longitude", models.FloatField(blank=True, null=True)),
                ("latitude", models.FloatField(blank=True, null=True)),
                ("longitude", models.FloatField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("changed_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="establishment_location_changes", to=settings.AUTH_USER_MODEL)),
                ("establishment", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="location_changes", to="establishments.establishment")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddIndex(
            model_name="establishmentlocationchange",
            index=models.Index(fields=["establishment", "created_at"], name="estab_locchange_idx"),
        ),
    ]

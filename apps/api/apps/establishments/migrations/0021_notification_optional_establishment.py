import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """Les notifications de l'équipe (retour utilisateur, demande de suspension) ne concernent aucune structure : `establishment` devient facultatif.
    Aucune donnée touchée (la colonne accepte seulement NULL en plus)."""

    dependencies = [("establishments", "0020_establishment_stamp_signature")]

    operations = [
        migrations.AlterField(
            model_name="establishmentnotification",
            name="establishment",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to="establishments.establishment"),
        ),
    ]

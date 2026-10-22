from django.db import migrations, models


class Migration(migrations.Migration):
    """Copie chiffrée (temporaire) du code médecin pour l'afficher 48 h. Ajout seul, valeur par défaut vide : aucune donnée existante n'est touchée."""

    dependencies = [("establishments", "0009_establishment_logo_and_rename_trace")]

    operations = [
        migrations.AddField(model_name="establishmentjoincode", name="code_encrypted", field=models.TextField(blank=True, default="")),
    ]

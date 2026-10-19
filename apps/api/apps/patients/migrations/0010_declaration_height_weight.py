from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("patients", "0009_patientprofile_profession")]

    operations = [
        migrations.AlterField(
            model_name="clinicaldeclaration",
            name="kind",
            field=models.CharField(
                choices=[
                    ("antecedent", "Antécédent"), ("allergy", "Allergie"),
                    ("treatment", "Traitement"), ("blood_group", "Groupe sanguin"),
                    ("city", "Ville"), ("emergency_contact", "Contact d’urgence"),
                    ("height", "Taille"), ("weight", "Poids"),
                ],
                max_length=24,
            ),
        ),
    ]

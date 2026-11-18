from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("patients", "0013_patientaccesssummarypreference")]
    operations = [
        migrations.AddField(model_name="clinicaldeclaration", name="event_date", field=models.DateField(blank=True, null=True)),
        migrations.AlterField(
            model_name="clinicaldeclaration", name="kind",
            field=models.CharField(choices=[("antecedent", "Antécédent"), ("allergy", "Allergie"), ("treatment", "Traitement"), ("blood_group", "Groupe sanguin"), ("city", "Ville"), ("emergency_contact", "Contact d’urgence"), ("height", "Taille"), ("weight", "Poids"), ("surgery", "Intervention chirurgicale"), ("implant", "Implant ou dispositif médical"), ("other_medical", "Autre information médicale")], max_length=24),
        ),
    ]

from django.db import migrations, models


def copy_card_details_to_declarations(apps, schema_editor):
    """Ville et contact d’urgence passent de la carte au carnet : on recopie l’existant, sans rien effacer de la carte."""
    Card = apps.get_model("patients", "PatientEmergencyCard")
    Declaration = apps.get_model("patients", "ClinicalDeclaration")
    for card in Card.objects.all().iterator():
        city = (card.city or "").strip()
        if city:
            Declaration.objects.get_or_create(patient_id=card.patient_id, kind="city", label=city[:120], defaults={"details": "", "status": "declared"})
        name = (card.contact_name or "").strip()
        phone = (card.contact_phone or "").strip()
        if name or phone:
            Declaration.objects.get_or_create(
                patient_id=card.patient_id, kind="emergency_contact", label=(name or "Contact d’urgence")[:120],
                defaults={"details": phone[:32], "status": "declared"},
            )


class Migration(migrations.Migration):

    dependencies = [
        ("patients", "0007_patientemergencycard_city"),
    ]

    operations = [
        migrations.AlterField(
            model_name="clinicaldeclaration",
            name="kind",
            field=models.CharField(choices=[("antecedent", "Antécédent"), ("allergy", "Allergie"), ("treatment", "Traitement"), ("blood_group", "Groupe sanguin"), ("city", "Ville"), ("emergency_contact", "Contact d’urgence")], max_length=24),
        ),
        migrations.RunPython(copy_card_details_to_declarations, migrations.RunPython.noop),
    ]

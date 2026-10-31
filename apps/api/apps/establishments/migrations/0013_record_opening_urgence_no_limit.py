from django.db import migrations, models

REASONS = ("urgence", "soins_en_cours", "continuite_soins", "demande_patient", "facturation_assurance", "qualite_audit", "reclamation", "autre")


class Migration(migrations.Migration):
    """ETA-09 : motif « Urgence » et ouverture sans limite de durée (expires_at vide) tant que le motif est enregistré."""

    dependencies = [
        ("establishments", "0012_establishment_record_opening"),
    ]

    operations = [
        migrations.RemoveConstraint(model_name="establishmentrecordopening", name="est_rec_reason_category_ck"),
        migrations.AlterField(
            model_name="establishmentrecordopening",
            name="reason_category",
            field=models.CharField(choices=[("urgence", "Urgence"), ("soins_en_cours", "Soins en cours"), ("continuite_soins", "Continuité des soins"), ("demande_patient", "Demande du patient"), ("facturation_assurance", "Facturation / assurance"), ("qualite_audit", "Qualité / audit"), ("reclamation", "Réclamation"), ("autre", "Autre")], max_length=32),
        ),
        migrations.AlterField(
            model_name="establishmentrecordopening",
            name="expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddConstraint(
            model_name="establishmentrecordopening",
            constraint=models.CheckConstraint(condition=models.Q(reason_category__in=REASONS), name="est_rec_reason_category_ck"),
        ),
    ]

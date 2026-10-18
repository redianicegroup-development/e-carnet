from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("care", "0014_appointment_preconsultationtemplate")]

    operations = [
        migrations.AddField(
            model_name="medicaldocument",
            name="exam_request",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="result_documents", to="care.examrequest"),
        ),
        migrations.AlterField(
            model_name="medicaldocument",
            name="document_type",
            field=models.CharField(choices=[("prescription", "Ordonnance"), ("analysis", "Analyse"), ("imaging", "Imagerie"), ("certificate", "Certificat"), ("report", "Compte rendu"), ("other", "Autre"), ("vaccination", "Carnet de vaccination")], default="other", max_length=24),
        ),
    ]

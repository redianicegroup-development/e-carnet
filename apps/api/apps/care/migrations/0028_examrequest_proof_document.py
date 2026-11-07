from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("care", "0027_appointment_workflow")]
    operations = [
        migrations.AddField(
            model_name="examrequest",
            name="proof_document",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="exam_request_proofs", to="care.medicaldocument"),
        ),
    ]

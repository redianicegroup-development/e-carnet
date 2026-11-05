from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [("care", "0026_alter_preconsultationtemplate_options_and_more")]
    operations = [
        migrations.AddField(model_name="appointment", name="proposed_starts_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="appointment", name="proposed_ends_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="appointment", name="change_reason", field=models.CharField(blank=True, max_length=500)),
        migrations.AddIndex(model_name="appointment", index=models.Index(fields=["professional", "starts_at"], name="care_appoin_profess_cc36d7_idx")),
        migrations.CreateModel(name="AppointmentReminderDispatch", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("kind", models.CharField(max_length=24)),
            ("sent_at", models.DateTimeField(auto_now_add=True)),
            ("appointment", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reminder_dispatches", to="care.appointment")),
        ], options={"constraints": [models.UniqueConstraint(fields=("appointment", "kind"), name="unique_appointment_reminder_kind")]})
    ]

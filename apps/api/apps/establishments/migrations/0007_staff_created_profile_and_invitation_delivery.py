from django.db import migrations, models


def mark_existing_data(apps, schema_editor):
    """Les structures déjà créées avec une fiche complète restent utilisables ; les invitations existantes sont réputées envoyées."""
    Establishment = apps.get_model("establishments", "Establishment")
    Invitation = apps.get_model("establishments", "EstablishmentAdminInvitation")
    for establishment in Establishment.objects.filter(status="active", profile_completed_at__isnull=True):
        if all(getattr(establishment, field) for field in ("establishment_type", "city", "address", "phone", "email")):
            establishment.profile_completed_at = establishment.activated_at or establishment.created_at
            establishment.save(update_fields=("profile_completed_at",))
    for invitation in Invitation.objects.filter(email_sent_at__isnull=True):
        invitation.email_sent_at = invitation.created_at
        invitation.save(update_fields=("email_sent_at",))


class Migration(migrations.Migration):
    dependencies = [("establishments", "0006_establishmentmembership_agreement_accepted_at_and_more")]

    operations = [
        migrations.AlterField(model_name="establishment", name="establishment_type", field=models.CharField(blank=True, default="", max_length=100)),
        migrations.AlterField(model_name="establishment", name="city", field=models.CharField(blank=True, default="", max_length=120)),
        migrations.AlterField(model_name="establishment", name="address", field=models.CharField(blank=True, default="", max_length=240)),
        migrations.AlterField(model_name="establishment", name="phone", field=models.CharField(blank=True, default="", max_length=32)),
        migrations.AlterField(model_name="establishment", name="email", field=models.EmailField(blank=True, default="", max_length=254)),
        migrations.AlterField(model_name="establishment", name="responsible_name", field=models.CharField(blank=True, default="", max_length=160)),
        migrations.AddField(model_name="establishment", name="profile_completed_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AlterField(model_name="establishmentadmininvitation", name="first_name", field=models.CharField(blank=True, default="", max_length=120)),
        migrations.AlterField(model_name="establishmentadmininvitation", name="last_name", field=models.CharField(blank=True, default="", max_length=120)),
        migrations.AddField(model_name="establishmentadmininvitation", name="email_sent_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="establishmentadmininvitation", name="email_error", field=models.CharField(blank=True, default="", max_length=40)),
        migrations.RunPython(mark_existing_data, migrations.RunPython.noop),
    ]

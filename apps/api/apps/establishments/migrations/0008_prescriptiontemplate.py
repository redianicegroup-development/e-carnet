from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("establishments", "0007_staff_created_profile_and_invitation_delivery")]

    operations = [
        migrations.CreateModel(
            name="PrescriptionTemplate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("logo_url", models.URLField(blank=True, max_length=500)),
                ("header_text", models.CharField(blank=True, max_length=500)),
                ("footer_text", models.CharField(blank=True, max_length=500)),
                ("phone", models.CharField(blank=True, max_length=32)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("address", models.CharField(blank=True, max_length=240)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("establishment", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="prescription_template", to="establishments.establishment")),
            ],
            options={"ordering": ("establishment",)},
        ),
    ]

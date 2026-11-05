import django.utils.timezone
import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [
        ("establishments", "0013_record_opening_urgence_no_limit"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.CreateModel(
            name="EstablishmentRecordOpeningClosure",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("closed_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("note", models.CharField(blank=True, default="", max_length=140)),
                ("closed_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="establishment_record_opening_closures", to=settings.AUTH_USER_MODEL)),
                ("opening", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="closure", to="establishments.establishmentrecordopening")),
            ],
            options={"ordering": ("-closed_at",)},
        ),
    ]

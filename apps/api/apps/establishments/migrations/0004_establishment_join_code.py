from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("establishments", "0003_private_establishment_admin_invitations"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="EstablishmentJoinCode",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("code_hash", models.CharField(max_length=64, unique=True)),
                ("expires_at", models.DateTimeField()),
                ("consumed_at", models.DateTimeField(blank=True, null=True)),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_establishment_join_codes", to=settings.AUTH_USER_MODEL)),
                ("establishment", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="join_codes", to="establishments.establishment")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddIndex(
            model_name="establishmentjoincode",
            index=models.Index(fields=("establishment", "expires_at"), name="establishme_establi_940bde_idx"),
        ),
    ]

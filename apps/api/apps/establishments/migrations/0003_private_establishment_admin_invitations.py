from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("establishments", "0002_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name="establishment",
            name="created_by",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="created_establishments", to=settings.AUTH_USER_MODEL),
        ),
        migrations.CreateModel(
            name="EstablishmentAdministrator",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("status", models.CharField(choices=[("active", "Actif"), ("revoked", "Révoqué"), ("ended", "Terminé")], default="active", max_length=16)),
                ("started_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("assigned_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="assigned_establishment_administrators", to=settings.AUTH_USER_MODEL)),
                ("establishment", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="administrator_history", to="establishments.establishment")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="establishment_administrator_roles", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-started_at",)},
        ),
        migrations.AddConstraint(
            model_name="establishmentadministrator",
            constraint=models.UniqueConstraint(fields=("establishment", "user", "started_at"), name="unique_establishment_admin_assignment"),
        ),
        migrations.AddIndex(model_name="establishmentadministrator", index=models.Index(fields=("establishment", "status"), name="establishme_establi_985c14_idx")),
        migrations.AddIndex(model_name="establishmentadministrator", index=models.Index(fields=("user", "status"), name="establishme_user_id_0082b5_idx")),
        migrations.CreateModel(
            name="EstablishmentAdminInvitation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("email", models.EmailField(max_length=254)),
                ("first_name", models.CharField(max_length=120)),
                ("last_name", models.CharField(max_length=120)),
                ("token_hash", models.CharField(max_length=64, unique=True)),
                ("expires_at", models.DateTimeField()),
                ("consumed_at", models.DateTimeField(blank=True, null=True)),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("consumed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="consumed_establishment_invitations", to=settings.AUTH_USER_MODEL)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_establishment_invitations", to=settings.AUTH_USER_MODEL)),
                ("establishment", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="admin_invitations", to="establishments.establishment")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddIndex(model_name="establishmentadmininvitation", index=models.Index(fields=("establishment", "email", "created_at"), name="establishme_establi_9ba811_idx")),
    ]

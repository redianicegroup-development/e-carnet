import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [("patients", "0014_clinicaldeclaration_event_date_more_kinds"), ("establishments", "0017_establishment_laboratory"), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="DeclarationAttachment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("original_name", models.CharField(max_length=180)),
                ("content_type", models.CharField(max_length=120)),
                ("size_bytes", models.PositiveIntegerField()),
                ("sha256", models.CharField(max_length=64)),
                ("data", models.BinaryField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("declaration", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attachments", to="patients.clinicaldeclaration")),
            ],
            options={"ordering": ("created_at",)},
        ),
        migrations.CreateModel(
            name="DeclarationShare",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("status", models.CharField(choices=[("pending", "À attester"), ("info_requested", "Informations demandées"), ("attested", "Attestée"), ("revoked", "Retirée par le patient")], default="pending", max_length=16)),
                ("info_message", models.CharField(blank=True, default="", max_length=300)),
                ("error_message", models.CharField(blank=True, default="", max_length=300)),
                ("error_reported_at", models.DateTimeField(blank=True, null=True)),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("declaration", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="shares", to="patients.clinicaldeclaration")),
                ("establishment", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="declaration_shares", to="establishments.establishment")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddConstraint(model_name="declarationshare", constraint=models.UniqueConstraint(condition=models.Q(("status", "revoked"), _negated=True), fields=("declaration", "establishment"), name="unique_active_declaration_share")),
        migrations.CreateModel(
            name="DeclarationAttestation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("professional_name", models.CharField(max_length=160)),
                ("professional_title", models.CharField(max_length=80)),
                ("professional_specialty", models.CharField(blank=True, default="", max_length=120)),
                ("professional_identifier", models.CharField(blank=True, default="", max_length=120)),
                ("signature_fingerprint", models.CharField(blank=True, default="", max_length=64)),
                ("snapshot", models.JSONField()),
                ("attested_at", models.DateTimeField(auto_now_add=True)),
                ("professional", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("share", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="attestation", to="attestations.declarationshare")),
            ],
        ),
        migrations.CreateModel(
            name="AttestationEvent",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("kind", models.CharField(max_length=24)),
                ("actor_label", models.CharField(blank=True, default="", max_length=160)),
                ("detail", models.CharField(blank=True, default="", max_length=300)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("declaration", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attestation_events", to="patients.clinicaldeclaration")),
            ],
            options={"ordering": ("-created_at",)},
        ),
    ]

from datetime import timedelta

from django.db import migrations, models
from django.db.models import Count, Q
from django.utils import timezone


def validate_and_backfill_grants(apps, schema_editor):
    AccessGrant = apps.get_model("care", "AccessGrant")
    database = schema_editor.connection.alias
    grants = AccessGrant.objects.using(database)
    missing_targets = grants.filter(
        Q(professional__isnull=True) | Q(establishment__isnull=True)
    )
    if missing_targets.exists():
        raise RuntimeError(
            "Cannot enforce AccessGrant target constraints: rows with missing professional or establishment exist. "
            "Resolve these records before migrating."
        )
    cutoff = timezone.now()
    for grant in grants.filter(status="pending").iterator():
        expires_at = grant.requested_at + timedelta(days=7)
        grant.expires_at = expires_at
        if expires_at <= cutoff:
            grant.status = "expired"
        grant.save(update_fields=("expires_at", "status"))
    grants.filter(status="active", expires_at__isnull=True).update(status="expired")
    duplicate_targets = (
        grants.filter(status__in=("pending", "active"))
        .values("patient_id", "professional_id", "establishment_id")
        .annotate(total=Count("id"))
        .filter(total__gt=1)
    )
    if duplicate_targets.exists():
        raise RuntimeError(
            "Cannot enforce AccessGrant uniqueness: duplicate pending/active grants exist. "
            "Resolve these records before migrating."
        )
    grants.filter(status="refused", refused_at__isnull=True).update(refused_at=cutoff)


class Migration(migrations.Migration):
    dependencies = [
        ("care", "0007_careencounter_establishment"),
        ("establishments", "0006_establishmentmembership_agreement_accepted_at_and_more"),
        ("professionals", "0002_professionalspecialty"),
    ]

    operations = [
        migrations.AddField(
            model_name="accessgrant",
            name="refused_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(validate_and_backfill_grants, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="accessgrant",
            name="professional",
            field=models.ForeignKey(
                on_delete=models.PROTECT,
                related_name="access_grants",
                to="professionals.professionalprofile",
            ),
        ),
        migrations.AlterField(
            model_name="accessgrant",
            name="establishment",
            field=models.ForeignKey(
                on_delete=models.PROTECT,
                related_name="access_grants",
                to="establishments.establishment",
            ),
        ),
        migrations.AddConstraint(
            model_name="accessgrant",
            constraint=models.UniqueConstraint(
                condition=Q(status__in=("pending", "active")),
                fields=("patient", "professional", "establishment"),
                name="unique_open_access_grant_target",
            ),
        ),
        migrations.AddConstraint(
            model_name="accessgrant",
            constraint=models.CheckConstraint(
                condition=~Q(status__in=("pending", "active"), expires_at__isnull=True),
                name="open_access_grant_has_expiry",
            ),
        ),
    ]

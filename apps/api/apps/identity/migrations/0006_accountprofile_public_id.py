import uuid

from django.db import migrations, models


def create_profiles_for_existing_accounts(apps, schema_editor):
    AccountProfile = apps.get_model("identity", "AccountProfile")
    User = apps.get_model("auth", "User")
    database = schema_editor.connection.alias
    profiles = AccountProfile.objects.using(database)
    for profile in profiles.filter(public_id__isnull=True).iterator():
        profiles.filter(pk=profile.pk).update(public_id=uuid.uuid4())
    for user_id in (
        User.objects.using(database)
        .exclude(account_profile__isnull=False)
        .values_list("pk", flat=True)
        .iterator()
    ):
        AccountProfile.objects.using(database).create(user_id=user_id)


class Migration(migrations.Migration):
    dependencies = [
        ("identity", "0005_accountprofile"),
        migrations.swappable_dependency("auth.User"),
    ]

    operations = [
        migrations.AddField(
            model_name="accountprofile",
            name="public_id",
            field=models.UUIDField(null=True, editable=False),
        ),
        migrations.RunPython(create_profiles_for_existing_accounts, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="accountprofile",
            name="public_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]

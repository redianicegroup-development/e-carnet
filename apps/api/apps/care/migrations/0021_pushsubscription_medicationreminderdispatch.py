import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("care", "0020_accessgrant_source_establishments"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PushSubscription",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("endpoint", models.URLField(max_length=600, unique=True)),
                ("p256dh", models.CharField(max_length=200)),
                ("auth", models.CharField(max_length=100)),
                ("user_agent", models.CharField(blank=True, max_length=300)),
                ("active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="push_subscriptions", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "indexes": [models.Index(fields=["user", "active"], name="care_push_user_active_idx")],
            },
        ),
        migrations.CreateModel(
            name="MedicationReminderDispatch",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("scheduled_for", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("reminder", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="dispatches", to="care.medicationreminder")),
            ],
            options={
                "indexes": [models.Index(fields=["scheduled_for"], name="care_dispatch_slot_idx")],
                "constraints": [models.UniqueConstraint(fields=("reminder", "scheduled_for"), name="unique_medication_dispatch_slot")],
            },
        ),
    ]

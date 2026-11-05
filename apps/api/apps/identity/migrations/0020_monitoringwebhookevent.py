import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("identity", "0019_operationalincident"),
    ]

    operations = [
        migrations.CreateModel(
            name="MonitoringWebhookEvent",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("event_id", models.UUIDField(db_index=True, unique=True, editable=False)),
                ("received_at", models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                "ordering": ("-received_at",),
                "verbose_name": "événement de webhook de monitoring",
                "verbose_name_plural": "événements de webhook de monitoring",
            },
        ),
    ]

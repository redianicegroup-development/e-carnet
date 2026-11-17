import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="AdBanner",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("alt_text", models.CharField(max_length=200)),
                ("link_url", models.URLField(blank=True, default="", max_length=500)),
                ("starts_at", models.DateTimeField()),
                ("ends_at", models.DateTimeField()),
                ("withdrawn_at", models.DateTimeField(blank=True, null=True)),
                ("image_desktop", models.BinaryField()),
                ("image_mobile", models.BinaryField()),
                ("focus_x", models.FloatField(default=0.5)),
                ("focus_y", models.FloatField(default=0.5)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="ad_banners", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-starts_at",)},
        ),
        migrations.AddConstraint(model_name="adbanner", constraint=models.CheckConstraint(condition=models.Q(("ends_at__gt", models.F("starts_at"))), name="ad_banner_ends_after_start")),
        migrations.CreateModel(
            name="AdBannerDailyStat",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("day", models.DateField()),
                ("impressions", models.PositiveIntegerField(default=0)),
                ("clicks", models.PositiveIntegerField(default=0)),
                ("banner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="daily_stats", to="advertising.adbanner")),
            ],
        ),
        migrations.AddConstraint(model_name="adbannerdailystat", constraint=models.UniqueConstraint(fields=("banner", "day"), name="unique_ad_banner_day")),
    ]

import uuid

from django.conf import settings
from django.db import models
from django.db.models import F, Q


class AdBanner(models.Model):
    """Bannière « Sponsorisé » : une image source, deux variantes générées (ordinateur et mobile), une période de publication.

    Les images sont de petits WebP stockés en base (≤ 200 Ko chacune) : aucun fichier, donc aucun lien public. Aucune donnée de santé,
    aucun identifiant de patient : seuls des compteurs journaliers agrégés (AdBannerDailyStat) existent."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    alt_text = models.CharField(max_length=200)
    link_url = models.URLField(max_length=500, blank=True, default="")
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    withdrawn_at = models.DateTimeField(null=True, blank=True)
    image_desktop = models.BinaryField()
    image_mobile = models.BinaryField()
    focus_x = models.FloatField(default=0.5)
    focus_y = models.FloatField(default=0.5)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="ad_banners")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-starts_at",)
        constraints = [models.CheckConstraint(condition=Q(ends_at__gt=F("starts_at")), name="ad_banner_ends_after_start")]

    def state(self, now):
        if self.withdrawn_at:
            return "withdrawn"
        if now < self.starts_at:
            return "scheduled"
        if now >= self.ends_at:
            return "ended"
        return "live"


class AdBannerDailyStat(models.Model):
    """Compteurs agrégés par bannière et par jour. Aucun utilisateur, aucun appareil, aucune donnée de santé."""

    banner = models.ForeignKey(AdBanner, on_delete=models.CASCADE, related_name="daily_stats")
    day = models.DateField()
    impressions = models.PositiveIntegerField(default=0)
    clicks = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("banner", "day"), name="unique_ad_banner_day")]

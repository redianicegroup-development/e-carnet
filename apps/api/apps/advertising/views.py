import os

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from django.db.models import F, Sum
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event
from apps.identity.admin_views import IsSuperuserOnly
from apps.patients.models import PatientProfile

from .images import BannerImageError, build_variants
from .models import AdBanner, AdBannerDailyStat

BASE = "/api/v1/advertising/banners"
HEAVY = ("image_desktop", "image_mobile")


def ads_enabled():
    """Diffusion publique : fermée par défaut. La fonction est préparée, son activation reste une décision produit, juridique et confidentialité."""
    value = getattr(settings, "ADS_ENABLED", None)
    if value is None:
        value = os.environ.get("ADS_ENABLED", "")
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def is_patient(user):
    return PatientProfile.objects.filter(user=user).exists()


def fail(message, status=400):
    return Response({"success": False, "message": message}, status=status)


def parse_when(raw):
    value = parse_datetime(str(raw or ""))
    if value is not None and timezone.is_naive(value):
        value = timezone.make_aware(value)
    return value


def bump(banner, field):
    stat, _ = AdBannerDailyStat.objects.get_or_create(banner=banner, day=timezone.localdate())
    AdBannerDailyStat.objects.filter(pk=stat.pk).update(**{field: F(field) + 1})


def admin_row(banner, now, totals):
    impressions, clicks = totals.get(banner.id, (0, 0))
    return {
        "id": str(banner.id), "alt_text": banner.alt_text, "link_url": banner.link_url,
        "starts_at": banner.starts_at, "ends_at": banner.ends_at, "withdrawn_at": banner.withdrawn_at,
        "state": banner.state(now), "impressions": impressions, "clicks": clicks,
        "desktop_url": f"{BASE}/{banner.id}/image/desktop/", "mobile_url": f"{BASE}/{banner.id}/image/mobile/",
    }


def _float(raw, default=0.5):
    try:
        return min(1.0, max(0.0, float(raw)))
    except (TypeError, ValueError):
        return default


class AdminBannerListCreateView(APIView):
    """Console d'administration → Bannières. Un seul upload, deux variantes générées, une période, un bouton « Publier »."""
    permission_classes = [IsAuthenticated, IsSuperuserOnly]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        now = timezone.now()
        banners = list(AdBanner.objects.defer(*HEAVY)[:100])
        totals = {row["banner_id"]: (row["i"] or 0, row["c"] or 0) for row in AdBannerDailyStat.objects.filter(banner__in=banners).values("banner_id").annotate(i=Sum("impressions"), c=Sum("clicks"))}
        return Response({"success": True, "data": {"ads_enabled": ads_enabled(), "items": [admin_row(banner, now, totals) for banner in banners]}})

    def post(self, request):
        upload = request.FILES.get("image")
        if upload is None:
            return fail("Importez l’image de la bannière.")
        alt_text = str(request.data.get("alt_text", "")).strip()
        if len(alt_text) < 3 or len(alt_text) > 200:
            return fail("Décrivez l’image en quelques mots (3 à 200 caractères) : ce texte est lu par les lecteurs d’écran.")
        link_url = str(request.data.get("link_url", "")).strip()
        if link_url:
            try:
                URLValidator(schemes=["https"])(link_url)
            except DjangoValidationError:
                return fail("Le lien doit être une adresse https:// valide, ou rester vide.")
        starts_at, ends_at = parse_when(request.data.get("starts_at")), parse_when(request.data.get("ends_at"))
        if starts_at is None or ends_at is None:
            return fail("Choisissez une date de début et une date de fin.")
        if ends_at <= starts_at:
            return fail("La date de fin doit suivre la date de début.")
        if ends_at <= timezone.now():
            return fail("La date de fin est déjà passée.")
        focus_x, focus_y = _float(request.data.get("focus_x")), _float(request.data.get("focus_y"))
        try:
            variants = build_variants(upload.read(), focus_x, focus_y)
        except BannerImageError as error:
            return fail(str(error))
        banner = AdBanner.objects.create(alt_text=alt_text, link_url=link_url, starts_at=starts_at, ends_at=ends_at, image_desktop=variants["desktop"], image_mobile=variants["mobile"], focus_x=focus_x, focus_y=focus_y, created_by=request.user)
        record_event(event_type="advertising.banner_published", actor=request.user, actor_role="ecarnet_staff", metadata={"resource_type": "ad_banner", "resource_id": str(banner.id)})
        overlaps = AdBanner.objects.filter(withdrawn_at__isnull=True, starts_at__lt=ends_at, ends_at__gt=starts_at).exclude(pk=banner.pk).count()
        data = admin_row(banner, timezone.now(), {})
        data["overlaps"] = overlaps  # plusieurs bannières à la même période : la plus récemment programmée s'affiche.
        return Response({"success": True, "data": data}, status=201)


class AdminBannerWithdrawView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuserOnly]

    def post(self, request, banner_id):
        banner = AdBanner.objects.defer(*HEAVY).filter(pk=banner_id).first()
        if banner is None:
            return fail("Bannière introuvable.", 404)
        if banner.withdrawn_at is None:
            banner.withdrawn_at = timezone.now()
            banner.save(update_fields=["withdrawn_at"])
            record_event(event_type="advertising.banner_withdrawn", actor=request.user, actor_role="ecarnet_staff", metadata={"resource_type": "ad_banner", "resource_id": str(banner.id)})
        return Response({"success": True, "data": admin_row(banner, timezone.now(), {})})


class PatientBannerView(APIView):
    """Bannière en cours, pour l'accueil patient uniquement. Aucun ciblage : tous les patients voient la même."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not ads_enabled() or not is_patient(request.user):
            return Response({"success": True, "data": None})
        now = timezone.now()
        banner = AdBanner.objects.defer(*HEAVY).filter(withdrawn_at__isnull=True, starts_at__lte=now, ends_at__gt=now).order_by("-starts_at", "-created_at").first()
        if banner is None:
            return Response({"success": True, "data": None})
        bump(banner, "impressions")
        return Response({"success": True, "data": {"id": str(banner.id), "alt_text": banner.alt_text, "link_url": banner.link_url, "label": "Sponsorisé", "desktop_url": f"{BASE}/{banner.id}/image/desktop/", "mobile_url": f"{BASE}/{banner.id}/image/mobile/"}})


class BannerClickView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, banner_id):
        now = timezone.now()
        banner = AdBanner.objects.defer(*HEAVY).filter(pk=banner_id, withdrawn_at__isnull=True, starts_at__lte=now, ends_at__gt=now).first()
        if banner is None or not ads_enabled() or not is_patient(request.user):
            return fail("Bannière indisponible.", 404)
        bump(banner, "clicks")
        return Response({"success": True})


class BannerImageView(APIView):
    """Image d'une bannière : visible de l'administrateur, et du patient seulement pendant la publication."""
    permission_classes = [IsAuthenticated]

    def get(self, request, banner_id, variant):
        if variant not in ("desktop", "mobile"):
            return fail("Image introuvable.", 404)
        banner = AdBanner.objects.defer(*[name for name in HEAVY if name != f"image_{variant}"]).filter(pk=banner_id).first()
        if banner is None:
            return fail("Image introuvable.", 404)
        allowed = request.user.is_superuser or (banner.state(timezone.now()) == "live" and ads_enabled() and is_patient(request.user))
        if not allowed:
            return fail("Image introuvable.", 404)
        response = HttpResponse(bytes(getattr(banner, f"image_{variant}")), content_type="image/webp")
        response["Cache-Control"] = "private, max-age=300"
        response["X-Content-Type-Options"] = "nosniff"
        return response

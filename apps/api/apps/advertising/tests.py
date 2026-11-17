from datetime import timedelta
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.patients.models import PatientProfile

from .images import BannerImageError, build_variants
from .models import AdBanner, AdBannerDailyStat

User = get_user_model()
LIST = "/api/v1/advertising/admin/banners/"
CURRENT = "/api/v1/advertising/banner/"


def png(width=3000, height=1000, color=(40, 120, 100)):
    buffer = BytesIO()
    Image.new("RGB", (width, height), color).save(buffer, "PNG")
    return buffer.getvalue()


class BannerImageTests(TestCase):
    def test_ratio_is_3_to_1_for_both_variants_whatever_the_source(self):
        for size in ((3000, 1000), (2400, 1800), (1200, 1200 * 2)):
            variants = build_variants(png(*size))
            self.assertEqual(Image.open(BytesIO(variants["desktop"])).size, (1500, 500))
            self.assertEqual(Image.open(BytesIO(variants["mobile"])).size, (750, 250))
            self.assertLessEqual(len(variants["desktop"]), 200 * 1024)

    def test_rejects_small_unreadable_and_oversized_files(self):
        with self.assertRaises(BannerImageError):
            build_variants(png(900, 300))
        with self.assertRaises(BannerImageError):
            build_variants(b"not an image")
        with self.assertRaises(BannerImageError):
            build_variants(b"x" * (5 * 1024 * 1024 + 1))


class BannerApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username="root@example.test", email="root@example.test", password="pw-root-12345", is_superuser=True, is_staff=True)
        self.patient_user = User.objects.create_user(username="pat@example.test", email="pat@example.test", password="pw-pat-12345")
        PatientProfile.objects.create(user=self.patient_user, first_name="Awa", last_name="Test")
        self.pro_user = User.objects.create_user(username="pro@example.test", email="pro@example.test", password="pw-pro-12345")

    def payload(self, **extra):
        now = timezone.now()
        data = {"image": SimpleUploadedFile("b.png", png(), content_type="image/png"), "alt_text": "Campagne de vaccination", "starts_at": (now - timedelta(hours=1)).isoformat(), "ends_at": (now + timedelta(days=7)).isoformat()}
        data.update(extra)
        return data

    def publish(self, **extra):
        self.client.force_authenticate(self.admin)
        return self.client.post(LIST, self.payload(**extra), format="multipart")

    def test_only_superuser_manages_banners(self):
        self.client.force_authenticate(self.patient_user)
        self.assertEqual(self.client.get(LIST).status_code, 403)
        self.assertEqual(self.client.post(LIST, self.payload(), format="multipart").status_code, 403)

    def test_publish_validates_alt_text_link_and_dates(self):
        self.assertEqual(self.publish(alt_text="").status_code, 400)
        self.assertEqual(self.publish(link_url="http://exemple.test").status_code, 400)
        self.assertEqual(self.publish(link_url="javascript:alert(1)").status_code, 400)
        now = timezone.now()
        self.assertEqual(self.publish(starts_at=now.isoformat(), ends_at=(now - timedelta(days=1)).isoformat()).status_code, 400)
        self.assertEqual(AdBanner.objects.count(), 0)

    def test_publish_stores_two_variants_and_audits(self):
        response = self.publish(link_url="https://exemple.test/promo")
        self.assertEqual(response.status_code, 201, response.content)
        banner = AdBanner.objects.get()
        self.assertTrue(len(bytes(banner.image_desktop)) > 0 and len(bytes(banner.image_mobile)) > 0)
        self.assertEqual(response.json()["data"]["state"], "live")

    @override_settings(ADS_ENABLED=False)
    def test_patient_sees_nothing_while_public_activation_is_off(self):
        self.publish()
        self.client.force_authenticate(self.patient_user)
        self.assertIsNone(self.client.get(CURRENT).json()["data"])

    @override_settings(ADS_ENABLED=True)
    def test_patient_sees_live_banner_with_sponsored_label_and_it_is_counted_without_identity(self):
        banner_id = self.publish().json()["data"]["id"]
        self.client.force_authenticate(self.patient_user)
        data = self.client.get(CURRENT).json()["data"]
        self.assertEqual(data["id"], banner_id)
        self.assertEqual(data["label"], "Sponsorisé")
        self.assertEqual(self.client.get(data["desktop_url"]).status_code, 200)
        self.assertEqual(self.client.get(data["mobile_url"]).headers["Content-Type"], "image/webp")
        self.assertEqual(self.client.post(f"/api/v1/advertising/banners/{banner_id}/click/").status_code, 200)
        stat = AdBannerDailyStat.objects.get()
        self.assertEqual((stat.impressions, stat.clicks), (1, 1))

    @override_settings(ADS_ENABLED=True)
    def test_professional_never_gets_the_banner_or_its_image(self):
        banner_id = self.publish().json()["data"]["id"]
        self.client.force_authenticate(self.pro_user)
        self.assertIsNone(self.client.get(CURRENT).json()["data"])
        self.assertEqual(self.client.get(f"/api/v1/advertising/banners/{banner_id}/image/desktop/").status_code, 404)

    @override_settings(ADS_ENABLED=True)
    def test_scheduled_ended_and_withdrawn_banners_are_not_shown(self):
        now = timezone.now()
        self.publish(starts_at=(now + timedelta(days=1)).isoformat(), ends_at=(now + timedelta(days=2)).isoformat())
        self.client.force_authenticate(self.patient_user)
        self.assertIsNone(self.client.get(CURRENT).json()["data"])
        live_id = self.publish().json()["data"]["id"]
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(f"/api/v1/advertising/admin/banners/{live_id}/withdraw/").json()["data"]["state"], "withdrawn")
        self.client.force_authenticate(self.patient_user)
        self.assertIsNone(self.client.get(CURRENT).json()["data"])

    @override_settings(ADS_ENABLED=True)
    def test_latest_scheduled_banner_wins_when_periods_overlap(self):
        now = timezone.now()
        self.publish(alt_text="Ancienne bannière", starts_at=(now - timedelta(days=2)).isoformat())
        newer = self.publish(alt_text="Nouvelle bannière", starts_at=(now - timedelta(hours=1)).isoformat())
        self.assertEqual(newer.json()["data"]["overlaps"], 1)
        self.client.force_authenticate(self.patient_user)
        self.assertEqual(self.client.get(CURRENT).json()["data"]["alt_text"], "Nouvelle bannière")

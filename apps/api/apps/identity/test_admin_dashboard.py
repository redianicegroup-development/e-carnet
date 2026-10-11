import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import AnonymousVisitor, ProductSurveyResponse, SiteFeedback


class AdminDashboardTests(TestCase):
    url = "/api/v1/identity/admin/dashboard/"

    def test_anonymous_users_cannot_access_dashboard(self):
        response = APIClient().get(self.url)
        self.assertEqual(response.status_code, 403)

    def test_staff_without_superuser_flag_cannot_access_dashboard(self):
        user = get_user_model().objects.create_user(
            username="staff@example.test", email="staff@example.test", password="Test-password-2026!", is_staff=True,
        )
        client = APIClient()
        client.force_authenticate(user)
        self.assertEqual(client.get(self.url).status_code, 403)

    def test_superuser_can_read_aggregated_visitor_dashboard(self):
        user = get_user_model().objects.create_superuser(
            username="admin@example.test", email="admin@example.test", password="Test-password-2026!",
        )
        visitor = AnonymousVisitor.objects.create(
            visitor_id=uuid.uuid4(), last_seen=timezone.now(), page_view_count=4,
            login_success_count=2, login_failure_count=1, last_page_category="auth",
        )
        client = APIClient()
        client.force_authenticate(user)
        response = client.get(self.url)
        self.assertEqual(response.status_code, 200)
        payload = response.data["data"]
        self.assertEqual(payload["visitors_total"], 1)
        self.assertEqual(payload["visitors_active_24h"], 1)
        self.assertEqual(payload["page_views_total"], 4)
        self.assertEqual(payload["auth_successes_total"], 2)
        self.assertEqual(payload["login_failures_total"], 1)
        self.assertEqual(payload["visitors"][0]["visitor_id"], str(visitor.visitor_id))
        self.assertNotIn("email", payload["visitors"][0])
        self.assertNotIn("ip_address", payload["visitors"][0])

    def test_dashboard_returns_real_daily_series_for_the_last_30_days(self):
        user = get_user_model().objects.create_superuser(
            username="chart-admin@example.test", email="chart-admin@example.test", password="Test-password-2026!",
        )
        visitor = AnonymousVisitor.objects.create(visitor_id=uuid.uuid4(), last_seen=timezone.now())
        SiteFeedback.objects.create(category="idea", message="Améliorer les graphiques.")
        ProductSurveyResponse.objects.create(visitor=visitor, rating=4)
        client = APIClient()
        client.force_authenticate(user)

        response = client.get(self.url)
        self.assertEqual(response.status_code, 200)
        series = response.data["data"]["daily_activity"]
        self.assertEqual(len(series), 30)
        today = timezone.localdate().isoformat()
        current_day = next(point for point in series if point["date"] == today)
        self.assertEqual(current_day["new_visitors"], 1)
        self.assertEqual(current_day["feedback_submissions"], 1)
        self.assertEqual(current_day["survey_responses"], 1)
        self.assertEqual(current_day["average_rating"], 4.0)

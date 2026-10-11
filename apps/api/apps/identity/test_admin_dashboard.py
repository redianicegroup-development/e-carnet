import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import AnonymousVisitor


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

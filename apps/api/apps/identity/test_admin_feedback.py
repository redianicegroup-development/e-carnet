import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import AnonymousVisitor, SiteFeedback


class AnonymousClickAndFeedbackTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_clicks_store_only_allowlisted_category_and_coarse_page(self):
        response = self.client.post(
            "/api/v1/identity/analytics/clicks/",
            {"category": "signup", "path": "/inscription?email=private@example.test"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        visitor = AnonymousVisitor.objects.get(visitor_id=response.cookies["ecarnet_visitor"].value)
        self.assertEqual(visitor.click_count, 1)
        self.assertEqual(visitor.last_click_category, "signup")
        self.assertEqual(visitor.last_click_page_category, "auth")
        self.assertFalse(hasattr(visitor, "last_path"))
        self.assertNotIn("private@example.test", str(visitor.__dict__))

    def test_unrecognized_click_category_is_stored_as_other(self):
        response = self.client.post(
            "/api/v1/identity/analytics/clicks/",
            {"category": "private button text with personal data", "path": "/"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        visitor = AnonymousVisitor.objects.get(visitor_id=response.cookies["ecarnet_visitor"].value)
        self.assertEqual(visitor.last_click_category, "other")
        self.assertNotIn("private button text", str(visitor.__dict__))

    def test_feedback_is_anonymous_and_sets_a_securely_scoped_cookie(self):
        response = self.client.post(
            "/api/v1/identity/feedback/",
            {"category": "idea", "message": "La navigation est claire.", "path": "/"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        feedback = SiteFeedback.objects.get()
        self.assertEqual(feedback.category, "idea")
        self.assertEqual(feedback.page_category, "landing")
        self.assertEqual(feedback.status, "new")
        self.assertFalse(hasattr(feedback, "email"))
        self.assertTrue(response.cookies["ecarnet_visitor"]["httponly"])

    def test_feedback_rejects_invalid_category_short_message_and_non_string_category(self):
        for payload in (
            {"category": "invalid", "message": "Texte assez long", "path": "/"},
            {"category": "bug", "message": "no", "path": "/"},
            {"category": [], "message": "Texte assez long", "path": "/"},
        ):
            response = self.client.post("/api/v1/identity/feedback/", payload, format="json")
            self.assertEqual(response.status_code, 400)
        self.assertEqual(SiteFeedback.objects.count(), 0)

    def test_feedback_rejects_oversized_message(self):
        response = self.client.post(
            "/api/v1/identity/feedback/",
            {"category": "other", "message": "x" * 2001, "path": "/"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(SiteFeedback.objects.count(), 0)


class AdminFeedbackDashboardTests(TestCase):
    dashboard_url = "/api/v1/identity/admin/dashboard/"

    def setUp(self):
        self.admin = get_user_model().objects.create_superuser(
            username="admin@example.test", email="admin@example.test", password="Secure-test-password-2026!",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_dashboard_includes_click_and_feedback_kpis(self):
        AnonymousVisitor.objects.create(
            visitor_id=uuid.uuid4(), last_seen=timezone.now(), page_view_count=4,
            click_count=3, last_click_category="signup", last_click_page_category="landing",
        )
        SiteFeedback.objects.create(category="bug", message="Le bouton de connexion ne répond pas.")
        response = self.client.get(self.dashboard_url)
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["clicks_total"], 3)
        self.assertEqual(data["feedback_total"], 1)
        self.assertEqual(data["feedback_new_total"], 1)
        self.assertEqual(data["visitors"][0]["last_click_category"], "signup")
        self.assertEqual(data["feedback"][0]["message"], "Le bouton de connexion ne répond pas.")

    def test_superadmin_can_update_feedback_status(self):
        feedback = SiteFeedback.objects.create(category="idea", message="Ajouter une recherche globale.")
        response = self.client.patch(
            f"/api/v1/identity/admin/feedback/{feedback.id}/",
            {"status": "in_progress"}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        feedback.refresh_from_db()
        self.assertEqual(feedback.status, "in_progress")

    def test_invalid_status_is_rejected(self):
        feedback = SiteFeedback.objects.create(category="idea", message="Ajouter une recherche globale.")
        response = self.client.patch(
            f"/api/v1/identity/admin/feedback/{feedback.id}/",
            {"status": []}, format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_ordinary_user_cannot_change_feedback_status(self):
        feedback = SiteFeedback.objects.create(category="idea", message="Ajouter une recherche globale.")
        ordinary = get_user_model().objects.create_user(
            username="member@example.test", email="member@example.test", password="Secure-test-password-2026!",
        )
        client = APIClient()
        client.force_authenticate(ordinary)
        response = client.patch(
            f"/api/v1/identity/admin/feedback/{feedback.id}/",
            {"status": "resolved"}, format="json",
        )
        self.assertEqual(response.status_code, 403)
        feedback.refresh_from_db()
        self.assertEqual(feedback.status, "new")

    def test_only_superadmins_can_read_feedback_dashboard(self):
        ordinary = get_user_model().objects.create_user(
            username="member@example.test", email="member@example.test", password="Secure-test-password-2026!",
        )
        client = APIClient()
        client.force_authenticate(ordinary)
        self.assertEqual(client.get(self.dashboard_url).status_code, 403)

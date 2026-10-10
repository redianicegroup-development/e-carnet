from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import AnonymousVisitor


class AnonymousVisitorAnalyticsTests(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.visit_url = "/api/v1/identity/analytics/visits/"

    def test_first_page_view_sets_http_only_anonymous_cookie(self):
        response = self.client.post(self.visit_url, {"path": "/"}, format="json")
        self.assertEqual(response.status_code, 200)
        cookie = response.cookies["ecarnet_visitor"]
        self.assertTrue(cookie["httponly"])
        self.assertIn(cookie["samesite"], ("Lax", "None"))
        if cookie["samesite"] == "None":
            self.assertTrue(cookie["secure"])
        visitor = AnonymousVisitor.objects.get()
        self.assertEqual(str(visitor.visitor_id), cookie.value)
        self.assertEqual(visitor.page_view_count, 1)
        self.assertEqual(visitor.last_page_category, "landing")

    def test_routes_aggregate_and_auth_page_is_counted_without_raw_url(self):
        self.client.post(self.visit_url, {"path": "/connexion?next=%2Fpatient%2Fcarnet"}, format="json")
        response = self.client.post(self.visit_url, {"path": "/patient/consultations/123?name=private"}, format="json")
        self.assertEqual(response.status_code, 200)
        visitor = AnonymousVisitor.objects.get()
        self.assertEqual(visitor.page_view_count, 2)
        self.assertEqual(visitor.auth_page_view_count, 1)
        self.assertEqual(visitor.last_page_category, "patient")
        self.assertFalse(hasattr(visitor, "last_path"))

    def test_visitor_endpoint_works_with_csrf_checks_for_authenticated_session(self):
        user = get_user_model().objects.create_user(username="csrf@example.test", email="csrf@example.test", password="Long-valid-password-2026!")
        self.assertTrue(self.client.login(username=user.username, password="Long-valid-password-2026!"))
        response = self.client.post(self.visit_url, {"path": "/patient"}, format="json")
        self.assertEqual(response.status_code, 200)

    def test_successful_login_and_failed_login_are_counted_without_storing_credentials(self):
        user = get_user_model().objects.create_user(username="visitor@example.test", email="visitor@example.test", password="Long-valid-password-2026!")
        success = self.client.post("/api/v1/identity/login/", {"email": user.email, "password": "Long-valid-password-2026!"}, format="json")
        self.assertEqual(success.status_code, 200)
        visitor_id = success.cookies["ecarnet_visitor"].value
        visitor = AnonymousVisitor.objects.get(visitor_id=visitor_id)
        self.assertEqual(visitor.login_success_count, 1)

        failure_client = APIClient()
        failure_client.cookies["ecarnet_visitor"] = visitor_id
        failure = failure_client.post("/api/v1/identity/login/", {"email": user.email, "password": "wrong-password"}, format="json")
        self.assertEqual(failure.status_code, 400)
        visitor.refresh_from_db()
        self.assertEqual(visitor.login_failure_count, 1)
        self.assertNotIn(user.email, str(visitor.__dict__))
        self.assertNotIn("wrong-password", str(visitor.__dict__))

    def test_registration_is_counted(self):
        response = self.client.post("/api/v1/identity/register/", {"email": "signup@example.test", "password": "Long-valid-password-2026!", "first_name": "Test", "last_name": "Visitor"}, format="json")
        self.assertEqual(response.status_code, 201)
        visitor = AnonymousVisitor.objects.get(visitor_id=response.cookies["ecarnet_visitor"].value)
        self.assertEqual(visitor.registration_count, 1)

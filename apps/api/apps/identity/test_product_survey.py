import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    AnonymousVisitor,
    ProductExperienceSurveyResponse,
    ProductSurveyResponse,
    VisitorDiscoverySurveyResponse,
)


class VisitorDiscoverySurveyTests(TestCase):
    visit_url = "/api/v1/identity/analytics/visits/"
    submit_url = "/api/v1/identity/feedback2/"

    def setUp(self):
        self.client = APIClient()
        self.client.cookies["ecarnet_analytics_consent"] = "accepted"

    def visit(self, path="/"):
        return self.client.post(self.visit_url, {"path": path}, format="json")

    def test_invitation_is_claimed_once_after_five_public_views(self):
        for _ in range(4):
            response = self.visit("/faq")
            self.assertEqual(response.status_code, 200)
            self.assertFalse(response.data["data"]["survey_due"])

        response = self.visit("/connexion")
        self.assertFalse(response.data["data"]["survey_due"])
        self.assertEqual(AnonymousVisitor.objects.get().public_page_view_count, 4)

        response = self.visit("/securite")
        self.assertTrue(response.data["data"]["survey_due"])
        response = self.visit("/")
        self.assertFalse(response.data["data"]["survey_due"])
        visitor = AnonymousVisitor.objects.get()
        self.assertEqual(visitor.public_page_view_count, 6)
        self.assertIsNotNone(visitor.visitor_survey_prompted_at)
        self.assertIsNone(visitor.product_survey_prompted_at)

    def test_discovery_survey_requires_invitation_and_accepts_only_one_anonymous_response(self):
        payload = {
            "persona": "patient",
            "found_what": "partly",
            "barriers": ["health_privacy", "pricing"],
            "missing": "Un guide plus court pour démarrer.",
        }
        self.assertEqual(self.client.post(self.submit_url, payload, format="json").status_code, 403)
        for _ in range(5):
            self.visit("/")

        submitted = self.client.post(self.submit_url, payload, format="json")
        self.assertEqual(submitted.status_code, 201)
        duplicate = self.client.post(self.submit_url, payload, format="json")
        self.assertEqual(duplicate.status_code, 409)

        response = VisitorDiscoverySurveyResponse.objects.get()
        self.assertEqual(response.persona, "patient")
        self.assertEqual(response.found_what, "partly")
        self.assertEqual(response.barriers, payload["barriers"])
        self.assertFalse(hasattr(response, "email"))
        self.assertIsNotNone(response.visitor.visitor_survey_completed_at)

    def test_discovery_survey_rejects_conflicting_none_barrier(self):
        for _ in range(5):
            self.visit("/")
        response = self.client.post(self.submit_url, {
            "persona": "discovery", "found_what": "yes", "barriers": ["none", "pricing"], "missing": "",
        }, format="json")
        self.assertEqual(response.status_code, 400)


class ProductExperienceSurveyTests(TestCase):
    trigger_url = "/api/v1/identity/analytics/product-action/"
    submit_url = "/api/v1/identity/feedback2/product/"
    summary_url = "/api/v1/identity/feedback2/summary/"

    def test_trigger_requires_login_and_is_claimed_once_after_first_action(self):
        client = APIClient()
        client.cookies["ecarnet_analytics_consent"] = "accepted"
        self.assertEqual(client.post(self.trigger_url, {}, format="json").status_code, 403)
        user = get_user_model().objects.create_user(
            username="patient@example.test", email="patient@example.test", password="Secure-test-password-2026!",
        )
        client.force_authenticate(user)

        first = client.post(self.trigger_url, {}, format="json")
        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.data["data"]["survey_due"])
        second = client.post(self.trigger_url, {}, format="json")
        self.assertEqual(second.status_code, 200)
        self.assertFalse(second.data["data"]["survey_due"])
        visitor = AnonymousVisitor.objects.get()
        self.assertIsNotNone(visitor.first_product_action_at)
        self.assertIsNotNone(visitor.product_survey_prompted_at)

    def test_product_response_requires_invitation_and_is_unique(self):
        user = get_user_model().objects.create_user(
            username="member@example.test", email="member@example.test", password="Secure-test-password-2026!",
        )
        client = APIClient()
        client.cookies["ecarnet_analytics_consent"] = "accepted"
        client.force_authenticate(user)
        payload = {"ease_rating": 2, "appreciated": ["access_control"], "pain_points": ["navigation"], "improvement_suggestion": "Réduire les étapes."}
        self.assertEqual(client.post(self.submit_url, payload, format="json").status_code, 403)
        client.post(self.trigger_url, {}, format="json")
        submitted = client.post(self.submit_url, payload, format="json")
        self.assertEqual(submitted.status_code, 201)
        self.assertEqual(client.post(self.submit_url, payload, format="json").status_code, 409)

        response = ProductExperienceSurveyResponse.objects.get()
        self.assertEqual(response.ease_rating, 2)
        self.assertEqual(response.pain_points, ["navigation"])
        self.assertIsNotNone(response.visitor.product_survey_completed_at)
        self.assertFalse(hasattr(response, "email"))

    def test_public_summary_hides_average_until_thirty_product_responses(self):
        for _ in range(29):
            visitor = AnonymousVisitor.objects.create(visitor_id=uuid.uuid4(), last_seen=timezone.now())
            ProductExperienceSurveyResponse.objects.create(visitor=visitor, ease_rating=4)
        response = APIClient().get(self.summary_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], {"average_rating": None, "responses_total": 29, "minimum_responses": 30})

        visitor = AnonymousVisitor.objects.create(visitor_id=uuid.uuid4(), last_seen=timezone.now())
        ProductExperienceSurveyResponse.objects.create(visitor=visitor, ease_rating=5)
        response = APIClient().get(self.summary_url)
        self.assertEqual(response.data["data"]["average_rating"], 4.0)
        self.assertEqual(response.data["data"]["responses_total"], 30)
        self.assertEqual(set(response.data["data"].keys()), {"average_rating", "responses_total", "minimum_responses"})

    def test_admin_dashboard_separates_two_surveys_and_keeps_old_responses_archived(self):
        visitor = AnonymousVisitor.objects.create(
            visitor_id=uuid.uuid4(), last_seen=timezone.now(), public_page_view_count=5,
            visitor_survey_prompted_at=timezone.now(), product_survey_prompted_at=timezone.now(),
        )
        VisitorDiscoverySurveyResponse.objects.create(
            visitor=visitor, persona="professional", found_what="no", barriers=["purpose"], missing="Un aperçu du parcours.",
        )
        ProductExperienceSurveyResponse.objects.create(
            visitor=visitor, ease_rating=3, appreciated=["organized_carnet"], pain_points=["clarity"], improvement_suggestion="Clarifier les libellés.",
        )
        ProductSurveyResponse.objects.create(visitor=visitor, rating=5, improvement_suggestion="Réponse historique.")
        admin = get_user_model().objects.create_superuser(
            username="survey-admin@example.test", email="survey-admin@example.test", password="Secure-test-password-2026!",
        )
        client = APIClient()
        client.force_authenticate(admin)

        response = client.get("/api/v1/identity/admin/dashboard/")
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["visitor_survey_prompted_total"], 1)
        self.assertEqual(data["visitor_survey_responses_total"], 1)
        self.assertEqual(data["product_survey_prompted_total"], 1)
        self.assertEqual(data["product_survey_responses_total"], 1)
        self.assertEqual(data["product_survey_average_rating"], 3.0)
        self.assertEqual(data["product_survey_distribution"]["3"], 1)
        self.assertEqual(data["visitor_survey_responses"][0]["persona"], "professional")
        self.assertEqual(data["product_survey_responses"][0]["ease_rating"], 3)
        self.assertNotIn("visitor_id", data["visitor_survey_responses"][0])
        self.assertNotIn("visitor_id", data["product_survey_responses"][0])
        self.assertEqual(data["legacy_survey_responses_total"], 1)
        self.assertEqual(data["legacy_survey_responses"][0]["improvement_suggestion"], "Réponse historique.")

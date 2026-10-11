import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import AnonymousVisitor, ProductSurveyResponse


class ProductSurveyFlowTests(TestCase):
    visit_url = "/api/v1/identity/analytics/visits/"
    submit_url = "/api/v1/identity/feedback2/"
    summary_url = "/api/v1/identity/feedback2/summary/"

    def setUp(self):
        self.client = APIClient()

    def visit(self, path="/"):
        return self.client.post(self.visit_url, {"path": path}, format="json")

    def test_invitation_is_claimed_once_after_five_public_views(self):
        for _ in range(4):
            response = self.visit("/faq")
            self.assertEqual(response.status_code, 200)
            self.assertFalse(response.data["data"]["survey_due"])

        # Auth pages do not count toward the five public-page threshold.
        response = self.visit("/connexion")
        self.assertFalse(response.data["data"]["survey_due"])
        self.assertEqual(AnonymousVisitor.objects.get().public_page_view_count, 4)

        response = self.visit("/securite")
        self.assertTrue(response.data["data"]["survey_due"])
        response = self.visit("/")
        self.assertFalse(response.data["data"]["survey_due"])
        visitor = AnonymousVisitor.objects.get()
        self.assertEqual(visitor.public_page_view_count, 6)
        self.assertIsNotNone(visitor.survey_prompted_at)

    def test_survey_requires_invitation_and_accepts_only_one_anonymous_response(self):
        payload = {
            "rating": 4,
            "appreciated": ["organized_carnet", "design"],
            "pain_points": ["navigation"],
            "improvement_suggestion": "Rendre la navigation plus directe.",
        }
        self.assertEqual(self.client.post(self.submit_url, payload, format="json").status_code, 403)

        for _ in range(5):
            self.visit("/")
        submitted = self.client.post(self.submit_url, payload, format="json")
        self.assertEqual(submitted.status_code, 201)
        duplicate = self.client.post(self.submit_url, payload, format="json")
        self.assertEqual(duplicate.status_code, 409)

        response = ProductSurveyResponse.objects.get()
        self.assertEqual(response.rating, 4)
        self.assertEqual(response.appreciated, payload["appreciated"])
        self.assertFalse(hasattr(response, "email"))
        self.assertIsNotNone(response.visitor.survey_completed_at)

    def test_public_summary_contains_only_average_and_response_count(self):
        visitor = AnonymousVisitor.objects.create(
            visitor_id=uuid.uuid4(), last_seen=timezone.now(), survey_prompted_at=timezone.now(),
        )
        ProductSurveyResponse.objects.create(
            visitor=visitor,
            rating=5,
            appreciated=["design"],
            pain_points=[],
            improvement_suggestion="Private suggestion text.",
        )
        response = self.client.get(self.summary_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], {"average_rating": 5.0, "responses_total": 1})
        self.assertNotIn("Private suggestion text.", str(response.data))

    def test_admin_dashboard_contains_distribution_and_anonymous_answers(self):
        visitor = AnonymousVisitor.objects.create(
            visitor_id=uuid.uuid4(), last_seen=timezone.now(), public_page_view_count=5,
            survey_prompted_at=timezone.now(),
        )
        ProductSurveyResponse.objects.create(
            visitor=visitor,
            rating=3,
            appreciated=["health_content"],
            pain_points=["clarity"],
            improvement_suggestion="Clarifier les libellés.",
        )
        admin = get_user_model().objects.create_superuser(
            username="survey-admin@example.test", email="survey-admin@example.test", password="Secure-test-password-2026!",
        )
        client = APIClient()
        client.force_authenticate(admin)

        response = client.get("/api/v1/identity/admin/dashboard/")
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["survey_prompted_total"], 1)
        self.assertEqual(data["survey_responses_total"], 1)
        self.assertEqual(data["survey_completion_rate"], 100.0)
        self.assertEqual(data["survey_average_rating"], 3.0)
        self.assertEqual(data["survey_distribution"]["3"], 1)
        self.assertEqual(data["survey_responses"][0]["rating"], 3)
        self.assertNotIn("visitor_id", data["survey_responses"][0])
        self.assertEqual(data["survey_responses"][0]["improvement_suggestion"], "Clarifier les libellés.")

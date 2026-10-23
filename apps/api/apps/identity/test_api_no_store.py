"""Audit QA du 23/10/2026 : l'API ne laisse rien en cache par défaut."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()


class ApiNoStoreTests(TestCase):
    def test_authenticated_api_response_is_private_and_not_stored(self):
        user = User.objects.create_user(username="cache-user", password="local-test-password")
        client = APIClient()
        client.force_authenticate(user)
        response = client.get("/api/v1/identity/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "private, no-store")

    def test_a_view_that_sets_its_own_cache_policy_keeps_it(self):
        from django.http import HttpResponse
        from django.test import RequestFactory
        from .middleware import ApiPrivateNoStoreMiddleware
        explicit = ApiPrivateNoStoreMiddleware(lambda request: HttpResponse(headers={"Cache-Control": "private, max-age=3600"}))
        self.assertEqual(explicit(RequestFactory().get("/api/v1/establishments/x/logo/"))["Cache-Control"], "private, max-age=3600")
        outside = ApiPrivateNoStoreMiddleware(lambda request: HttpResponse())
        self.assertFalse(outside(RequestFactory().get("/static/app.css")).has_header("Cache-Control"))

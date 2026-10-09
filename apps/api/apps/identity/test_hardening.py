from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings
from rest_framework.test import APIClient

User = get_user_model()
PASSWORD = "a-long-local-password-1"
REAL_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "hardening-tests"}}


class CsrfTokenTests(TestCase):
    def test_csrf_endpoint_returns_the_token_in_json_and_the_header_is_accepted_without_reading_a_cookie(self):
        User.objects.create_user(username="a@example.test", email="a@example.test", password=PASSWORD)
        browser = Client(enforce_csrf_checks=True)
        token = browser.get("/api/v1/csrf/").json()["csrfToken"]
        self.assertTrue(token and token != "None")
        login = browser.post("/api/v1/identity/login/", {"email": "a@example.test", "password": PASSWORD}, content_type="application/json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(login.status_code, 200)
        fresh = browser.get("/api/v1/csrf/").json()["csrfToken"]  # le jeton change après la connexion
        body = '{"first_name": "Awa", "last_name": "Kone"}'
        self.assertEqual(browser.patch("/api/v1/identity/me/profile/", body, content_type="application/json", HTTP_X_CSRFTOKEN=fresh).status_code, 200)

    def test_a_token_with_a_leading_equals_sign_is_rejected_which_is_why_the_client_must_not_slice_the_cookie_wrongly(self):
        User.objects.create_user(username="b@example.test", email="b@example.test", password=PASSWORD)
        browser = Client(enforce_csrf_checks=True)
        browser.post("/api/v1/identity/login/", {"email": "b@example.test", "password": PASSWORD}, content_type="application/json", HTTP_X_CSRFTOKEN=browser.get("/api/v1/csrf/").json()["csrfToken"])
        fresh = browser.get("/api/v1/csrf/").json()["csrfToken"]
        body = '{"first_name": "Awa", "last_name": "Kone"}'
        self.assertEqual(browser.patch("/api/v1/identity/me/profile/", body, content_type="application/json", HTTP_X_CSRFTOKEN="=" + fresh).status_code, 403)
        self.assertEqual(browser.patch("/api/v1/identity/me/profile/", body, content_type="application/json").status_code, 403)


@override_settings(CACHES=REAL_CACHE)
class ThrottlingTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.client = APIClient()

    def test_login_is_limited_per_ip(self):
        statuses = [self.client.post("/api/v1/identity/login/", {"email": f"user{i}@example.test", "password": "wrong-password"}, format="json").status_code for i in range(22)]
        self.assertEqual(statuses[0], 400)
        self.assertEqual(statuses[-1], 429)

    def test_login_is_limited_per_targeted_email_even_from_many_ips(self):
        statuses = []
        for index in range(10):
            statuses.append(self.client.post("/api/v1/identity/login/", {"email": "victim@example.test", "password": "wrong-password"}, format="json", REMOTE_ADDR=f"10.0.0.{index + 1}").status_code)
        self.assertIn(429, statuses)
        self.assertEqual(statuses[0], 400)
        other = self.client.post("/api/v1/identity/login/", {"email": "someone-else@example.test", "password": "wrong-password"}, format="json", REMOTE_ADDR="10.0.0.99")
        self.assertEqual(other.status_code, 400)

    def test_registration_is_limited(self):
        statuses = [self.client.post("/api/v1/identity/register/", {"email": f"new{i}@example.test", "password": PASSWORD, "first_name": "A", "last_name": "B"}, format="json").status_code for i in range(12)]
        self.assertEqual(statuses[0], 201)
        self.assertEqual(statuses[-1], 429)

    def test_registration_limit_cannot_be_dodged_by_keeping_the_session_cookie(self):
        statuses = [self.client.post("/api/v1/identity/register/", {"email": f"keep{i}@example.test", "password": PASSWORD, "first_name": "A", "last_name": "B"}, format="json").status_code for i in range(11)]
        self.assertEqual(statuses[-1], 429)  # la session ouverte par l'inscription précédente ne change pas de compteur

    def test_join_code_guessing_is_limited(self):
        self.client.post("/api/v1/identity/register/", {"email": "doc@example.test", "password": PASSWORD, "first_name": "A", "last_name": "B"}, format="json")
        statuses = [self.client.post("/api/v1/establishments/join-codes/redeem/", {"code": f"BAD-{i}"}, format="json").status_code for i in range(12)]
        self.assertIn(429, statuses)

    def test_invitation_token_guessing_is_limited(self):
        statuses = [self.client.post("/api/v1/establishments/invitations/accept/", {"token": f"guess{i}", "password": PASSWORD}, format="json").status_code for i in range(12)]
        self.assertIn(429, statuses)

    def test_admin_console_login_is_limited(self):
        statuses = [self.client.post("/admin/login/", {"username": "x", "password": "y"}).status_code for _ in range(13)]
        self.assertEqual(statuses[-1], 429)
        self.assertNotIn(429, statuses[:9])


class ThrottleSafetyTests(TestCase):
    def test_throttle_does_not_apply_to_reads_of_the_grant_list(self):
        from apps.identity.throttles import WriteScopedThrottle
        throttle = WriteScopedThrottle()
        class FakeRequest: method = "GET"
        self.assertTrue(throttle.allow_request(FakeRequest(), object()))

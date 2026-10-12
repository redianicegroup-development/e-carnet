from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import AccountActionRequest


User = get_user_model()


class AccountActionRequestTests(TestCase):
    user_url = "/api/v1/identity/me/account-requests/"
    admin_url = "/api/v1/identity/admin/account-requests/"

    def setUp(self):
        self.user = User.objects.create_user(
            username="patient@example.test", email="patient@example.test", password="Test-password-2026!",
            first_name="Camille", last_name="Patient",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_user_can_request_suspension_for_a_listed_duration_and_account_is_not_deleted(self):
        response = self.client.post(self.user_url, {"request_type": "suspension", "suspension_days": 14}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["data"]["suspension_days"], 14)
        self.assertEqual(response.data["data"]["status"], "new")
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())
        self.assertEqual(AccountActionRequest.objects.get().user, self.user)

    def test_suspension_duration_must_be_one_of_the_offered_values(self):
        response = self.client.post(self.user_url, {"request_type": "suspension", "suspension_days": 10}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(AccountActionRequest.objects.exists())

    def test_other_deletion_reason_requires_details_and_is_visible_to_admin(self):
        invalid = self.client.post(self.user_url, {"request_type": "deletion", "reason": "other"}, format="json")
        self.assertEqual(invalid.status_code, 400)
        created = self.client.post(self.user_url, {
            "request_type": "deletion", "reason": "other", "details": "Je souhaite préciser mon motif.",
        }, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

        admin = User.objects.create_superuser(
            username="admin@example.test", email="admin@example.test", password="Test-password-2026!",
        )
        admin_client = APIClient()
        admin_client.force_authenticate(admin)
        response = admin_client.get(self.admin_url)
        self.assertEqual(response.status_code, 200)
        row = response.data["data"][0]
        self.assertEqual(row["user_email"], self.user.email)
        self.assertEqual(row["reason"], "other")
        self.assertEqual(row["details"], "Je souhaite préciser mon motif.")

    def test_duplicate_open_request_is_rejected_and_other_accounts_cannot_read_it(self):
        first = self.client.post(self.user_url, {"request_type": "suspension", "suspension_days": 7}, format="json")
        self.assertEqual(first.status_code, 201)
        duplicate = self.client.post(self.user_url, {"request_type": "suspension", "suspension_days": 30}, format="json")
        self.assertEqual(duplicate.status_code, 409)
        other = User.objects.create_user(username="other@example.test", email="other@example.test")
        other_client = APIClient()
        other_client.force_authenticate(other)
        own_requests = other_client.get(self.user_url)
        self.assertEqual(own_requests.status_code, 200)
        self.assertEqual(own_requests.data["data"], [])

    def test_only_superuser_can_read_requests_or_change_status(self):
        request = self.client.post(self.user_url, {"request_type": "deletion", "reason": "privacy"}, format="json")
        request_id = request.data["data"]["id"]
        staff = User.objects.create_user(username="staff@example.test", is_staff=True)
        staff_client = APIClient()
        staff_client.force_authenticate(staff)
        self.assertEqual(staff_client.get(self.admin_url).status_code, 403)
        self.assertEqual(staff_client.patch(f"{self.admin_url}{request_id}/", {"status": "in_review"}, format="json").status_code, 403)

        admin = User.objects.create_superuser(username="admin@example.test", email="admin@example.test", password="Test-password-2026!")
        admin_client = APIClient()
        admin_client.force_authenticate(admin)
        changed = admin_client.patch(f"{self.admin_url}{request_id}/", {"status": "in_review"}, format="json")
        self.assertEqual(changed.status_code, 200)
        saved = AccountActionRequest.objects.get(pk=request_id)
        self.assertEqual(saved.status, "in_review")
        self.assertEqual(saved.reviewed_by, admin)
        self.assertIsNotNone(saved.reviewed_at)

    def test_account_payload_admin_flag_is_server_controlled(self):
        ordinary = self.client.get("/api/v1/identity/me/")
        self.assertEqual(ordinary.status_code, 200)
        self.assertFalse(ordinary.data["data"]["is_admin"])
        admin = User.objects.create_superuser(username="flag-admin@example.test", email="flag-admin@example.test", password="Test-password-2026!")
        client = APIClient()
        client.force_authenticate(admin)
        response = client.get("/api/v1/identity/me/")
        self.assertTrue(response.data["data"]["is_admin"])

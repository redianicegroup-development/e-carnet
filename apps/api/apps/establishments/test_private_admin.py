from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Establishment, EstablishmentAdministrator

User = get_user_model()
STAFF_URL = "/api/v1/establishments/startup/establishments/"


@override_settings(DEBUG=True, EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PrivateEstablishmentAdminTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(username="staff@example.test", email="staff@example.test", password="staff-password", is_staff=True)
        self.other = User.objects.create_user(username="user@example.test", email="user@example.test", password="user-password")
        self.payload = {
            "name": "Clinique privée test",
            "responsible_email": "admin@clinique.test",
            "responsible_first_name": "Amina",
            "responsible_last_name": "Test",
            "verification_confirmed": True,
        }

    def test_non_staff_cannot_create_establishment_and_staff_gets_a_temporary_password(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post(STAFF_URL, self.payload, format="json").status_code, 403)
        self.assertEqual(self.client.post("/api/v1/establishments/create/", self.payload, format="json").status_code, 403)

        self.client.force_authenticate(self.staff)
        response = self.client.post(STAFF_URL, self.payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("invitation_token", response.data["data"])
        user = User.objects.get(email="admin@clinique.test")
        self.assertTrue(user.check_password(response.data["data"]["temporary_password"]))
        self.assertEqual((user.first_name, user.last_name), ("Amina", "Test"))
        self.assertEqual(EstablishmentAdministrator.objects.filter(status="active", user=user).count(), 1)

    def test_replacing_admin_keeps_previous_assignment(self):
        establishment = Establishment.objects.create(name="Centre historique", establishment_type="Centre", city="Abidjan", address="A", phone="0", email="centre@test", responsible_name="A", status="active")
        old_admin = User.objects.create_user(username="old@test", email="old@test", password="old-password")
        EstablishmentAdministrator.objects.create(establishment=establishment, user=old_admin, assigned_by=self.staff)
        self.client.force_authenticate(self.staff)
        response = self.client.post(f"/api/v1/establishments/startup/{establishment.id}/administrator-invitation/", {"email": "new@clinique.test", "first_name": "New", "last_name": "Admin", "confirm_replace": True}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(User.objects.get(email="new@clinique.test").check_password(response.data["data"]["temporary_password"]))
        self.assertEqual(EstablishmentAdministrator.objects.filter(establishment=establishment, status="ended", user=old_admin).count(), 1)
        self.assertEqual(EstablishmentAdministrator.objects.filter(establishment=establishment, status="active").count(), 1)

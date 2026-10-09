from datetime import timedelta
from urllib.parse import urlparse, parse_qs
from django.core import mail

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Establishment, EstablishmentAdminInvitation, EstablishmentAdministrator

User = get_user_model()


@override_settings(DEBUG=True, EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PrivateEstablishmentAdminTests(TestCase):
    def create_invitation(self, payload=None):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post("/api/v1/establishments/startup/establishments/", payload or self.payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("invitation_token", response.data["data"])
        url = next(part for part in mail.outbox[-1].body.split() if "activation?token=" in part)
        return response, parse_qs(urlparse(url).query)["token"][0]
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(username="staff@example.test", email="staff@example.test", password="staff-password", is_staff=True)
        self.other = User.objects.create_user(username="user@example.test", email="user@example.test", password="user-password")
        self.payload = {
            "name": "Clinique privée test",
            "establishment_type": "Clinique",
            "city": "Abidjan",
            "address": "Rue test",
            "phone": "+22500000000",
            "email": "contact@clinique.test",
            "responsible_name": "Responsable Test",
            "responsible_email": "admin@clinique.test",
            "responsible_first_name": "Amina",
            "responsible_last_name": "Test",
        }

    def test_non_staff_cannot_create_establishment_and_staff_gets_invitation(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post("/api/v1/establishments/startup/establishments/", self.payload, format="json").status_code, 403)
        self.assertEqual(self.client.post("/api/v1/establishments/create/", self.payload, format="json").status_code, 403)

        self.client.force_authenticate(self.staff)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post("/api/v1/establishments/startup/establishments/", self.payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("invitation_token", response.data["data"])
        url = next(part for part in mail.outbox[-1].body.split() if "activation?token=" in part)
        token = parse_qs(urlparse(url).query)["token"][0]
        invitation = EstablishmentAdminInvitation.objects.get()
        self.assertNotEqual(token, invitation.token_hash)
        self.assertLess(abs((invitation.expires_at - invitation.created_at).total_seconds() - 48 * 3600), 2)

    def test_invitation_sets_recipient_password_once_and_keeps_admin_history(self):
        self.client.force_authenticate(self.staff)
        response, token = self.create_invitation()
        accepted = self.client.post("/api/v1/establishments/invitations/accept/", {"token": token, "password": "a-very-long-password"}, format="json")
        self.assertEqual(accepted.status_code, 200)
        user = User.objects.get(email="admin@clinique.test")
        self.assertTrue(user.check_password("a-very-long-password"))
        self.assertEqual(EstablishmentAdministrator.objects.filter(status="active", user=user).count(), 1)
        self.assertEqual(self.client.post("/api/v1/establishments/invitations/accept/", {"token": token, "password": "another-password"}, format="json").status_code, 400)
        self.assertEqual(EstablishmentAdministrator.objects.filter(establishment__admin_invitations__consumed_by=user).count(), 1)

    def test_expired_invitation_is_rejected(self):
        self.client.force_authenticate(self.staff)
        response, token = self.create_invitation()
        invitation = EstablishmentAdminInvitation.objects.get()
        invitation.expires_at = timezone.now() - timedelta(seconds=1)
        invitation.save(update_fields=("expires_at",))
        response = self.client.post("/api/v1/establishments/invitations/accept/", {"token": token, "password": "a-very-long-password"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="admin@clinique.test").exists())

    def test_replacing_admin_keeps_previous_assignment(self):
        establishment = Establishment.objects.create(name="Centre historique", establishment_type="Centre", city="Abidjan", address="A", phone="0", email="centre@test", responsible_name="A", status="active")
        old_admin = User.objects.create_user(username="old@test", email="old@test", password="old-password")
        EstablishmentAdministrator.objects.create(establishment=establishment, user=old_admin, assigned_by=self.staff)
        self.client.force_authenticate(self.staff)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f"/api/v1/establishments/startup/{establishment.id}/administrator-invitation/", {"email": "new@test", "first_name": "New", "last_name": "Admin"}, format="json")
        token_url = next(part for part in mail.outbox[-1].body.split() if "activation?token=" in part)
        token = parse_qs(urlparse(token_url).query)["token"][0]
        self.client.post("/api/v1/establishments/invitations/accept/", {"token": token, "password": "a-new-long-password"}, format="json")
        self.assertEqual(EstablishmentAdministrator.objects.filter(establishment=establishment, status="ended", user=old_admin).count(), 1)
        self.assertEqual(EstablishmentAdministrator.objects.filter(establishment=establishment, status="active").count(), 1)

from datetime import timedelta
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Establishment, EstablishmentAdminInvitation, EstablishmentAdministrator, EstablishmentMembership, EstablishmentNotification
from django.contrib.auth import get_user_model


User = get_user_model()
URL = "/api/v1/establishments/notifications/"


class Eta14InternalFollowupTests(TestCase):
    def make_structure(self, suffix):
        owner = User.objects.create_user(username=f"admin-{suffix}", password="local-test-password")
        site = Establishment.objects.create(name=f"Structure {suffix}", status="active", created_by=owner)
        EstablishmentAdministrator.objects.create(establishment=site, user=owner, assigned_by=owner, status="active")
        return owner, site

    def make_expired_invitation(self, site, creator):
        return EstablishmentAdminInvitation.objects.create(
            establishment=site, email="invite@example.test", token_hash=f"{site.pk.hex[:32]}".ljust(64, "a"),
            expires_at=timezone.now() - timedelta(days=10), created_by=creator,
        )

    def test_expired_invitation_and_pending_membership_are_idempotent(self):
        admin, site = self.make_structure("one")
        self.make_expired_invitation(site, admin)
        membership_user = User.objects.create_user(username="doctor-pending", password="local-test-password")
        from apps.professionals.models import ProfessionalProfile
        professional = ProfessionalProfile.objects.create(user=membership_user, professional_title="Médecin")
        membership = EstablishmentMembership.objects.create(establishment=site, professional=professional, status="pending")
        EstablishmentMembership.objects.filter(pk=membership.pk).update(requested_at=timezone.now() - timedelta(days=10))

        call_command("send_internal_followups", days=7, stdout=StringIO())
        call_command("send_internal_followups", days=7, stdout=StringIO())
        notifications = EstablishmentNotification.objects.filter(recipient=admin)
        self.assertEqual(notifications.count(), 2)
        self.assertTrue(all("diagnostic" not in (item.body or "").lower() for item in notifications))
        self.assertEqual(len({item.event_key for item in notifications}), 2)

    def test_admin_sees_only_notifications_for_own_structure(self):
        admin_a, site_a = self.make_structure("a")
        admin_b, site_b = self.make_structure("b")
        self.make_expired_invitation(site_a, admin_a)
        self.make_expired_invitation(site_b, admin_b)
        call_command("send_internal_followups", days=7, stdout=StringIO())

        client = APIClient(); client.force_authenticate(admin_a)
        response = client.get(URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), 1)
        self.assertEqual(response.data["data"][0]["metadata"], {"event": "invitation_expired"})

    def test_resolved_situations_stop_generating_reminders(self):
        admin, site = self.make_structure("resolved")
        invitation = self.make_expired_invitation(site, admin)
        invitation.consumed_at = timezone.now(); invitation.save(update_fields=("consumed_at",))
        from apps.professionals.models import ProfessionalProfile
        professional_user = User.objects.create_user(username="doctor-resolved", password="local-test-password")
        professional = ProfessionalProfile.objects.create(user=professional_user, professional_title="Médecin")
        membership = EstablishmentMembership.objects.create(establishment=site, professional=professional, status="active")
        EstablishmentMembership.objects.filter(pk=membership.pk).update(requested_at=timezone.now() - timedelta(days=10))
        call_command("send_internal_followups", days=7, stdout=StringIO())
        self.assertFalse(EstablishmentNotification.objects.filter(recipient=admin).exists())

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.establishments.models import Establishment, EstablishmentAdministrator, EstablishmentMembership
from apps.professionals.models import ProfessionalProfile


User = get_user_model()


class MedicalReferentAssignmentTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="eta11-staff", password="secret-test-123", is_staff=True)
        self.admin_user = User.objects.create_user(username="eta11-admin", password="secret-test-123")
        self.other_user = User.objects.create_user(username="eta11-other", password="secret-test-123")
        self.doctor_user = User.objects.create_user(username="eta11-doctor", password="secret-test-123")
        self.site = Establishment.objects.create(name="Centre ETA-11", status="active")
        self.other_site = Establishment.objects.create(name="Autre Centre ETA-11", status="active")
        EstablishmentAdministrator.objects.create(establishment=self.site, user=self.admin_user, assigned_by=self.staff)
        EstablishmentAdministrator.objects.create(establishment=self.other_site, user=self.other_user, assigned_by=self.staff)
        self.doctor = ProfessionalProfile.objects.create(
            user=self.doctor_user,
            professional_title="Médecin",
            verification_status="verified",
            active_establishment=self.site,
        )
        self.membership = EstablishmentMembership.objects.create(
            establishment=self.site, professional=self.doctor, status="active"
        )
        self.url = f"/api/v1/establishments/{self.site.id}/memberships/{self.membership.id}/medical-referent/"
        self.admin = APIClient()
        self.admin.force_authenticate(self.admin_user)

    def test_active_administrator_can_designate_verified_active_doctor_and_notifies(self):
        with patch("apps.care.push.send_push_to_user") as push:
            response = self.admin.post(self.url, {"is_medical_referent": True}, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        self.membership.refresh_from_db()
        self.assertTrue(self.membership.is_medical_referent)
        event = AuditEvent.objects.get(event_type="establishment.medical_referent_changed")
        self.assertEqual(event.actor_id, self.admin_user.id)
        self.assertEqual(event.metadata["membership_id"], str(self.membership.id))
        self.assertTrue(event.metadata["is_medical_referent"])
        push.assert_called_once()
        self.assertEqual(push.call_args.args[0], self.doctor_user.id)
        self.assertEqual(push.call_args.kwargs["kind"], "establishment.medical_referent_changed")

    def test_removing_referent_preserves_approved_template_relationship(self):
        self.membership.is_medical_referent = True
        self.membership.save(update_fields=("is_medical_referent",))
        response = self.admin.post(self.url, {"is_medical_referent": False}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.membership.refresh_from_db()
        self.assertFalse(self.membership.is_medical_referent)
        self.assertEqual(AuditEvent.objects.filter(event_type="establishment.medical_referent_changed").count(), 1)

    def test_only_active_administrator_can_change_role(self):
        other = APIClient()
        other.force_authenticate(self.other_user)
        self.assertEqual(other.post(self.url, {"is_medical_referent": True}, format="json").status_code, 403)

    def test_membership_must_be_in_admin_establishment_active_and_verified(self):
        outsider = ProfessionalProfile.objects.create(
            user=User.objects.create_user(username="eta11-outsider", password="secret-test-123"),
            professional_title="Médecin",
            verification_status="verified",
        )
        outsider_membership = EstablishmentMembership.objects.create(
            establishment=self.other_site, professional=outsider, status="active"
        )
        self.assertEqual(
            self.admin.post(
                f"/api/v1/establishments/{self.site.id}/memberships/{outsider_membership.id}/medical-referent/",
                {"is_medical_referent": True},
                format="json",
            ).status_code,
            404,
        )

        self.membership.status = "suspended"
        self.membership.save(update_fields=("status",))
        self.assertEqual(self.admin.post(self.url, {"is_medical_referent": True}, format="json").status_code, 404)

        self.membership.status = "active"
        self.membership.save(update_fields=("status",))
        self.doctor.verification_status = "pending"
        self.doctor.save(update_fields=("verification_status",))
        self.assertEqual(self.admin.post(self.url, {"is_medical_referent": True}, format="json").status_code, 404)

    def test_value_must_be_strict_boolean_and_admin_cannot_self_designate(self):
        invalid = self.admin.post(self.url, {"is_medical_referent": "true"}, format="json")
        self.assertEqual(invalid.status_code, 400)

        self_profile = ProfessionalProfile.objects.create(
            user=self.admin_user,
            professional_title="Médecin administrateur",
            verification_status="verified",
        )
        self_membership = EstablishmentMembership.objects.create(
            establishment=self.site, professional=self_profile, status="active"
        )
        response = self.admin.post(
            f"/api/v1/establishments/{self.site.id}/memberships/{self_membership.id}/medical-referent/",
            {"is_medical_referent": True},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self_membership.refresh_from_db()
        self.assertFalse(self_membership.is_medical_referent)

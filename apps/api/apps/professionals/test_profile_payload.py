from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.establishments.models import Establishment, EstablishmentMembership
from apps.identity.models import AccountContext
from .models import ProfessionalProfile

User = get_user_model()


class ProfessionalProfilePayloadTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="admin", password="local-test-password")
        self.site = Establishment.objects.create(created_by=self.admin, name="Centre fictif", establishment_type="Centre", city="Abidjan", address="A", phone="0", email="c@example.test", responsible_name="R", status="active")
        self.user = User.objects.create_user(username="doc", email="doc@example.test", password="local-test-password")
        self.profile = ProfessionalProfile.objects.create(user=self.user, professional_title="Médecin")
        AccountContext.objects.create(user=self.user, role="professional", is_active=True, onboarding_completed=True)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_profile_payload_never_exposes_identifier_or_platform_verification_status(self):
        EstablishmentMembership.objects.create(establishment=self.site, professional=self.profile, status="pending")
        data = self.client.get("/api/v1/professionals/me/").data["data"]
        self.assertEqual(data["memberships"][0]["status"], "pending")
        self.assertEqual(data["memberships"][0]["establishment_name"], "Centre fictif")
        self.assertFalse(data["clinical_access"]["allowed"])
        self.assertTrue(data["clinical_access"]["reason"])
        self.assertNotIn("professional_identifier", data)
        self.assertNotIn("verification_status", data)
        self.assertNotIn("internal_code", str(data))

    def test_membership_and_active_site_are_sufficient_without_global_verification(self):
        EstablishmentMembership.objects.create(establishment=self.site, professional=self.profile, status="active")
        self.profile.active_establishment = self.site
        self.profile.save(update_fields=("active_establishment", "updated_at"))
        self.user.refresh_from_db()
        self.client.force_authenticate(self.user)
        data = self.client.get("/api/v1/professionals/me/").data["data"]
        self.assertTrue(data["clinical_access"]["allowed"], data["clinical_access"])
        self.assertIsNone(data["clinical_access"]["reason"])

    def test_custom_declared_specialty_is_added_to_selectable_list_and_identifier_is_ignored(self):
        response = self.client.patch(
            "/api/v1/professionals/onboarding/",
            {"specialty": "Médecin du sommeil", "professional_identifier": "IDENTIFIANT-SECRET"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["specialty"], "Médecin du sommeil")
        self.assertNotIn("professional_identifier", response.data["data"])
        self.assertNotIn("verification_status", response.data["data"])
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.professional_identifier, "")
        options = self.client.get("/api/v1/professionals/specialties/")
        self.assertEqual(options.status_code, 200)
        self.assertIn("Médecin du sommeil", options.data["data"])

    def test_post_onboarding_is_accepted_for_compatibility(self):
        response = self.client.post("/api/v1/professionals/onboarding/", {"specialty": "Cardiologie"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["specialty"], "Cardiologie")

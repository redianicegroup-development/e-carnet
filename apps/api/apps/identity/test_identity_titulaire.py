"""Identité du titulaire : profession facultative, et effacement complet à la suppression du compte."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.care.models import CareEncounter
from apps.patients.models import PatientProfile

User = get_user_model()


class TitulaireIdentityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.post("/api/v1/identity/register/", {"email": "titulaire@example.test", "password": "a-long-local-password", "first_name": "Awa", "last_name": "Test"}, format="json")

    def test_onboarding_stores_the_optional_profession(self):
        response = self.client.patch("/api/v1/identity/onboarding/patient/", {"phone": "+22500000000", "address": "BP 12 Abidjan", "profession": "Couturière", "birth_date": "", "coverage_expiry": ""}, format="json")
        self.assertEqual(response.status_code, 200)
        profile = PatientProfile.objects.get(user__email="titulaire@example.test")
        self.assertEqual((profile.address, profile.profession), ("BP 12 Abidjan", "Couturière"))
        shown = self.client.get("/api/v1/patient/profile/")
        self.assertEqual(shown.data["data"]["profession"], "Couturière")
        self.assertIn("created_at", shown.data["data"])

    def test_onboarding_without_profession_still_completes(self):
        response = self.client.patch("/api/v1/identity/onboarding/patient/", {"phone": "+22500000000", "birth_date": "", "coverage_expiry": ""}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(PatientProfile.objects.get(user__email="titulaire@example.test").profession, "")

    def test_account_deletion_clears_the_profession_and_the_draft_vitals(self):
        user = User.objects.get(email="titulaire@example.test")
        profile, _ = PatientProfile.objects.get_or_create(user=user)
        profile.profession = "Couturière"
        profile.save(update_fields=("profession",))
        encounter = CareEncounter.objects.create(patient=profile, reason="Fièvre", status="draft", vitals={"weight_kg": 61.0})
        self.client.force_authenticate(user)
        created = self.client.post("/api/v1/identity/me/account-requests/", {"request_type": "deletion", "reason": "other", "details": "Je souhaite préciser mon motif."}, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        profile.refresh_from_db()
        encounter.refresh_from_db()
        self.assertEqual(profile.profession, "")
        self.assertEqual(encounter.vitals, {})

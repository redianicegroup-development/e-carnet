from datetime import timedelta
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from apps.audit.models import AuditEvent
from apps.care.models import PatientNotification
from .models import PatientEmergencyCard, PatientProfile, TrustedContactDelegation
User = get_user_model()

@override_settings(ECARNET_TRUSTED_CONTACTS_ENABLED=True)
class TrustedContactDelegationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="delegation-owner", email="owner@example.test", password="long-password")
        self.delegate = User.objects.create_user(username="delegation-close", email="close@example.test", password="long-password")
        self.profile = PatientProfile.objects.create(user=self.owner, first_name="Awa", last_name="Patient")
        PatientProfile.objects.create(user=self.delegate, first_name="Proche", last_name="Test")
        self.owner_client = APIClient(); self.owner_client.force_authenticate(self.owner)
        self.delegate_client = APIClient(); self.delegate_client.force_authenticate(self.delegate)

    def invite(self):
        response = self.owner_client.post("/api/v1/patient/delegations/", {"email": self.delegate.email, "relationship_label": "ami", "duration_days": 30}, format="json")
        self.assertEqual(response.status_code, 201)
        return response.data["data"]["join_code"], TrustedContactDelegation.objects.get(patient=self.profile)

    def test_join_code_creates_link_and_only_emergency_card_is_readable(self):
        code, delegation = self.invite()
        self.assertNotIn(code, TrustedContactDelegation.objects.get(pk=delegation.pk).token_hash)
        self.assertEqual(self.delegate_client.post("/api/v1/patient/delegations/redeem/", {"code": code}, format="json").status_code, 200)
        self.assertEqual(self.delegate_client.post(f"/api/v1/patient/delegations/{delegation.id}/select/").status_code, 200)
        self.assertEqual(self.delegate_client.get("/api/v1/patient/emergency-card/").status_code, 200)
        for path in ("/api/v1/patient/profile/", "/api/v1/patient/record-views/", "/api/v1/patient/declarations/", "/api/v1/patient/representations/"):
            with self.subTest(path=path):
                self.assertEqual(self.delegate_client.get(path).status_code, 403)
        self.assertEqual(self.delegate_client.patch("/api/v1/patient/emergency-card/", {"qr_enabled": True}, format="json").status_code, 403)
        self.assertFalse(self.delegate_client.get("/api/v1/patient/emergency-card/").data["data"].get("qr_token"))
        self.assertTrue(AuditEvent.objects.filter(event_type="delegation.accessed", actor=self.delegate, patient=self.profile).exists())
        self.assertEqual(PatientNotification.objects.filter(kind="delegation.accessed", patient=self.profile).count(), 1)
        self.assertEqual(self.owner_client.post(f"/api/v1/patient/delegations/{delegation.id}/revoke/").status_code, 200)
        self.assertEqual(self.delegate_client.get("/api/v1/patient/emergency-card/").status_code, 403)

    def test_join_code_is_single_use_and_requires_a_patient_profile(self):
        code, _ = self.invite()
        self.assertEqual(self.delegate_client.post("/api/v1/patient/delegations/redeem/", {"code": code}, format="json").status_code, 200)
        self.assertEqual(self.delegate_client.post("/api/v1/patient/delegations/redeem/", {"code": code}, format="json").status_code, 404)
        other = User.objects.create_user(username="no-patient-profile", email="other@example.test", password="long-password")
        client = APIClient(); client.force_authenticate(other)
        code2, _ = self.invite_for("another@example.test")
        self.assertEqual(client.post("/api/v1/patient/delegations/redeem/", {"code": code2}, format="json").status_code, 409)

    def invite_for(self, email):
        response = self.owner_client.post("/api/v1/patient/delegations/", {"email": email, "relationship_label": "ami", "duration_days": 30}, format="json")
        self.assertEqual(response.status_code, 201)
        return response.data["data"]["join_code"], TrustedContactDelegation.objects.latest("created_at")

    def test_expiration_and_three_active_limit(self):
        for index in range(3):
            close = User.objects.create_user(username=f"close-{index}", email=f"close-{index}@example.test", password="long-password")
            PatientProfile.objects.create(user=close, first_name="Close")
            code, item = self.invite_for(close.email)
            client = APIClient(); client.force_authenticate(close)
            self.assertEqual(client.post("/api/v1/patient/delegations/redeem/", {"code": code}, format="json").status_code, 200)
        response = self.owner_client.post("/api/v1/patient/delegations/", {"email": "fourth@example.test", "relationship_label": "ami", "duration_days": 30}, format="json")
        self.assertEqual(response.status_code, 409)
        item = TrustedContactDelegation.objects.filter(patient=self.profile).first()
        item.expires_at = timezone.now() - timedelta(minutes=1); item.save(update_fields=("expires_at",))
        self.assertEqual(self.owner_client.get("/api/v1/patient/delegations/").status_code, 200)

    @override_settings(ECARNET_TRUSTED_CONTACTS_ENABLED=False)
    def test_feature_flag_is_closed_by_default(self):
        self.assertEqual(self.owner_client.get("/api/v1/patient/delegations/").status_code, 404)
        self.assertEqual(self.delegate_client.post("/api/v1/patient/delegations/redeem/", {"code": "ECM-PROCHE-NOPE"}, format="json").status_code, 404)

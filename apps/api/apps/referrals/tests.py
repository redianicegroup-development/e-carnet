from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from apps.care.models import Consultation
from apps.establishments.models import Establishment, EstablishmentMembership
from apps.identity.models import AccountContext
from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile
from .models import CareReferral, CareSnapshot

User = get_user_model()


@override_settings(ECARNET_TRUSTED_CONTACTS_ENABLED=True, ECARNET_REFERRALS_ENABLED=True)
class ReferralFlowTests(TestCase):
    def setUp(self):
        self.patient_user = User.objects.create_user(username="c1-patient", password="password-long")
        self.patient = PatientProfile.objects.create(user=self.patient_user, first_name="Patient", last_name="C1")
        self.doctor_user = User.objects.create_user(username="c1-doctor", password="password-long")
        AccountContext.objects.create(user=self.doctor_user, role="professional", is_active=True)
        self.source = Establishment.objects.create(name="Structure A", status="active")
        self.destination = Establishment.objects.create(name="Structure B", status="active")
        self.doctor = ProfessionalProfile.objects.create(user=self.doctor_user, professional_title="Médecin", active_establishment=self.source)
        EstablishmentMembership.objects.create(establishment=self.source, professional=self.doctor, status="active")
        self.consultation = Consultation.objects.create(patient=self.patient, professional=self.doctor, establishment=self.source, professional_name="Dr C1", facility_label=self.source.name, reason="Avis", validated_at=timezone.now())
        self.doctor_client = APIClient(); self.doctor_client.force_authenticate(self.doctor_user)
        self.patient_client = APIClient(); self.patient_client.force_authenticate(self.patient_user)

    def test_patient_selects_item_and_destination_reads_immutable_snapshot(self):
        created = self.doctor_client.post("/api/v1/referrals/", {"patient_id": str(self.patient.id), "to_establishment_id": str(self.destination.id), "reason_category": "avis_specialise", "items": [{"record_type": "consultation", "record_id": str(self.consultation.id)}]}, format="json")
        self.assertEqual(created.status_code, 201)
        referral_id = created.data["data"]["id"]
        self.assertEqual(self.doctor_client.post(f"/api/v1/referrals/{referral_id}/send/").status_code, 200)
        pending = self.patient_client.get("/api/v1/patient/referrals/")
        self.assertEqual(pending.status_code, 200)
        item_id = pending.data["data"][0]["items"][0]["id"]
        accepted = self.patient_client.post(f"/api/v1/referrals/patient/{referral_id}/accept/", {"item_ids": [item_id], "duration_days": 7}, format="json")
        self.assertEqual(accepted.status_code, 200)
        self.assertTrue(CareSnapshot.objects.filter(referral_id=referral_id).exists())
        destination_user = User.objects.create_user(username="c1-destination", password="password-long")
        AccountContext.objects.create(user=destination_user, role="professional", is_active=True)
        destination_professional = ProfessionalProfile.objects.create(user=destination_user, professional_title="Médecin", active_establishment=self.destination)
        EstablishmentMembership.objects.create(establishment=self.destination, professional=destination_professional, status="active")
        destination_client = APIClient(); destination_client.force_authenticate(destination_user)
        self.assertEqual(destination_client.get(f"/api/v1/establishments/{self.destination.id}/referrals/inbox/").status_code, 200)
        self.assertEqual(destination_client.post(f"/api/v1/referrals/{referral_id}/open/").status_code, 200)
        snapshot = destination_client.get(f"/api/v1/referrals/{referral_id}/snapshot/")
        self.assertEqual(snapshot.status_code, 200)
        self.assertEqual(snapshot.data["data"]["items"][0]["record_id"], str(self.consultation.id))
        self.assertEqual(snapshot.headers["Cache-Control"], "no-store")
        self.assertEqual(self.patient_client.post(f"/api/v1/referrals/patient/{referral_id}/revoke/").status_code, 200)
        self.assertEqual(destination_client.get(f"/api/v1/referrals/{referral_id}/snapshot/").status_code, 404)

    @override_settings(ECARNET_REFERRALS_ENABLED=False)
    def test_referrals_are_closed_by_default(self):
        self.assertEqual(self.doctor_client.post("/api/v1/referrals/", {}).status_code, 404)
        self.assertEqual(self.patient_client.get("/api/v1/patient/referrals/").status_code, 404)

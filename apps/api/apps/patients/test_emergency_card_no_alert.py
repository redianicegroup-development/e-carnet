from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.care.models import PatientNotification
from .models import PatientEmergencyCard, PatientProfile
from .views import qr_signature

User = get_user_model()


class PublicEmergencyCardNoAlertTests(TestCase):
    """PAT-20 : la carte d'urgence est publique (déclarations du patient, confirmées ou non). Sa consultation ne déclenche aucune alerte."""

    def test_viewing_the_public_card_sends_no_alert_to_the_patient(self):
        user = User.objects.create_user(username="urgence-patient", password="password")
        profile = PatientProfile.objects.create(user=user)
        card = PatientEmergencyCard.objects.create(patient=profile, qr_enabled=True)
        token = f"{card.id}.{card.qr_version}.{qr_signature(card.id, card.qr_version)}"
        response = APIClient().get(f"/api/v1/patient/emergency-card/qr/{token}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(PatientNotification.objects.filter(patient=profile).exists())

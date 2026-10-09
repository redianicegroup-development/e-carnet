from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
import unittest

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile
from apps.establishments.models import Establishment
from .models import AccessGrant

User = get_user_model()


@unittest.skipUnless(connection.vendor == "postgresql", "Ce test de verrouillage exige PostgreSQL.")
class RevocationExtensionConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.user = User.objects.create_user(username="grant-race", email="grant-race@example.test", password="local-test-password")
        self.patient = PatientProfile.objects.create(user=self.user)
        doctor = User.objects.create_user(username="grant-race-doctor", email="grant-race-doctor@example.test", password="a-long-local-password")
        professional = ProfessionalProfile.objects.create(user=doctor, professional_title="Médecin")
        establishment = Establishment.objects.create(
            created_by=self.user,
            name="Clinique de concurrence",
            establishment_type="Clinique",
            city="Abidjan",
            address="Adresse fictive",
            phone="00000000",
            email="race-clinic@example.test",
            responsible_name="Responsable fictif",
            status="active",
        )
        now = timezone.now()
        self.grant = AccessGrant.objects.create(
            patient=self.patient,
            professional=professional,
            establishment=establishment,
            professional_name="Médecin fictif",
            facility_label="Établissement fictif",
            scope=["preconsultation"],
            status="active",
            starts_at=now,
            expires_at=now + timedelta(hours=1),
        )

    def test_concurrent_extend_cannot_resurrect_or_overwrite_revoke(self):
        barrier = Barrier(2)
        user_id = self.user.pk
        grant_id = self.grant.pk

        def request_action(action):
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(User.objects.get(pk=user_id))
                barrier.wait(timeout=10)
                response = client.post(f"/api/v1/patient/care/access-grants/{grant_id}/{action}/", {}, format="json")
                return response.status_code
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            extend_future = pool.submit(request_action, "extend")
            revoke_future = pool.submit(request_action, "revoke")
            extend_status = extend_future.result(timeout=20)
            revoke_status = revoke_future.result(timeout=20)

        self.grant.refresh_from_db()
        self.assertEqual(revoke_status, 200)
        self.assertIn(extend_status, (200, 409))
        self.assertEqual(self.grant.status, "revoked")
        self.assertIsNotNone(self.grant.revoked_at)
        self.assertEqual(self.grant.extension_count, 1 if extend_status == 200 else 0)
        self.assertEqual(AccessGrant.objects.get(pk=grant_id).status, "revoked")

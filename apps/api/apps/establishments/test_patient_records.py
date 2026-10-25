from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.care.models import CareEncounter, Consultation
from apps.patients.models import PatientProfile

from .models import Establishment, EstablishmentAdministrator

User = get_user_model()


class EstablishmentPatientRecordsTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="records-staff", password="test-password-123", is_staff=True)
        self.admin = User.objects.create_user(username="records-admin", password="test-password-123")
        self.outsider = User.objects.create_user(username="records-outsider", password="test-password-123")
        self.establishment = Establishment.objects.create(name="Clinique locale", status="active")
        self.other_establishment = Establishment.objects.create(name="Clinique distante", status="active")
        EstablishmentAdministrator.objects.create(
            establishment=self.establishment,
            user=self.admin,
            assigned_by=self.staff,
            status="active",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.url = f"/api/v1/establishments/{self.establishment.id}/patient-records/"

    def patient(self, username):
        user = User.objects.create_user(username=username, password="test-password-123")
        return PatientProfile.objects.create(user=user, first_name=username, birth_date=date(1990, 1, 1))

    def encounter(self, patient, establishment, reason):
        return CareEncounter.objects.create(
            patient=patient,
            establishment=establishment,
            reason=reason,
            status="closed",
            closed_at=timezone.now(),
        )

    def consultation(self, patient, establishment, reason):
        return Consultation.objects.create(
            patient=patient,
            establishment=establishment,
            professional_name="Médecin test",
            facility_label=establishment.name,
            reason=reason,
            validated_at=timezone.now(),
        )

    def test_admin_sees_only_records_linked_to_their_establishment(self):
        local_patient = self.patient("patient-local")
        remote_only_patient = self.patient("patient-remote-only")
        self.encounter(local_patient, self.establishment, "Pré-consultation locale")
        self.consultation(local_patient, self.establishment, "Consultation locale")
        self.consultation(local_patient, self.other_establishment, "Consultation distante")
        self.encounter(remote_only_patient, self.other_establishment, "Pré-consultation distante")

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], str(local_patient.id))
        self.assertEqual(data[0]["first_name"], "patient-local")
        self.assertEqual([item["reason"] for item in data[0]["encounters"]], ["Pré-consultation locale"])
        self.assertEqual([item["reason"] for item in data[0]["consultations"]], ["Consultation locale"])
        self.assertEqual(
            AuditEvent.objects.filter(
                event_type="clinical_data.read",
                actor=self.admin,
                establishment=self.establishment,
                patient=local_patient,
            ).count(),
            1,
        )
        self.assertFalse(AuditEvent.objects.filter(patient=remote_only_patient).exists())

    def test_admin_cannot_read_records_for_another_establishment(self):
        response = self.client.get(
            f"/api/v1/establishments/{self.other_establishment.id}/patient-records/"
        )

        self.assertEqual(response.status_code, 403)

    def test_non_administrator_cannot_read_establishment_records(self):
        self.client.force_authenticate(self.outsider)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 403)

    def test_suspended_establishment_admin_cannot_read_records(self):
        self.establishment.status = "suspended"
        self.establishment.save(update_fields=("status",))

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 403)

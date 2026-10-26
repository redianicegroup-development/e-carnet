from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.establishments.models import Establishment
from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile
from .establishment_records import establishment_care_records
from .models import AccessGrant, CareEncounter, Consultation, HealthMeasurement, MedicalDocument, Vaccination
from .tests import make_clinic_doctor, make_grant

User = get_user_model()
MEASUREMENT_URL = "/api/v1/patient/care/professional/access-grants/{}/measurements/"


class ProfessionalMeasurementCreateTests(TestCase):
    def setUp(self):
        self.patient_user = User.objects.create_user(username="a1-measurement-patient", password="local-test-password")
        self.patient = PatientProfile.objects.create(user=self.patient_user)
        self.doctor, self.profile, self.establishment = make_clinic_doctor(self.patient_user, "a1measurement")
        self.grant = make_grant(self.patient, self.profile, self.establishment, ["preconsultation"])
        self.client = APIClient()
        self.client.force_authenticate(self.doctor)

    def test_measurement_is_attributed_by_server_and_source_is_forced(self):
        other_establishment = Establishment.objects.create(created_by=self.patient_user, name="Autre clinique", status="active")
        response = self.client.post(
            MEASUREMENT_URL.format(self.grant.id),
            {
                "kind": "weight",
                "value": "68.4",
                "unit": "kg",
                "source": "declared",
                "patient_id": "00000000-0000-0000-0000-000000000001",
                "establishment_id": str(other_establishment.id),
                "professional_id": "00000000-0000-0000-0000-000000000002",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        item = HealthMeasurement.objects.get()
        self.assertEqual(item.patient_id, self.patient.id)
        self.assertEqual(item.establishment_id, self.establishment.id)
        self.assertEqual(item.professional_id, self.profile.id)
        self.assertEqual(item.source, "measured")
        self.assertIsNotNone(item.validated_at)
        self.assertEqual(response.data["data"]["establishment_id"], str(self.establishment.id))
        self.assertEqual(response.data["data"]["professional_id"], str(self.profile.id))
        self.assertEqual(response.data["data"]["source"], "measured")
        self.assertTrue(AuditEvent.objects.filter(
            event_type="establishment_record.measurement_created",
            patient=self.patient,
            establishment=self.establishment,
            access_grant=self.grant,
        ).exists())

    def test_measurement_requires_patient_granted_active_preconsultation_scope(self):
        self.grant.scope = ["declarations"]
        self.grant.save(update_fields=("scope",))

        response = self.client.post(
            MEASUREMENT_URL.format(self.grant.id),
            {"kind": "weight", "value": "68.4", "unit": "kg"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(HealthMeasurement.objects.count(), 0)


class EstablishmentCareRecordsTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="a1-record-owner", password="local-test-password")
        self.patient = PatientProfile.objects.create(user=self.owner)
        self.other_patient = PatientProfile.objects.create()
        self.professional_user = User.objects.create_user(username="a1-record-doctor", password="local-test-password")
        self.professional = ProfessionalProfile.objects.create(user=self.professional_user, professional_title="Médecin")
        self.establishment = Establishment.objects.create(created_by=self.owner, name="Clinique A1", status="active")
        self.other_establishment = Establishment.objects.create(created_by=self.owner, name="Clinique autre", status="active")
        self.now = timezone.now()

    def test_service_only_returns_current_patients_validated_records_from_requested_establishment(self):
        closed = CareEncounter.objects.create(patient=self.patient, establishment=self.establishment, status="closed", closed_at=self.now, facility_label=self.establishment.name)
        CareEncounter.objects.create(patient=self.patient, establishment=self.establishment, status="draft")
        CareEncounter.objects.create(patient=self.patient, establishment=self.other_establishment, status="closed", closed_at=self.now)
        consultation = Consultation.objects.create(patient=self.patient, professional=self.professional, establishment=self.establishment, professional_name="Médecin", facility_label=self.establishment.name, reason="Suivi", validated_at=self.now)
        Consultation.objects.create(patient=self.patient, professional=self.professional, establishment=self.other_establishment, professional_name="Médecin", facility_label=self.other_establishment.name, reason="Autre", validated_at=self.now)
        measurement = HealthMeasurement.objects.create(patient=self.patient, establishment=self.establishment, professional=self.professional, validated_at=self.now, kind="weight", value=Decimal("68.40"), unit="kg", measured_at=self.now)
        HealthMeasurement.objects.create(patient=self.patient, kind="weight", value=Decimal("70.00"), unit="kg", measured_at=self.now)
        HealthMeasurement.objects.create(patient=self.other_patient, establishment=self.establishment, professional=self.professional, validated_at=self.now, kind="weight", value=Decimal("60.00"), unit="kg", measured_at=self.now)
        document = MedicalDocument.objects.create(patient=self.patient, establishment=self.establishment, professional=self.professional, validated_at=self.now, original_name="résultat.pdf", document_type="analysis", content_type="application/pdf", size_bytes=10, verified=True)
        MedicalDocument.objects.create(patient=self.patient, original_name="import-patient.pdf", document_type="analysis", content_type="application/pdf", size_bytes=10, verified=False)
        MedicalDocument.objects.create(patient=self.patient, establishment=self.establishment, professional=self.professional, validated_at=self.now, original_name="non-vérifié.pdf", document_type="analysis", content_type="application/pdf", size_bytes=10, verified=False)
        vaccination = Vaccination.objects.create(patient=self.patient, establishment=self.establishment, confirmed_by=self.professional, confirmed_at=self.now, vaccine_name="BCG", status="confirmed")
        Vaccination.objects.create(patient=self.patient, vaccine_name="Vaccin déclaré", status="declared")
        Vaccination.objects.create(patient=self.patient, establishment=self.other_establishment, confirmed_by=self.professional, confirmed_at=self.now, vaccine_name="Vaccin autre clinique", status="confirmed")

        records = establishment_care_records(self.patient, self.establishment)

        self.assertEqual(list(records.preconsultations), [closed])
        self.assertEqual(list(records.consultations), [consultation])
        self.assertEqual(list(records.measurements), [measurement])
        self.assertEqual(list(records.documents), [document])
        self.assertEqual(list(records.vaccinations), [vaccination])

    def test_check_constraints_reject_establishment_without_professional_or_validation_date(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                HealthMeasurement.objects.create(patient=self.patient, establishment=self.establishment, kind="weight", value=Decimal("68"), unit="kg", measured_at=self.now)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                MedicalDocument.objects.create(patient=self.patient, establishment=self.establishment, original_name="invalide.pdf", content_type="application/pdf", size_bytes=1)

        measurement = HealthMeasurement.objects.create(patient=self.patient, establishment=self.establishment, professional=self.professional, validated_at=self.now, kind="weight", value=Decimal("68"), unit="kg", measured_at=self.now)
        document = MedicalDocument.objects.create(patient=self.patient, establishment=self.establishment, professional=self.professional, validated_at=self.now, original_name="valide.pdf", content_type="application/pdf", size_bytes=1, verified=True)
        self.assertEqual(measurement.establishment_id, self.establishment.id)
        self.assertEqual(document.establishment_id, self.establishment.id)

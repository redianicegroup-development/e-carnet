from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.patients.models import PatientProfile
from .models import HealthMeasurement

User = get_user_model()
URL = "/api/v1/patient/care/measurements/"


class PatientHealthMeasurementsV2Tests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="measurements-v2", password="local-test-password")
        self.patient = PatientProfile.objects.create(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.measured_at = timezone.now().isoformat()

    def post(self, **payload):
        return self.client.post(URL, {"measured_at": self.measured_at, **payload}, format="json")

    def test_tension_and_glycemia_are_saved_verbatim_without_forced_units(self):
        for kind, value in (("blood_pressure", "12/8"), ("glycemia", "5,2 mmol/L")):
            response = self.post(kind=kind, value=value, source="declared")
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.data["data"]["value"], value)
            item = HealthMeasurement.objects.get(kind=kind)
            self.assertEqual(item.raw_value, value)
            self.assertIsNone(item.value)
            self.assertEqual(item.unit, "")
            self.assertEqual(item.source, "declared")

    def test_free_text_accepts_a_written_value_but_not_text_without_any_number(self):
        response = self.post(kind="blood_pressure", value="180/120 (valeur recopiée)")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["data"]["value"], "180/120 (valeur recopiée)")
        self.assertEqual(self.post(kind="glycemia", value="mmol/L").status_code, 400)
        self.assertEqual(self.post(kind="blood_pressure", value="x" * 33).status_code, 400)

    def test_other_numeric_measurements_keep_explicit_units_and_technical_ranges(self):
        for kind, value, unit in (("weight", "61,5", "kg"), ("height", "165", "cm"), ("temperature", "38,5", "°C"), ("heart_rate", "88", "bpm"), ("spo2", "98", "%")):
            response = self.post(kind=kind, value=value, unit=unit)
            self.assertEqual(response.status_code, 201, kind)
            measurement = HealthMeasurement.objects.get(kind=kind)
            self.assertIsNotNone(measurement.value)
            self.assertEqual(measurement.raw_value, "")
            self.assertEqual(measurement.unit, unit)
        self.assertEqual(self.post(kind="spo2", value="140", unit="%").status_code, 400)
        self.assertEqual(self.post(kind="weight", value="61", unit="lb").status_code, 400)

    def test_old_split_blood_pressure_kinds_are_not_accepted_for_new_records(self):
        response = self.post(kind="blood_pressure_systolic", value="120", unit="mmHg")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(HealthMeasurement.objects.exists())

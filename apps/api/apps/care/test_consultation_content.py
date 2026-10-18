"""Constantes, diagnostic, ordonnance et examens demandés : du brouillon du patient à la consultation signée."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.patients.models import PatientProfile
from .models import CareEncounter, Consultation, ConsultationRevision, ExamRequest, PrescriptionLine
from .tests import make_clinic_doctor, make_grant

User = get_user_model()
ENCOUNTERS = "/api/v1/patient/care/encounters/"
SIGN = "/api/v1/patient/care/professional/consultations/"
HISTORY = "/api/v1/patient/care/consultations/"


class PreconsultationVitalsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="patient-vitals", password="local-test-password")
        self.profile = PatientProfile.objects.create(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_vitals_are_saved_and_every_key_is_returned_even_when_not_measured(self):
        response = self.client.post(ENCOUNTERS, {"reason": "Fièvre", "vitals": {"weight_kg": 61, "temperature_c": 38.54, "blood_pressure": "12/8", "glycemia": "5,2 mmol/L"}}, format="json")
        self.assertEqual(response.status_code, 201)
        vitals = response.data["data"]["vitals"]
        self.assertEqual(vitals["weight_kg"], 61.0)
        self.assertEqual(vitals["temperature_c"], 38.5)
        self.assertEqual(vitals["blood_pressure"], "12/8")
        self.assertEqual(vitals["glycemia"], "5,2 mmol/L")
        self.assertIsNone(vitals["spo2"])
        self.assertEqual(CareEncounter.objects.get().vitals, {"weight_kg": 61.0, "temperature_c": 38.5, "blood_pressure": "12/8", "glycemia": "5,2 mmol/L"})

    def test_a_pre_consultation_without_vitals_stays_valid(self):
        response = self.client.post(ENCOUNTERS, {"reason": "Contrôle"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(CareEncounter.objects.get().vitals, {})

    def test_implausible_numeric_values_and_uninformative_text_are_refused(self):
        for vitals in ({"temperature_c": 3.7}, {"weight_kg": 610}, {"spo2": 140}, {"blood_pressure": "mmHg"}, {"glycemia": "x" * 25}, "chaud"):
            response = self.client.post(ENCOUNTERS, {"reason": "Fièvre", "vitals": vitals}, format="json")
            self.assertEqual(response.status_code, 400, vitals)
        self.assertFalse(CareEncounter.objects.exists())

    def test_legacy_numeric_blood_pressure_payload_is_preserved_as_text(self):
        response = self.client.post(ENCOUNTERS, {"reason": "Contrôle", "vitals": {"systolic": 110, "diastolic": 70, "glycemia_g_l": 0.9}}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(CareEncounter.objects.get().vitals, {"blood_pressure": "110/70", "glycemia": "0.9 g/L"})

    def test_patch_replaces_the_whole_set_and_null_removes_a_value(self):
        created = self.client.post(ENCOUNTERS, {"reason": "Fièvre", "vitals": {"weight_kg": 61, "heart_rate": 90}}, format="json")
        url = f"{ENCOUNTERS}{created.data['data']['id']}/"
        response = self.client.patch(url, {"vitals": {"weight_kg": 60.5, "heart_rate": None}}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(CareEncounter.objects.get().vitals, {"weight_kg": 60.5})
        untouched = self.client.patch(url, {"reason": "Fièvre persistante"}, format="json")
        self.assertEqual(untouched.status_code, 200)
        self.assertEqual(CareEncounter.objects.get().vitals, {"weight_kg": 60.5})


class SignedConsultationContentTests(TestCase):
    def setUp(self):
        self.patient_user = User.objects.create_user(username="patient-content", password="local-test-password")
        self.patient = PatientProfile.objects.create(user=self.patient_user)
        self.doctor, self.profile, self.establishment = make_clinic_doctor(self.patient_user, "content")
        self.grant = make_grant(self.patient, self.profile, self.establishment, ["preconsultation", "declarations"])
        self.encounter = CareEncounter.objects.create(
            patient=self.patient, reason="Fièvre", observations="Fièvre depuis deux jours", status="draft",
            vitals={"weight_kg": 61.0, "temperature_c": 38.5},
        )
        self.client = APIClient()
        self.client.force_authenticate(self.doctor)

    def sign(self, **extra):
        payload = {"access_grant_id": str(self.grant.id), "source_encounter_id": str(self.encounter.id), "attestation_svg": "<svg></svg>", **extra}
        return self.client.post(SIGN, payload, format="json")

    def test_content_prescription_and_exams_are_stored_in_order_with_the_signature(self):
        response = self.sign(
            symptoms="Fièvre, céphalées", clinical_exam="Abdomen douloureux à la palpation", diagnosis="Paludisme simple",
            conclusion="Traitement antipaludique", care_plan="Repos, hydratation",
            prescription_lines=[
                {"drug_name": "Artéméther-luméfantrine", "dosage": "20/120 mg", "posology": "4 cp × 2/jour", "duration": "3 jours"},
                {"drug_name": "Paracétamol", "dosage": "1 g", "posology": "1 cp × 3/jour", "duration": "5 jours", "instructions": "Après les repas"},
            ],
            requested_exams=[{"kind": "analysis", "label": "NFS"}, {"kind": "imaging", "label": "Échographie abdominale"}],
        )
        self.assertEqual(response.status_code, 201)
        consultation = Consultation.objects.get()
        self.assertEqual((consultation.symptoms, consultation.diagnosis), ("Fièvre, céphalées", "Paludisme simple"))
        self.assertEqual([line.drug_name for line in consultation.prescription_lines.all()], ["Artéméther-luméfantrine", "Paracétamol"])
        self.assertEqual(consultation.prescription_lines.last().instructions, "Après les repas")
        self.assertEqual([(exam.kind, exam.label, exam.status) for exam in consultation.exam_requests.all()], [("analysis", "NFS", "requested"), ("imaging", "Échographie abdominale", "requested")])
        revision = ConsultationRevision.objects.get(consultation=consultation)
        self.assertEqual(len(revision.snapshot["prescription_lines"]), 2)
        self.assertEqual(revision.snapshot["requested_exams"][0]["label"], "NFS")
        self.client.force_authenticate(self.patient_user)
        history = self.client.get(HISTORY).data["data"][0]
        self.assertEqual(history["diagnosis"], "Paludisme simple")
        self.assertEqual([line["posology"] for line in history["prescription_lines"]], ["4 cp × 2/jour", "1 cp × 3/jour"])
        self.assertEqual(history["exam_requests"][1]["status"], "requested")

    def test_each_vital_keeps_its_provenance(self):
        response = self.sign(vitals={"weight_kg": 61, "temperature_c": 38.9, "heart_rate": 96, "blood_pressure": "12/8"})
        self.assertEqual(response.status_code, 201)
        vitals = response.data["data"]["vitals"]
        self.assertEqual(vitals["weight_kg"], {"value": 61.0, "source": "preconsultation"})
        self.assertEqual(vitals["temperature_c"], {"value": 38.9, "source": "professional"})
        self.assertEqual(vitals["heart_rate"], {"value": 96, "source": "professional"})
        self.assertEqual(vitals["blood_pressure"], {"value": "12/8", "source": "professional"})
        self.assertIsNone(vitals["spo2"])

    def test_a_value_the_doctor_leaves_out_is_not_kept(self):
        response = self.sign(vitals={"weight_kg": 61})
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.data["data"]["vitals"]["temperature_c"])

    def test_without_a_vitals_key_the_pre_consultation_is_kept_as_it_was(self):
        response = self.sign()
        self.assertEqual(response.status_code, 201)
        vitals = response.data["data"]["vitals"]
        self.assertEqual(vitals["temperature_c"], {"value": 38.5, "source": "preconsultation"})
        self.assertEqual(vitals["weight_kg"]["source"], "preconsultation")

    def test_a_client_without_the_symptoms_block_still_gets_the_patients_text_in_observations(self):
        legacy = self.sign()
        self.assertEqual(legacy.status_code, 201)
        consultation = Consultation.objects.get()
        self.assertEqual(consultation.observations, "Fièvre depuis deux jours")
        self.assertEqual(consultation.symptoms, "")

    def test_the_symptoms_block_replaces_the_copy_into_observations(self):
        response = self.sign(symptoms="Fièvre depuis deux jours", observations="")
        self.assertEqual(response.status_code, 201)
        consultation = Consultation.objects.get()
        self.assertEqual((consultation.symptoms, consultation.observations), ("Fièvre depuis deux jours", ""))

    def test_a_bad_order_line_refuses_the_whole_signature_and_leaves_the_draft_open(self):
        too_many = [{"drug_name": f"Médicament {index}", "posology": "1 cp"} for index in range(16)]
        for extra in (
            {"prescription_lines": too_many},
            {"prescription_lines": [{"drug_name": "Paracétamol"}]},
            {"requested_exams": [{"kind": "magie", "label": "NFS"}]},
            {"vitals": {"temperature_c": 3.7}},
        ):
            self.assertEqual(self.sign(**extra).status_code, 400, extra)
        self.assertFalse(Consultation.objects.exists())
        self.assertFalse(PrescriptionLine.objects.exists())
        self.assertFalse(ExamRequest.objects.exists())
        self.encounter.refresh_from_db()
        self.assertEqual(self.encounter.status, "draft")

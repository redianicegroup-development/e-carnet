from datetime import timedelta
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from apps.audit.models import AuditEvent
from apps.care.models import Appointment, CareEncounter, PreconsultationTemplate
from apps.establishments.models import Establishment, EstablishmentAdministrator, EstablishmentMembership
from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile

User = get_user_model()
VALID_FIELDS = [{"key": "temperature", "label": "Température", "type": "number", "unit": "°C", "required": True, "options": []}, {"key": "allergy", "label": "Allergies connues", "type": "yes_no", "unit": "", "required": False, "options": []}]

class PreconsultationTemplateWorkflowTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="tmpl-staff", password="secret-test-123", is_staff=True)
        self.admin_user = User.objects.create_user(username="tmpl-admin", password="secret-test-123")
        self.establishment = Establishment.objects.create(name="Centre Template", status="active")
        self.other_establishment = Establishment.objects.create(name="Centre Autre", status="active")
        EstablishmentAdministrator.objects.create(establishment=self.establishment, user=self.admin_user, assigned_by=self.staff)
        self.admin = APIClient(); self.admin.force_authenticate(self.admin_user)
        self.base = f"/api/v1/patient/care/establishments/{self.establishment.id}/preconsultation-templates/"
        self.other_base = f"/api/v1/patient/care/establishments/{self.other_establishment.id}/preconsultation-templates/"
        self.doctor_user = User.objects.create_user(username="tmpl-doctor", password="secret-test-123")
        self.doctor = ProfessionalProfile.objects.create(user=self.doctor_user, professional_title="Médecin", verification_status="verified", active_establishment=self.establishment)
        self.membership = EstablishmentMembership.objects.create(establishment=self.establishment, professional=self.doctor, status="active")
        self.doctor_client = APIClient(); self.doctor_client.force_authenticate(self.doctor_user)
    def create_template(self, name="Admission", fields=None):
        return self.admin.post(self.base, {"name": name, "fields": fields if fields is not None else VALID_FIELDS}, format="json")
    def test_json_schema_and_duplicate_keys_are_validated(self):
        invalid = self.create_template(fields=[VALID_FIELDS[0], VALID_FIELDS[0]])
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(self.create_template().status_code, 201)
        duplicate = self.create_template()
        self.assertEqual(duplicate.status_code, 400)
        bad_choice = self.create_template("Bad choices", [{"key": "x", "label": "X", "type": "choice", "required": True, "options": []}])
        self.assertEqual(bad_choice.status_code, 400)
    def test_created_template_is_draft_until_explicit_referent_approval(self):
        created = self.create_template()
        self.assertEqual(created.status_code, 201, created.data)
        item = PreconsultationTemplate.objects.get(pk=created.data["data"]["id"])
        self.assertEqual(item.status, "draft"); self.assertFalse(item.active)
        self.assertEqual(self.doctor_client.post(f"/api/v1/patient/care/professional/preconsultation-templates/{item.id}/approve/", {"confirm_medical_review": True}, format="json").status_code, 403)
        assignment = self.admin.post(f"/api/v1/establishments/{self.establishment.id}/memberships/{self.membership.id}/medical-referent/", {"is_medical_referent": True}, format="json")
        self.assertEqual(assignment.status_code, 200)
        pending = self.doctor_client.get("/api/v1/patient/care/professional/preconsultation-templates/pending/")
        self.assertEqual(pending.status_code, 200); self.assertEqual(len(pending.data["data"]), 1)
        approved = self.doctor_client.post(f"/api/v1/patient/care/professional/preconsultation-templates/{item.id}/approve/", {"confirm_medical_review": True}, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        item.refresh_from_db(); self.assertEqual(item.status, "active"); self.assertTrue(item.active); self.assertEqual(item.approved_by_id, self.doctor.id); self.assertIsNotNone(item.approved_at)
        self.assertTrue(AuditEvent.objects.filter(event_type="preconsultation_template.medically_approved", establishment=self.establishment).exists())
        deactivated = self.admin.post(self.base + f"{item.id}/", {"action": "deactivate"}, format="json")
        self.assertEqual(deactivated.status_code, 200, deactivated.data)
        item.refresh_from_db(); self.assertEqual(item.status, "disabled"); self.assertFalse(item.active)
        self.assertTrue(AuditEvent.objects.filter(event_type="preconsultation_template.deactivated", establishment=self.establishment).exists())
    def test_isolation_and_deactivation_are_scoped(self):
        created = self.create_template(); template_id = created.data["data"]["id"]
        self.assertEqual(self.admin.get(self.other_base).status_code, 403)
        self.assertEqual(self.admin.patch(self.other_base + f"{template_id}/", {"name": "Intrusion"}, format="json").status_code, 403)
        self.assertEqual(self.admin.post(self.base + f"{template_id}/", {"action": "deactivate"}, format="json").status_code, 409)
    def test_patient_form_uses_active_template_only_for_upcoming_appointment(self):
        created = self.create_template(); item = PreconsultationTemplate.objects.get(pk=created.data["data"]["id"])
        self.admin.post(f"/api/v1/establishments/{self.establishment.id}/memberships/{self.membership.id}/medical-referent/", {"is_medical_referent": True}, format="json")
        self.doctor_client.post(f"/api/v1/patient/care/professional/preconsultation-templates/{item.id}/approve/", {"confirm_medical_review": True}, format="json")
        patient_user = User.objects.create_user(username="tmpl-patient", password="secret-test-123")
        patient = PatientProfile.objects.create(user=patient_user)
        Appointment.objects.create(patient=patient, establishment=self.establishment, reason="Consultation", starts_at=timezone.now()+timedelta(days=1), status="confirmed")
        patient_client = APIClient(); patient_client.force_authenticate(patient_user)
        templates = patient_client.get("/api/v1/patient/care/patient/preconsultation-templates/")
        self.assertEqual(templates.status_code, 200); self.assertEqual(len(templates.data["data"]), 1)
        payload = {"reason": "Fièvre", "observations": "", "vitals": {}, "preconsultation_template": str(item.id), "template_responses": {"temperature": "38.2", "allergy": True}}
        created_encounter = patient_client.post("/api/v1/patient/care/encounters/", payload, format="json")
        self.assertEqual(created_encounter.status_code, 201, created_encounter.data)
        encounter = CareEncounter.objects.get(patient=patient)
        self.assertEqual(encounter.establishment_id, self.establishment.id)
        self.assertEqual(encounter.template_responses["allergy"], True)
        self.assertEqual(encounter.preconsultation_template_id, item.id)
        self.assertEqual(patient_client.patch(f"/api/v1/patient/care/encounters/{encounter.id}/", {"template_responses": {"temperature": "invalid"}}, format="json").status_code, 400)

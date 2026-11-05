from datetime import date, timedelta
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from apps.audit.models import AuditEvent
from apps.care.models import CareEncounter, PatientNotification
from apps.establishments.models import Establishment, EstablishmentAdministrator, EstablishmentJoinCode, EstablishmentRecordOpening, EstablishmentRecordOpeningClosure
from apps.patients.models import PatientProfile

User = get_user_model()

@override_settings(ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ=True)
class EstablishmentOpeningClosureTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="eta-staff", password="test-password-123", is_staff=True)
        self.admin = User.objects.create_user(username="eta-admin", password="test-password-123", email="admin@example.test")
        self.other_admin = User.objects.create_user(username="eta-other-admin", password="test-password-123")
        self.establishment = Establishment.objects.create(name="Clinique ETA", status="active")
        self.other_establishment = Establishment.objects.create(name="Autre clinique ETA", status="active")
        EstablishmentAdministrator.objects.create(establishment=self.establishment, user=self.admin, assigned_by=self.staff)
        EstablishmentAdministrator.objects.create(establishment=self.other_establishment, user=self.other_admin, assigned_by=self.staff)
        self.patient_user = User.objects.create_user(username="eta-patient", password="test-password-123")
        self.patient = PatientProfile.objects.create(user=self.patient_user, first_name="Awa", last_name="Test", birth_date=date(1990, 1, 1))
        CareEncounter.objects.create(patient=self.patient, establishment=self.establishment, reason="local", status="closed", closed_at=timezone.now())
        self.client = APIClient(); self.client.force_authenticate(self.admin)
        self.prefix = f"/api/v1/establishments/{self.establishment.id}"
        self.opening = EstablishmentRecordOpening.objects.create(establishment=self.establishment, patient=self.patient, opened_by=self.admin, reason_category="soins_en_cours", expires_at=timezone.now()+timedelta(hours=1))
    def test_close_once_audits_notifies_and_blocks_record(self):
        response = self.client.post(f"{self.prefix}/openings/{self.opening.id}/close/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(EstablishmentRecordOpeningClosure.objects.filter(opening=self.opening).count(), 1)
        self.assertTrue(AuditEvent.objects.filter(event_type="establishment_record.closed", patient=self.patient).exists())
        self.assertTrue(PatientNotification.objects.filter(patient=self.patient, kind="establishment_record.closed").exists())
        self.assertEqual(self.client.get(f"{self.prefix}/openings/{self.opening.id}/record/").status_code, 403)
        self.assertEqual(self.client.post(f"{self.prefix}/openings/{self.opening.id}/close/", {}, format="json").status_code, 409)
    def test_closure_is_scoped_to_establishment(self):
        other_client = APIClient(); other_client.force_authenticate(self.other_admin)
        response = other_client.post(f"/api/v1/establishments/{self.other_establishment.id}/openings/{self.opening.id}/close/", {}, format="json")
        self.assertEqual(response.status_code, 404)
        self.assertFalse(EstablishmentRecordOpeningClosure.objects.exists())
    def test_any_active_admin_of_same_establishment_can_close(self):
        EstablishmentAdministrator.objects.create(establishment=self.establishment, user=self.other_admin, assigned_by=self.staff)
        other_client = APIClient(); other_client.force_authenticate(self.other_admin)
        response = other_client.post(f"{self.prefix}/openings/{self.opening.id}/close/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(EstablishmentRecordOpeningClosure.objects.get(opening=self.opening).closed_by_id, self.other_admin.id)
    def test_patient_journal_shows_open_and_closed_state(self):
        patient_client = APIClient(); patient_client.force_authenticate(self.patient_user)
        url = "/api/v1/patient/record-views/"
        response = patient_client.get(url)
        self.assertEqual(response.status_code, 200)
        opening = response.data["data"][0]["openings"][0]
        self.assertEqual(opening["status"], "ouvert")
        self.client.post(f"{self.prefix}/openings/{self.opening.id}/close/", {}, format="json")
        response = patient_client.get(url)
        self.assertEqual(response.data["data"][0]["openings"][0]["status"], "clôturé")

    def test_opening_list_contains_state_but_no_clinical_content(self):
        response = self.client.get(f"{self.prefix}/openings/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"][0]["status"], "ouvert")
        self.assertNotIn("patient", str(response.data)); self.assertNotIn("clinical", str(response.data))
    def test_switch_stays_off(self):
        with override_settings(ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ=False):
            response = self.client.post(f"{self.prefix}/patients/{self.patient.id}/openings/", {"reason_category": "urgence"}, format="json")
        self.assertEqual(response.status_code, 403)

class EstablishmentActiveCodeCountTests(TestCase):
    def test_count_excludes_used_expired_revoked_and_missing_encrypted_code(self):
        staff = User.objects.create_user(username="count-staff", password="test-password-123")
        admin = User.objects.create_user(username="count-admin", password="test-password-123")
        establishment = Establishment.objects.create(name="Codes ETA", status="active")
        EstablishmentAdministrator.objects.create(establishment=establishment, user=admin, assigned_by=staff)
        now = timezone.now()
        def code(suffix, **kwargs):
            values = {"establishment": establishment, "code_hash": suffix, "code_encrypted": "encrypted", "created_by": admin, "expires_at": now+timedelta(hours=1)}
            values.update(kwargs)
            return EstablishmentJoinCode.objects.create(**values)
        code("valid")
        code("used", consumed_at=now)
        code("expired", expires_at=now-timedelta(seconds=1))
        code("revoked", revoked_at=now)
        missing = EstablishmentJoinCode.objects.create(establishment=establishment, code_hash="missing", code_encrypted="", created_by=admin, expires_at=now+timedelta(hours=1))
        client = APIClient(); client.force_authenticate(admin)
        response = client.get(f"/api/v1/establishments/{establishment.id}/join-codes/active-count/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["data"]["count"], 1)

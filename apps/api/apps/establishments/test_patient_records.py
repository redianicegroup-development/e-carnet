from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.audit.services import record_event
from apps.care.models import CareEncounter, Consultation, HealthMeasurement, MedicalDocument, PatientNotification, Vaccination
from apps.establishments.models import Establishment, EstablishmentAdministrator, EstablishmentRecordOpening
from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile

User = get_user_model()


class EstablishmentPatientRecordsTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="records-staff", password="test-password-123", is_staff=True, first_name="Staff", last_name="Audit")
        self.admin = User.objects.create_user(username="records-admin", password="test-password-123", first_name="Ada", last_name="Admin")
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
        prefix = f"/api/v1/establishments/{self.establishment.id}"
        self.list_url = f"{prefix}/patients/"
        self.legacy_url = f"{prefix}/patient-records/"
        self.history_url = lambda patient_id: f"{prefix}/patients/{patient_id}/view-history/"
        self.opening_url = lambda patient_id: f"{prefix}/patients/{patient_id}/openings/"
        self.record_url = lambda opening_id: f"{prefix}/openings/{opening_id}/record/"

    def patient(self, username, *, first_name=None, last_name="Patient"):
        user = User.objects.create_user(username=username, password="test-password-123", first_name=first_name or username, last_name=last_name)
        return PatientProfile.objects.create(user=user, first_name=first_name or username, last_name=last_name, birth_date=date(1990, 1, 1))

    def encounter(self, patient, establishment, reason="Pré-consultation"):
        return CareEncounter.objects.create(
            patient=patient,
            establishment=establishment,
            reason=reason,
            status="closed",
            closed_at=timezone.now(),
        )

    def open(self, patient, *, category="soins_en_cours", note=None, client=None):
        payload = {"reason_category": category}
        if note is not None:
            payload["reason_note"] = note
        return (client or self.client).post(self.opening_url(patient.id), payload, format="json")

    def test_legacy_group_endpoint_returns_410_and_update_message(self):
        response = self.client.get(self.legacy_url)
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.data["code"], "client_update_required")
        self.assertIn("Actualisez l’application", response.data["message"])

    def test_patient_list_is_paginated_searchable_and_contains_no_clinical_content(self):
        local = self.patient("patient-local", first_name="Lina")
        local.last_name = "Kone"
        local.save(update_fields=("last_name",))
        remote = self.patient("patient-remote", first_name="Moussa")
        self.encounter(local, self.establishment, "Motif clinique local qui ne doit pas sortir")
        self.encounter(remote, self.other_establishment, "Motif distant")
        draft_only = self.patient("patient-draft")
        CareEncounter.objects.create(patient=draft_only, establishment=self.establishment, reason="Brouillon", status="draft")

        response = self.client.get(self.list_url, {"search": "Lina Kone", "page": "1", "page_size": "1"})

        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["total"], 1)
        self.assertEqual(len(data["items"]), 1)
        item = data["items"][0]
        self.assertEqual(item["id"], str(local.id))
        self.assertEqual(item["age"], 36)
        self.assertIsNotNone(item["last_service_at"])
        self.assertEqual(item["views_total"], 0)
        self.assertIsNone(item["last_view"])
        self.assertNotIn("birth_date", item)
        self.assertNotIn("encounters", item)
        self.assertNotIn("consultations", item)
        self.assertNotIn("diagnosis", item)
        self.assertNotIn("Motif clinique", str(response.data))
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertNotIn(str(remote.id), [row["id"] for row in data["items"]])
        self.assertNotIn(draft_only.id, [row["id"] for row in data["items"]])

    def test_opening_requires_a_closed_reason_and_note_only_for_other(self):
        patient = self.patient("patient-reasons")
        self.encounter(patient, self.establishment)
        invalid_payloads = (
            {},
            {"reason_category": "motif-inventé"},
            {"reason_category": "autre"},
            {"reason_category": "autre", "reason_note": "   "},
            {"reason_category": "soins_en_cours", "reason_note": "texte libre"},
            {"reason_category": "autre", "reason_note": "x" * 141},
        )
        for payload in invalid_payloads:
            response = self.client.post(self.opening_url(patient.id), payload, format="json")
            self.assertEqual(response.status_code, 400, (payload, response.data))
        self.assertEqual(EstablishmentRecordOpening.objects.count(), 0)
        self.assertFalse(AuditEvent.objects.filter(event_type="establishment_record.opened").exists())
        self.assertFalse(PatientNotification.objects.filter(kind="establishment_record.opened").exists())

    def test_opening_creates_one_immutable_opening_one_audit_and_patient_notice_without_free_text(self):
        patient = self.patient("patient-open")
        self.encounter(patient, self.establishment)
        before = timezone.now()

        response = self.open(patient, category="autre", note="Contrôle interne autorisé")

        self.assertEqual(response.status_code, 201, response.data)
        opening = EstablishmentRecordOpening.objects.get()
        self.assertEqual(opening.patient_id, patient.id)
        self.assertEqual(opening.establishment_id, self.establishment.id)
        self.assertEqual(opening.opened_by_id, self.admin.id)
        self.assertEqual(opening.opened_by_role, "establishment_admin")
        self.assertEqual(opening.reason_note, "Contrôle interne autorisé")
        self.assertIsNone(opening.expires_at)  # ETA-09 : aucune limite de durée tant que le motif est enregistré
        self.assertEqual(response.data["data"]["opening_id"], str(opening.id))
        opened_events = AuditEvent.objects.filter(event_type="establishment_record.opened", patient=patient)
        self.assertEqual(opened_events.count(), 1)
        event = opened_events.get()
        self.assertEqual(event.actor_id, self.admin.id)
        self.assertEqual(event.establishment_id, self.establishment.id)
        self.assertEqual(event.metadata, {"action": "opened", "reason_category": "autre", "opening_id": str(opening.id)})
        self.assertNotIn("Contrôle interne autorisé", str(event.metadata))
        notice = PatientNotification.objects.get(patient=patient, kind="establishment_record.opened")
        self.assertEqual(notice.metadata["reason_category"], "autre")
        self.assertNotIn("Contrôle interne autorisé", str(notice.metadata))
        self.assertNotIn("coalesce_key", notice.metadata)
        self.assertEqual(response["Cache-Control"], "private, no-store")
        with self.assertRaises(TypeError):
            opening.save()
        with self.assertRaises(TypeError):
            EstablishmentRecordOpening.objects.filter(pk=opening.pk).update(reason_note="modifié")

    def test_urgence_is_a_valid_reason_without_free_text(self):
        patient = self.patient("patient-urgence")
        self.encounter(patient, self.establishment)
        response = self.open(patient, category="urgence")
        self.assertEqual(response.status_code, 201, response.data)
        opening = EstablishmentRecordOpening.objects.get()
        self.assertEqual(opening.reason_category, "urgence")
        self.assertEqual(opening.reason_note, "")
        self.assertIsNone(response.data["data"]["expires_at"])
        self.assertEqual(self.open(patient, category="urgence", note="texte libre").status_code, 400)
        event = AuditEvent.objects.filter(event_type="establishment_record.opened", patient=patient).latest("created_at")
        self.assertEqual(event.metadata.get("reason_category"), "urgence")

    @override_settings(ECARNET_RECORD_OPENING_TTL_MINUTES=30)
    def test_a_configured_duration_restores_an_automatic_expiry(self):
        patient = self.patient("patient-duree")
        self.encounter(patient, self.establishment)
        before = timezone.now()
        response = self.open(patient, category="soins_en_cours")
        self.assertEqual(response.status_code, 201, response.data)
        opening = EstablishmentRecordOpening.objects.get()
        self.assertGreaterEqual((opening.expires_at - before).total_seconds(), 1799)
        self.assertLessEqual((opening.expires_at - before).total_seconds(), 1801)

    def test_repeated_openings_coalesce_only_the_patient_notification(self):
        patient = self.patient("patient-coalesce")
        self.encounter(patient, self.establishment)
        first = self.open(patient)
        second = self.open(patient)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(EstablishmentRecordOpening.objects.filter(patient=patient).count(), 2)
        self.assertEqual(AuditEvent.objects.filter(event_type="establishment_record.opened", patient=patient).count(), 2)
        notice = PatientNotification.objects.get(patient=patient, kind="establishment_record.opened")
        self.assertEqual(notice.metadata["count"], 2)

    def test_patient_without_a_closed_local_care_record_is_404_and_self_access_is_audited(self):
        remote = self.patient("patient-only-remote")
        self.encounter(remote, self.other_establishment)
        self.assertEqual(self.open(remote).status_code, 404)
        self.assertEqual(EstablishmentRecordOpening.objects.count(), 0)

        own = PatientProfile.objects.create(user=self.admin, first_name="Ada", last_name="Admin", birth_date=date(1990, 1, 1))
        self.encounter(own, self.establishment)
        refused = self.open(own)
        self.assertEqual(refused.status_code, 403)
        self.assertEqual(refused.data["code"], "self_access")
        self.assertEqual(EstablishmentRecordOpening.objects.count(), 0)
        event = AuditEvent.objects.get(event_type="establishment_record.self_refused", patient=own)
        self.assertEqual(event.actor_id, self.admin.id)
        self.assertEqual(event.metadata, {"action": "self_access_refused"})

    def test_record_requires_same_user_current_admin_unexpired_opening_and_active_establishment(self):
        patient = self.patient("patient-protected-record")
        self.encounter(patient, self.establishment)
        opened = self.open(patient)
        opening_id = opened.data["data"]["opening_id"]

        other_client = APIClient()
        other_client.force_authenticate(self.outsider)
        self.assertEqual(other_client.get(self.record_url(opening_id)).status_code, 403)

        with patch("apps.establishments.clinical_views.timezone.now", return_value=timezone.now() + timedelta(minutes=31)):
            expired = self.client.get(self.record_url(opening_id))
        self.assertEqual(expired.status_code, 403)

        assignment = EstablishmentAdministrator.objects.get(establishment=self.establishment, user=self.admin)
        assignment.status = "revoked"
        assignment.save(update_fields=("status",))
        self.assertEqual(self.client.get(self.record_url(opening_id)).status_code, 403)

    def test_suspension_blocks_an_existing_opening_and_record_response_is_not_cached(self):
        patient = self.patient("patient-suspend")
        self.encounter(patient, self.establishment)
        opened = self.open(patient)
        opening_id = opened.data["data"]["opening_id"]
        self.establishment.status = "suspended"
        self.establishment.save(update_fields=("status",))
        self.assertEqual(self.client.get(self.record_url(opening_id)).status_code, 403)

    def test_record_uses_the_a1_service_and_returns_only_validated_local_content(self):
        patient = self.patient("patient-a1-record")
        self.encounter(patient, self.establishment, "Pré-consultation locale")
        self.encounter(patient, self.other_establishment, "Pré-consultation distante")
        doctor_user = User.objects.create_user(username="record-doctor", password="test-password-123", first_name="Dr", last_name="Local")
        doctor = ProfessionalProfile.objects.create(user=doctor_user, professional_title="Médecin")
        Consultation.objects.create(patient=patient, establishment=self.establishment, professional=doctor, professional_name="Médecin local", facility_label=self.establishment.name, reason="Consultation locale", diagnosis="Diagnostic local", validated_at=timezone.now())
        Consultation.objects.create(patient=patient, establishment=self.other_establishment, professional=doctor, professional_name="Médecin distant", facility_label=self.other_establishment.name, reason="Consultation distante", diagnosis="Diagnostic distant", validated_at=timezone.now())
        HealthMeasurement.objects.create(patient=patient, establishment=self.establishment, professional=doctor, validated_at=timezone.now(), kind="weight", value=Decimal("68.40"), unit="kg", measured_at=timezone.now())
        HealthMeasurement.objects.create(patient=patient, kind="weight", value=Decimal("70.00"), unit="kg", measured_at=timezone.now())
        MedicalDocument.objects.create(patient=patient, establishment=self.establishment, professional=doctor, validated_at=timezone.now(), original_name="résultat-local.pdf", document_type="analysis", content_type="application/pdf", size_bytes=20, verified=True)
        MedicalDocument.objects.create(patient=patient, original_name="import-patient.pdf", document_type="analysis", content_type="application/pdf", size_bytes=20, verified=False)
        Vaccination.objects.create(patient=patient, establishment=self.establishment, confirmed_by=doctor, confirmed_at=timezone.now(), vaccine_name="BCG local", status="confirmed")
        Vaccination.objects.create(patient=patient, vaccine_name="Déclaration patient", status="declared")
        opened = self.open(patient)
        response = self.client.get(self.record_url(opened.data["data"]["opening_id"]))

        self.assertEqual(response.status_code, 200, response.data)
        records = response.data["data"]["records"]
        self.assertEqual([row["reason"] for row in records["preconsultations"]], ["Pré-consultation locale"])
        self.assertEqual([row["reason"] for row in records["consultations"]], ["Consultation locale"])
        self.assertEqual(len(records["measurements"]), 1)
        self.assertEqual([row["original_name"] for row in records["documents"]], ["résultat-local.pdf"])
        self.assertNotIn("download_url", records["documents"][0])
        self.assertEqual([row["vaccine_name"] for row in records["vaccinations"]], ["BCG local"])
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(response["Pragma"], "no-cache")
        audit = AuditEvent.objects.get(event_type="establishment_record.read", patient=patient)
        self.assertEqual(audit.metadata["resource_count"], 5)
        self.assertEqual(audit.metadata["opening_id"], opened.data["data"]["opening_id"])

    def test_history_includes_admin_openings_and_professional_patient_authorized_reads(self):
        patient = self.patient("patient-history")
        self.encounter(patient, self.establishment)
        opened = self.open(patient, category="demande_patient")
        professional = User.objects.create_user(username="history-doctor", password="test-password-123", first_name="Jean", last_name="Médecin")
        record_event(
            event_type="clinical_data.read",
            actor=professional,
            actor_role="professional",
            patient=patient,
            establishment=self.establishment,
            metadata={"action": "read_preconsultations", "resource_type": "preconsultation", "resource_count": 1},
        )

        response = self.client.get(self.history_url(patient.id))

        self.assertEqual(response.status_code, 200)
        entries = response.data["data"]
        self.assertEqual(len(entries), 2)
        admin_entry = next(item for item in entries if item["event_type"] == "establishment_record.opened")
        pro_entry = next(item for item in entries if item["event_type"] == "clinical_data.read")
        self.assertEqual(admin_entry["opening_id"], opened.data["data"]["opening_id"])
        self.assertEqual(admin_entry["reason_category"], "demande_patient")
        self.assertEqual(pro_entry["reason_label"], "Accès autorisé par le patient")
        self.assertEqual(pro_entry["who"], "Jean Médecin")
        self.assertEqual(response["Cache-Control"], "private, no-store")

    def test_patient_list_view_counts_include_openings_and_professional_reads(self):
        patient = self.patient("patient-counts")
        self.encounter(patient, self.establishment)
        self.open(patient)
        doctor = User.objects.create_user(username="counts-doctor", password="test-password-123")
        record_event(event_type="clinical_data.read", actor=doctor, actor_role="professional", patient=patient, establishment=self.establishment, metadata={"action": "read_preconsultations", "resource_count": 1})

        response = self.client.get(self.list_url)

        item = response.data["data"]["items"][0]
        self.assertEqual(item["views_total"], 2)
        self.assertEqual(item["views_30d"], 2)
        self.assertEqual(item["last_view"]["who"], "counts-doctor")

    def test_bulk_access_alert_is_emitted_after_sixteen_distinct_patients_and_staff_can_see_it(self):
        for number in range(16):
            patient = self.patient(f"patient-bulk-{number}")
            self.encounter(patient, self.establishment)
            response = self.open(patient)
            self.assertEqual(response.status_code, 201, (number, response.data))

        alert = AuditEvent.objects.get(event_type="establishment_record.volume_alert", establishment=self.establishment)
        self.assertIsNone(alert.patient_id)
        self.assertEqual(alert.metadata, {"action": "unusual_volume", "resource_count": 16})
        self.client.force_authenticate(self.staff)
        staff_response = self.client.get(f"/api/v1/establishments/startup/{self.establishment.id}/audit/")
        self.assertEqual(staff_response.status_code, 200)
        staff_alert = next(item for item in staff_response.data["data"]["items"] if item["event_type"] == "establishment_record.volume_alert")
        self.assertEqual(staff_alert["metadata"]["resource_count"], 16)
        self.assertNotIn("patient_id", str(staff_alert))

    @override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "a2-open-throttle"}})
    def test_opening_throttle_is_thirty_per_hour_per_authenticated_user(self):
        for number in range(31):
            patient = self.patient(f"patient-throttle-{number}")
            self.encounter(patient, self.establishment)
            response = self.open(patient)
            if number < 30:
                self.assertEqual(response.status_code, 201, (number, response.data))
            else:
                self.assertEqual(response.status_code, 429)

    def test_clinical_read_kill_switch_blocks_opening_and_record_access(self):
        patient = self.patient("patient-flag-off")
        self.encounter(patient, self.establishment)
        with override_settings(ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ=False):
            response = self.open(patient)
            self.assertEqual(response.status_code, 403)
            self.assertEqual(EstablishmentRecordOpening.objects.count(), 0)

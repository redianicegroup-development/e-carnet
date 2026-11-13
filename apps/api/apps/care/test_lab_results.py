"""PRO-21 — consultation en attente de résultats et espace laboratoire.

Ces tests figent le contrat de sécurité : le laboratoire ne lit rien, le QR d'examen ne désigne qu'une consultation, la signature
est bloquée tant que les résultats attendus ne sont pas arrivés, et rien de tout cela n'existe sans le drapeau ECARNET_LAB_ENABLED."""
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.establishments.models import Establishment, EstablishmentAdministrator
from apps.identity.models import AccountContext
from apps.patients.models import PatientProfile
from .models import AccessGrant, CareEncounter, Consultation, ExamRequest, MedicalDocument, PatientNotification, PendingConsultation, PendingExam
from .pending_services import exam_qr_token
from .services import END_REASON_WAITING_RESULTS, create_patient_qr_token
from .tests import make_clinic_doctor

User = get_user_model()
GRANTS = "/api/v1/patient/care/professional/access-grants/"
SIGN = "/api/v1/patient/care/professional/consultations/"
PENDING = "/api/v1/patient/care/professional/pending-consultations/"
PATIENT_PENDING = "/api/v1/patient/care/pending-consultations/"
RESOLVE = "/api/v1/patient/care/laboratory/exam-qr/resolve/"
DEPOSIT = "/api/v1/patient/care/laboratory/results/"
HISTORY = "/api/v1/patient/care/laboratory/deposits/"
PDF = b"%PDF-1.4 resultat de laboratoire"


def make_lab(parent, suffix="lab"):
    """Laboratoire actif rattaché à `parent`, avec son administrateur. Aucun profil professionnel."""
    creator = User.objects.create_user(username=f"lab-creator-{suffix}", password="local-test-password")
    lab = Establishment.objects.create(
        created_by=creator, name=f"Laboratoire {suffix}", establishment_type="Laboratoire", city="Abidjan", address="A", phone="0", email=f"{suffix}@example.test",
        status="active", is_laboratory=True, parent=parent,
    )
    admin = User.objects.create_user(username=f"lab-admin-{suffix}", password="local-test-password", email=f"admin-{suffix}@example.test")
    EstablishmentAdministrator.objects.create(establishment=lab, user=admin, assigned_by=creator, status="active")
    AccountContext.objects.create(user=admin, role="establishment", is_active=True)
    return lab, admin


@override_settings(ECARNET_LAB_ENABLED=True, RUNNING_TESTS=True)
class PendingConsultationFlowTests(TestCase):
    def setUp(self):
        self.patient_user = User.objects.create_user(username="lab-patient", password="local-test-password", first_name="Awa", last_name="Kone")
        self.patient = PatientProfile.objects.create(user=self.patient_user, first_name="Awa", last_name="Kone", birth_date=date(1990, 4, 12))
        self.doctor, self.profile, self.clinic = make_clinic_doctor(self.patient_user, "lab-a")
        self.other_doctor, self.other_profile, self.other_clinic = make_clinic_doctor(self.patient_user, "lab-b")
        self.lab, self.lab_admin = make_lab(self.clinic)
        self.doctor_client, self.other_doctor_client, self.patient_client, self.lab_client = APIClient(), APIClient(), APIClient(), APIClient()
        self.doctor_client.force_authenticate(self.doctor)
        self.other_doctor_client.force_authenticate(self.other_doctor)
        self.patient_client.force_authenticate(self.patient_user)
        self.lab_client.force_authenticate(self.lab_admin)
        self.encounter = CareEncounter.objects.create(patient=self.patient, reason="Fièvre", observations="Fièvre depuis deux jours", status="draft")

    # --- aides
    def scan(self, client=None):
        return (client or self.doctor_client).post(GRANTS, {"qr_token": create_patient_qr_token(patient=self.patient), "scope": ["preconsultation", "declarations", "documents"]}, format="json")

    def wait_payload(self, grant_id, exams=None):
        return {
            "access_grant_id": grant_id, "source_encounter_id": str(self.encounter.id), "reason": "Fièvre", "diagnosis": "Suspicion de paludisme",
            "requested_exams": exams if exams is not None else [{"kind": "analysis", "label": "Goutte épaisse"}],
        }

    def wait(self, exams=None):
        grant_id = self.scan().data["data"]["id"]
        response = self.doctor_client.post(PENDING, self.wait_payload(grant_id, exams), format="json")
        return grant_id, response

    def pdf(self, name="goutte-epaisse.pdf", content=PDF):
        return SimpleUploadedFile(name, content, content_type="application/pdf")

    def qr(self, pending):
        return exam_qr_token(pending)

    def deposit(self, pending, exam, *, client=None, confirmed="true", file=None, token=None):
        return (client or self.lab_client).post(
            DEPOSIT, {"token": token or self.qr(pending), "exam_id": str(exam.id), "identity_confirmed": confirmed, "file": file or self.pdf()}, format="multipart",
        )

    def sign(self, grant_id, pending_id=None, **extra):
        payload = {"access_grant_id": grant_id, "source_encounter_id": str(self.encounter.id), "attestation_svg": "<svg></svg>", "diagnosis": "Paludisme simple", **extra}
        if pending_id:
            payload["pending_consultation_id"] = str(pending_id)
        return self.doctor_client.post(SIGN, payload, format="json")

    # --- « Attendre les résultats »
    def test_waiting_saves_the_draft_closes_the_access_and_signs_nothing(self):
        grant_id, response = self.wait()
        self.assertEqual(response.status_code, 201, response.data)
        pending = PendingConsultation.objects.get()
        self.assertEqual(pending.status, "waiting_results")
        self.assertEqual(pending.draft["diagnosis"], "Suspicion de paludisme")
        self.assertNotIn("attestation_svg", pending.draft)
        self.assertEqual(pending.exams.count(), 1)
        self.assertEqual(Consultation.objects.count(), 0)
        self.encounter.refresh_from_db()
        self.assertEqual(self.encounter.status, "draft")
        self.assertEqual(AccessGrant.objects.get(pk=grant_id).status, "expired")
        ended = AuditEvent.objects.get(access_grant_id=grant_id, event_type="access_grant.ended")
        self.assertEqual(ended.metadata["reason_code"], END_REASON_WAITING_RESULTS)
        self.assertTrue(AuditEvent.objects.filter(event_type="pending_consultation.created", patient=self.patient).exists())
        self.assertEqual(PatientNotification.objects.get(patient=self.patient, kind="access.ended").title, "Consultation en attente de résultats")

    def test_waiting_needs_at_least_one_exam(self):
        _, response = self.wait(exams=[])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(PendingConsultation.objects.count(), 0)

    def test_waiting_is_refused_on_a_closed_access(self):
        grant_id = self.scan().data["data"]["id"]
        self.assertEqual(self.doctor_client.post(f"{GRANTS}{grant_id}/end/").status_code, 200)
        self.assertEqual(self.doctor_client.post(PENDING, self.wait_payload(grant_id), format="json").status_code, 400)

    def test_only_one_open_waiting_per_pre_consultation(self):
        self.wait()
        grant_id = self.scan().data["data"]["id"]
        self.assertEqual(self.doctor_client.post(PENDING, self.wait_payload(grant_id), format="json").status_code, 400)
        self.assertEqual(PendingConsultation.objects.count(), 1)

    # --- blocage de la signature
    def test_signing_is_blocked_while_results_are_awaited(self):
        _, _ = self.wait()
        pending = PendingConsultation.objects.get()
        grant_id = self.scan().data["data"]["id"]
        self.assertEqual(self.sign(grant_id).status_code, 400)  # signature « ordinaire »
        blocked = self.sign(grant_id, pending.id)  # même avec son identifiant : toujours en attente
        self.assertEqual(blocked.status_code, 400)
        self.assertIn("attend encore", blocked.data["message"])
        self.assertEqual(Consultation.objects.count(), 0)
        self.assertEqual(AccessGrant.objects.get(pk=grant_id).status, "active")

    def test_another_doctor_cannot_sign_over_the_waiting_consultation(self):
        self.wait()
        self.doctor_client.post(f"{GRANTS}{self.scan().data['data']['id']}/end/")  # libère le patient
        grant_id = self.scan(self.other_doctor_client).data["data"]["id"]
        response = self.other_doctor_client.post(SIGN, {"access_grant_id": grant_id, "source_encounter_id": str(self.encounter.id), "attestation_svg": "<svg></svg>", "diagnosis": "x"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Consultation.objects.count(), 0)

    def test_the_usual_signature_is_unchanged_without_any_waiting(self):
        grant_id = self.scan().data["data"]["id"]
        self.assertEqual(self.sign(grant_id).status_code, 201)

    # --- QR d'examen et laboratoire
    def test_the_patient_shows_hides_and_renews_the_exam_qr(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        shown = self.patient_client.get(f"{PATIENT_PENDING}{pending.id}/exam-qr/")
        self.assertEqual(shown.status_code, 200)
        first = shown.data["data"]["token"]
        self.assertEqual(self.lab_client.post(RESOLVE, {"token": first}, format="json").status_code, 200)
        renewed = self.patient_client.post(f"{PATIENT_PENDING}{pending.id}/exam-qr/")
        self.assertEqual(renewed.status_code, 201)
        self.assertNotEqual(renewed.data["data"]["token"], first)
        self.assertEqual(self.lab_client.post(RESOLVE, {"token": first}, format="json").status_code, 404)  # l'ancien QR est mort
        self.assertEqual(self.lab_client.post(RESOLVE, {"token": renewed.data["data"]["token"]}, format="json").status_code, 200)
        self.assertEqual(self.patient_client.delete(f"{PATIENT_PENDING}{pending.id}/exam-qr/").status_code, 200)
        self.assertEqual(self.patient_client.get(f"{PATIENT_PENDING}{pending.id}/exam-qr/").status_code, 404)
        self.assertEqual(self.lab_client.post(RESOLVE, {"token": renewed.data["data"]["token"]}, format="json").status_code, 404)

    def test_the_patient_cannot_open_someone_elses_exam_qr(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        stranger = User.objects.create_user(username="lab-stranger", password="local-test-password")
        PatientProfile.objects.create(user=stranger)
        client = APIClient()
        client.force_authenticate(stranger)
        self.assertEqual(client.get(f"{PATIENT_PENDING}{pending.id}/exam-qr/").status_code, 404)

    def test_the_laboratory_sees_the_name_the_birth_date_and_the_exams_only(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        response = self.lab_client.post(RESOLVE, {"token": self.qr(pending)}, format="json")
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["patient"], {"first_name": "Awa", "last_name": "Kone", "birth_date": "1990-04-12"})
        self.assertEqual([exam["label"] for exam in data["exams"]], ["Goutte épaisse"])
        # Rien d'autre : ni motif, ni diagnostic, ni ordonnance, ni identifiant de patient.
        self.assertEqual(set(data.keys()), {"pending_consultation_id", "patient", "exams", "expires_at"})
        text = str(data)
        self.assertNotIn("paludisme", text.lower())
        self.assertNotIn("Fièvre", text)
        self.assertTrue(AuditEvent.objects.filter(event_type="lab_exam_qr.resolved", establishment=self.lab, patient=self.patient).exists())

    def test_a_forged_or_unknown_token_is_refused_with_one_generic_message(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        forged = f"EXQ1.{pending.id.hex}.{'0' * 40}"
        for token in (forged, "EXQ1.xyz.abc", "", "n'importe quoi", None):
            response = self.lab_client.post(RESOLVE, {"token": token}, format="json")
            self.assertEqual(response.status_code, 404, token)
            self.assertIn("invalide, expiré", response.data["message"])

    def test_a_doctor_or_a_clinic_admin_is_not_a_laboratory(self):
        self.wait()
        token = self.qr(PendingConsultation.objects.get())
        self.assertEqual(self.doctor_client.post(RESOLVE, {"token": token}, format="json").status_code, 403)
        clinic_admin = User.objects.create_user(username="lab-clinic-admin", password="local-test-password")
        EstablishmentAdministrator.objects.create(establishment=self.clinic, user=clinic_admin, assigned_by=self.doctor, status="active")
        client = APIClient()
        client.force_authenticate(clinic_admin)
        self.assertEqual(client.post(RESOLVE, {"token": token}, format="json").status_code, 403)
        self.assertEqual(client.post(DEPOSIT, {"token": token}, format="multipart").status_code, 403)

    def test_an_expired_qr_cannot_be_resolved(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        token = self.qr(pending)
        from django.utils import timezone

        PendingConsultation.objects.filter(pk=pending.pk).update(qr_expires_at=timezone.now())
        self.assertEqual(self.lab_client.post(RESOLVE, {"token": token}, format="json").status_code, 404)

    # --- dépôt du résultat
    def test_depositing_the_result_attaches_it_and_makes_the_consultation_resumable(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        exam = pending.exams.get()
        response = self.deposit(pending, exam)
        self.assertEqual(response.status_code, 201, response.data)
        document = MedicalDocument.objects.get(pending_exam=exam)
        self.assertEqual((document.establishment_id, document.professional_id, document.lab_depositor_id), (self.lab.id, None, self.lab_admin.id))
        self.assertTrue(document.verified)
        self.assertEqual(document.patient, self.patient)
        self.assertEqual(document.document_type, "analysis")
        exam.refresh_from_db(), pending.refresh_from_db()
        self.assertEqual(exam.status, "result_received")
        self.assertEqual(exam.lab_establishment, self.lab)
        self.assertEqual(pending.status, "to_resume")
        kinds = set(PatientNotification.objects.filter(patient=self.patient).values_list("kind", flat=True))
        self.assertTrue({"lab.result_received", "exam.results_ready"} <= kinds)
        self.assertTrue(AuditEvent.objects.filter(event_type="lab_result.deposited", establishment=self.lab, patient=self.patient).exists())
        # Le patient retrouve le PDF dans son carnet et peut le lire.
        listed = self.patient_client.get("/api/v1/patient/care/documents/")
        self.assertIn(str(document.id), [row["id"] for row in listed.data["data"]])
        self.assertEqual(self.patient_client.get(f"/api/v1/patient/care/documents/{document.id}/download/").status_code, 200)

    def test_the_identity_confirmation_is_mandatory(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        for confirmed in ("false", "", "oui"):
            self.assertEqual(self.deposit(pending, pending.exams.get(), confirmed=confirmed).status_code, 400)
        self.assertEqual(MedicalDocument.objects.count(), 0)

    def test_only_a_real_pdf_is_accepted(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        exam = pending.exams.get()
        wrong_extension = SimpleUploadedFile("resultat.png", b"\x89PNG\r\n\x1a\n....", content_type="image/png")
        fake_pdf = SimpleUploadedFile("resultat.pdf", b"MZ ceci est un executable", content_type="application/pdf")
        for file in (wrong_extension, fake_pdf):
            self.assertEqual(self.deposit(pending, exam, file=file).status_code, 400)
        self.assertEqual(self.lab_client.post(DEPOSIT, {"token": self.qr(pending), "exam_id": str(exam.id), "identity_confirmed": "true"}, format="multipart").status_code, 400)
        self.assertEqual(MedicalDocument.objects.count(), 0)
        pending.refresh_from_db()
        self.assertEqual(pending.status, "waiting_results")

    def test_an_exam_of_another_consultation_cannot_be_targeted(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        other_patient = PatientProfile.objects.create(user=User.objects.create_user(username="lab-other-patient", password="local-test-password"))
        other_encounter = CareEncounter.objects.create(patient=other_patient, reason="Toux", status="draft")
        other = PendingConsultation.objects.create(patient=other_patient, professional=self.profile, establishment=self.clinic, source_encounter=other_encounter, qr_expires_at=pending.qr_expires_at)
        foreign_exam = PendingExam.objects.create(pending=other, kind="analysis", label="NFS")
        response = self.deposit(pending, foreign_exam)  # QR du patient A, examen du patient B
        self.assertEqual(response.status_code, 400)
        self.assertFalse(MedicalDocument.objects.filter(patient=other_patient).exists())

    def test_a_correction_replaces_the_previous_file_without_deleting_it(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        exam = pending.exams.get()
        self.assertEqual(self.deposit(pending, exam).status_code, 201)
        self.assertEqual(self.deposit(pending, exam, file=self.pdf("corrige.pdf", b"%PDF-1.4 corrige")).status_code, 201)
        first, second = MedicalDocument.objects.filter(pending_exam=exam).order_by("created_at")
        self.assertEqual(first.superseded_by_id, second.id)
        self.assertIsNone(second.superseded_by_id)
        self.assertEqual(MedicalDocument.objects.filter(pending_exam=exam).count(), 2)

    def test_another_laboratory_cannot_overwrite_a_result(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        exam = pending.exams.get()
        self.assertEqual(self.deposit(pending, exam).status_code, 201)
        _, other_admin = make_lab(self.clinic, "lab2")
        other_client = APIClient()
        other_client.force_authenticate(other_admin)
        self.assertEqual(self.deposit(pending, exam, client=other_client).status_code, 400)
        self.assertEqual(MedicalDocument.objects.filter(pending_exam=exam).count(), 1)

    def test_the_laboratory_history_never_exposes_names_or_content(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        self.deposit(pending, pending.exams.get())
        rows = self.lab_client.get(HISTORY).data["data"]["items"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["patient_initials"], "A. K.")
        self.assertNotIn("Awa", str(rows))
        self.assertNotIn("Kone", str(rows))

    def test_the_history_tells_deposited_replaced_and_abandoned_and_filters_by_status(self):
        self.wait(exams=[{"kind": "analysis", "label": "Goutte épaisse"}, {"kind": "imaging", "label": "Radio thoracique"}, {"kind": "other", "label": "Test rapide"}])
        pending = PendingConsultation.objects.get()
        first, second, _third = pending.exams.order_by("position")
        self.assertEqual(self.lab_client.post(RESOLVE, {"token": self.qr(pending)}, format="json").status_code, 200)  # le laboratoire lit le QR
        self.assertEqual(self.deposit(pending, first).status_code, 201)
        self.assertEqual(self.deposit(pending, first, file=self.pdf("version-corrigee.pdf")).status_code, 201)  # correction : l'ancien devient « remplacé »
        url = f"{PENDING}{pending.id}/exams/{second.id}/abandon/"
        self.assertEqual(self.doctor_client.post(url, {"reason": "Le patient ne la fera pas"}, format="json").status_code, 200)
        data = self.lab_client.get(HISTORY).data["data"]
        self.assertEqual(data["counts"], {"deposited": 1, "replaced": 1, "abandoned": 1, "all": 3})
        self.assertEqual(sorted(item["status"] for item in data["items"]), ["abandoned", "deposited", "replaced"])
        abandoned = self.lab_client.get(HISTORY, {"status": "abandoned"}).data["data"]
        self.assertEqual([item["exam_label"] for item in abandoned["items"]], ["Radio thoracique"])
        self.assertEqual(abandoned["items"][0]["original_name"], "")
        self.assertEqual(abandoned["counts"]["all"], 3)  # les effectifs ignorent le filtre de statut
        self.assertEqual(self.lab_client.get(HISTORY, {"status": "replaced"}).data["data"]["items"][0]["exam_label"], "Goutte épaisse")
        row = data["items"][0]
        self.assertEqual((row["patient_initials"], row["birth_year"]), ("A. K.", 1990))
        self.assertNotIn("Awa", str(data))
        self.assertNotIn("Kone", str(data))
        self.assertNotIn("ne la fera pas", str(data))  # le motif du médecin n'est jamais montré au laboratoire

    def test_the_history_filters_by_date_and_refuses_bad_parameters(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        self.deposit(pending, pending.exams.get())
        today = timezone.localdate()
        both = {"from": today.isoformat(), "to": today.isoformat()}
        self.assertEqual(len(self.lab_client.get(HISTORY, both).data["data"]["items"]), 1)
        self.assertEqual(len(self.lab_client.get(HISTORY, {"from": (today + timedelta(days=1)).isoformat()}).data["data"]["items"]), 0)
        self.assertEqual(len(self.lab_client.get(HISTORY, {"to": (today - timedelta(days=1)).isoformat()}).data["data"]["items"]), 0)
        self.assertEqual(self.lab_client.get(HISTORY, {"from": "hier"}).status_code, 400)
        self.assertEqual(self.lab_client.get(HISTORY, {"from": today.isoformat(), "to": (today - timedelta(days=2)).isoformat()}).status_code, 400)
        self.assertEqual(self.lab_client.get(HISTORY, {"status": "inconnu"}).status_code, 400)

    def test_an_abandoned_exam_is_only_in_the_history_of_a_laboratory_that_read_its_qr(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        exam = pending.exams.get()
        other_lab, other_admin = make_lab(self.clinic, "lab-2")
        other_client = APIClient()
        other_client.force_authenticate(other_admin)
        self.assertEqual(other_client.post(RESOLVE, {"token": self.qr(pending)}, format="json").status_code, 200)
        url = f"{PENDING}{pending.id}/exams/{exam.id}/abandon/"
        self.assertEqual(self.doctor_client.post(url, {"reason": "Le patient ne la fera pas"}, format="json").status_code, 200)
        self.assertEqual(other_client.get(HISTORY).data["data"]["counts"]["abandoned"], 1)
        self.assertEqual(self.lab_client.get(HISTORY).data["data"]["counts"]["abandoned"], 0)  # ce laboratoire n'a jamais lu ce QR

    # --- abandon : la sortie de secours
    def test_the_doctor_can_abandon_a_missing_exam_with_a_written_reason(self):
        self.wait(exams=[{"kind": "analysis", "label": "Goutte épaisse"}, {"kind": "imaging", "label": "Radio thoracique"}])
        pending = PendingConsultation.objects.get()
        first, second = pending.exams.order_by("position")
        self.assertEqual(self.deposit(pending, first).status_code, 201)
        pending.refresh_from_db()
        self.assertEqual(pending.status, "waiting_results")
        url = f"{PENDING}{pending.id}/exams/{second.id}/abandon/"
        self.assertEqual(self.doctor_client.post(url, {"reason": "ok"}, format="json").status_code, 400)  # motif trop court
        self.assertEqual(self.other_doctor_client.post(url, {"reason": "Le patient ne la fera pas"}, format="json").status_code, 400)  # pas son attente
        self.assertEqual(self.doctor_client.post(url, {"reason": "Le patient ne la fera pas"}, format="json").status_code, 200)
        pending.refresh_from_db(), second.refresh_from_db()
        self.assertEqual((pending.status, second.status), ("to_resume", "abandoned"))
        self.assertEqual(second.abandon_reason, "Le patient ne la fera pas")
        self.assertTrue(AuditEvent.objects.filter(event_type="pending_exam.abandoned", patient=self.patient).exists())
        self.assertEqual(self.deposit(pending, second).status_code, 400)  # plus de dépôt sur un examen abandonné

    # --- reprise et signature
    def test_resuming_needs_a_new_qr_then_signing_attaches_exams_and_pdfs(self):
        _, _ = self.wait(exams=[{"kind": "analysis", "label": "Goutte épaisse"}, {"kind": "imaging", "label": "Radio thoracique"}])
        pending = PendingConsultation.objects.get()
        first, second = pending.exams.order_by("position")
        self.deposit(pending, first)
        self.doctor_client.post(f"{PENDING}{pending.id}/exams/{second.id}/abandon/", {"reason": "Radio non disponible"}, format="json")

        # Sans nouveau QR, le médecin n'a plus aucun accès au carnet.
        self.assertEqual(self.doctor_client.get(f"{GRANTS}{AccessGrant.objects.get().id}/pending-consultation/").status_code, 403)

        grant_id = self.scan().data["data"]["id"]
        view = self.doctor_client.get(f"{GRANTS}{grant_id}/pending-consultation/")
        self.assertEqual(view.status_code, 200)
        self.assertEqual(view.data["data"]["status"], "to_resume")
        self.assertEqual(view.data["data"]["draft"]["diagnosis"], "Suspicion de paludisme")
        self.assertTrue(view.data["data"]["documents_allowed"])
        self.assertEqual(len(view.data["data"]["exams"][0]["documents"]), 1)

        # Signature sans identifiant de reprise : refusée ; avec : acceptée, les examens viennent de l'attente (pas du client).
        self.assertEqual(self.sign(grant_id).status_code, 400)
        signed = self.sign(grant_id, pending.id, requested_exams=[{"kind": "other", "label": "Examen glissé par le client"}])
        self.assertEqual(signed.status_code, 201, signed.data)
        consultation = Consultation.objects.get()
        exams = list(ExamRequest.objects.filter(consultation=consultation).order_by("position"))
        self.assertEqual([(exam.label, exam.status) for exam in exams], [("Goutte épaisse", "result_received"), ("Radio thoracique", "requested")])
        document = MedicalDocument.objects.get(pending_exam=first)
        self.assertEqual(document.exam_request_id, exams[0].id)  # le PDF suit la vraie consultation
        pending.refresh_from_db()
        self.assertEqual((pending.status, pending.consultation_id), ("completed", consultation.id))
        self.assertEqual(AccessGrant.objects.get(pk=grant_id).status, "expired")  # la signature ferme l'accès, comme d'habitude
        self.encounter.refresh_from_db()
        self.assertEqual(self.encounter.status, "closed")

    def test_the_resume_view_hides_the_files_without_the_documents_scope(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        self.deposit(pending, pending.exams.get())
        grant = self.doctor_client.post(GRANTS, {"qr_token": create_patient_qr_token(patient=self.patient), "scope": ["preconsultation"]}, format="json").data["data"]
        data = self.doctor_client.get(f"{GRANTS}{grant['id']}/pending-consultation/").data["data"]
        self.assertFalse(data["documents_allowed"])
        self.assertEqual(data["exams"][0]["documents"], [])
        self.assertEqual(data["exams"][0]["status"], "result_received")

    def test_the_doctor_list_gives_initials_only(self):
        self.wait()
        rows = self.doctor_client.get(PENDING).data["data"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["patient_initials"], "A. K.")
        self.assertNotIn("Awa", str(rows))
        self.assertEqual(rows[0]["exams_waiting"], 1)

    # --- annulation par le patient
    def test_the_patient_can_cancel_the_wait_and_the_qr_dies(self):
        self.wait()
        pending = PendingConsultation.objects.get()
        token = self.qr(pending)
        self.assertEqual(self.patient_client.post(f"{PATIENT_PENDING}{pending.id}/cancel/").status_code, 200)
        pending.refresh_from_db()
        self.assertEqual(pending.status, "cancelled")
        self.assertEqual(self.lab_client.post(RESOLVE, {"token": token}, format="json").status_code, 404)
        self.assertEqual(self.patient_client.get(PATIENT_PENDING).data["data"], [])
        # L'attente n'est plus ouverte : un autre médecin peut signer sur cette pré-consultation.
        grant_id = self.scan(self.other_doctor_client).data["data"]["id"]
        response = self.other_doctor_client.post(SIGN, {"access_grant_id": grant_id, "source_encounter_id": str(self.encounter.id), "attestation_svg": "<svg></svg>", "diagnosis": "x"}, format="json")
        self.assertEqual(response.status_code, 201)

    def test_the_patient_list_shows_the_exams_and_the_state(self):
        self.wait()
        rows = self.patient_client.get(PATIENT_PENDING).data["data"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["status"], "waiting_results")
        self.assertTrue(rows[0]["qr_active"])
        self.assertEqual(rows[0]["exams"][0]["label"], "Goutte épaisse")


@override_settings(ECARNET_LAB_ENABLED=True, RUNNING_TESTS=True)
class LaboratoryHasNoClinicalAccessTests(TestCase):
    """Le laboratoire dépose, il ne lit pas : aucune route clinique ne lui est ouverte."""

    def setUp(self):
        self.creator = User.objects.create_user(username="lab-noaccess-creator", password="local-test-password")
        self.doctor, self.profile, self.clinic = make_clinic_doctor(self.creator, "lab-noaccess")
        self.lab, self.lab_admin = make_lab(self.clinic, "noaccess")
        self.client = APIClient()
        self.client.force_authenticate(self.lab_admin)

    def test_the_identity_tells_the_web_that_this_account_is_a_laboratory(self):
        contexts = self.client.get("/api/v1/identity/me/").data["data"]["contexts"]
        self.assertEqual([c["is_laboratory"] for c in contexts if c["role"] == "establishment"], [True])
        clinic_admin = User.objects.create_user(username="lab-noaccess-clinic-admin", password="local-test-password")
        EstablishmentAdministrator.objects.create(establishment=self.clinic, user=clinic_admin, assigned_by=self.creator, status="active")
        AccountContext.objects.create(user=clinic_admin, role="establishment", is_active=True)
        clinic_client = APIClient()
        clinic_client.force_authenticate(clinic_admin)
        contexts = clinic_client.get("/api/v1/identity/me/").data["data"]["contexts"]
        self.assertEqual([c["is_laboratory"] for c in contexts if c["role"] == "establishment"], [False])

    def test_a_laboratory_cannot_issue_physician_join_codes(self):
        response = self.client.post(f"/api/v1/establishments/{self.lab.id}/join-codes/")
        self.assertEqual(response.status_code, 403)

    def test_a_laboratory_is_not_in_the_catalog_a_doctor_picks_from(self):
        self.client.force_authenticate(self.doctor)
        names = [row["name"] for row in self.client.get("/api/v1/establishments/catalog/").data["data"]]
        self.assertNotIn(self.lab.name, names)

    @override_settings(ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ=True)
    def test_the_clinical_read_of_the_establishment_is_closed_to_a_laboratory_even_when_enabled(self):
        patient = PatientProfile.objects.create(user=User.objects.create_user(username="lab-noaccess-patient", password="local-test-password"))
        for path in (f"/api/v1/establishments/{self.lab.id}/patients/", f"/api/v1/establishments/{self.lab.id}/patients/{patient.id}/openings/", f"/api/v1/establishments/{self.lab.id}/patient-records/"):
            response = self.client.post(path) if path.endswith("/openings/") else self.client.get(path)
            self.assertIn(response.status_code, (403, 404), path)

    def test_a_laboratory_has_no_professional_profile_so_every_clinical_route_refuses_it(self):
        for path in ("/api/v1/patient/care/professional/consultations/", "/api/v1/patient/care/professional/access-grants/", "/api/v1/patient/care/professional/recent-patients/"):
            self.assertEqual(self.client.get(path).status_code, 403, path)


@override_settings(ECARNET_LAB_ENABLED=True)
class ClinicAdministratorCreatesALaboratoryTests(TestCase):
    def setUp(self):
        self.creator = User.objects.create_user(username="lab-create-creator", password="local-test-password")
        self.doctor, self.profile, self.clinic = make_clinic_doctor(self.creator, "lab-create")
        self.admin = User.objects.create_user(username="lab-create-admin", password="local-test-password", email="boss@example.test")
        EstablishmentAdministrator.objects.create(establishment=self.clinic, user=self.admin, assigned_by=self.creator, status="active")
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.url = f"/api/v1/establishments/{self.clinic.id}/laboratories/"

    def create(self, **extra):
        return self.client.post(self.url, {"name": "Laboratoire Biolab", "admin_email": "biolab@example.test", "admin_first_name": "Moussa", "admin_last_name": "Traore", **extra}, format="json")

    def test_the_clinic_admin_opens_a_laboratory_and_its_administrator_account(self):
        response = self.create()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertTrue(response.data["data"]["temporary_password"])  # révélé une seule fois
        lab = Establishment.objects.get(name="Laboratoire Biolab")
        self.assertTrue(lab.is_laboratory)
        self.assertEqual((lab.parent_id, lab.establishment_type, lab.status), (self.clinic.id, "Laboratoire", "active"))
        self.assertTrue(EstablishmentAdministrator.objects.filter(establishment=lab, user__email="biolab@example.test", status="active").exists())
        self.assertTrue(AuditEvent.objects.filter(event_type="laboratory.created", establishment=self.clinic).exists())
        listed = self.client.get(self.url).data["data"]
        self.assertEqual([row["name"] for row in listed], ["Laboratoire Biolab"])

    def test_an_existing_account_is_never_attached_by_a_clinic_admin(self):
        User.objects.create_user(username="someone", email="biolab@example.test", password="local-test-password")
        response = self.create()
        self.assertEqual(response.status_code, 409)
        self.assertFalse(Establishment.objects.filter(name="Laboratoire Biolab").exists())
        # Même en insistant : `use_existing_account` n'est pas pris en compte pour un administrateur d'établissement.
        self.assertEqual(self.create(use_existing_account=True).status_code, 409)

    def test_a_stranger_or_a_laboratory_cannot_create_laboratories(self):
        stranger = User.objects.create_user(username="lab-create-stranger", password="local-test-password")
        outsider = APIClient()
        outsider.force_authenticate(stranger)
        self.assertEqual(outsider.post(self.url, {"name": "X", "admin_email": "x@example.test"}, format="json").status_code, 403)
        self.create()
        lab_admin = User.objects.get(email="biolab@example.test")
        lab_client = APIClient()
        lab_client.force_authenticate(lab_admin)
        lab = Establishment.objects.get(name="Laboratoire Biolab")
        self.assertEqual(lab_client.post(f"/api/v1/establishments/{lab.id}/laboratories/", {"name": "Sous-labo", "admin_email": "sub@example.test"}, format="json").status_code, 403)

    def test_name_and_email_are_validated_and_duplicates_refused(self):
        self.assertEqual(self.create(name="  ").status_code, 400)
        self.assertEqual(self.create(admin_email="pas-un-email").status_code, 400)
        self.assertEqual(self.create().status_code, 201)
        self.assertEqual(self.create(admin_email="autre@example.test").status_code, 409)


class LaboratoryFlagTests(TestCase):
    """Drapeau éteint (valeur par défaut) : aucune de ces routes n'existe fonctionnellement."""

    def test_everything_answers_404_without_the_flag(self):
        creator = User.objects.create_user(username="lab-flag-creator", password="local-test-password")
        doctor, _, clinic = make_clinic_doctor(creator, "lab-flag")
        lab, lab_admin = make_lab(clinic, "flag")
        patient_user = User.objects.create_user(username="lab-flag-patient", password="local-test-password")
        PatientProfile.objects.create(user=patient_user)
        unknown = "00000000-0000-0000-0000-000000000000"
        cases = [
            (doctor, "post", PENDING), (doctor, "get", PENDING), (doctor, "get", f"{GRANTS}{unknown}/pending-consultation/"),
            (doctor, "post", f"{PENDING}{unknown}/exams/{unknown}/abandon/"),
            (patient_user, "get", PATIENT_PENDING), (patient_user, "get", f"{PATIENT_PENDING}{unknown}/exam-qr/"), (patient_user, "post", f"{PATIENT_PENDING}{unknown}/cancel/"),
            (lab_admin, "post", RESOLVE), (lab_admin, "post", DEPOSIT), (lab_admin, "get", HISTORY),
        ]
        for user, method, path in cases:
            client = APIClient()
            client.force_authenticate(user)
            self.assertEqual(getattr(client, method)(path).status_code, 404, (method, path))
        admin = User.objects.create_user(username="lab-flag-admin", password="local-test-password")
        EstablishmentAdministrator.objects.create(establishment=clinic, user=admin, assigned_by=creator, status="active")
        client = APIClient()
        client.force_authenticate(admin)
        self.assertEqual(client.post(f"/api/v1/establishments/{clinic.id}/laboratories/", {"name": "X", "admin_email": "x@example.test"}, format="json").status_code, 404)

from django.contrib.auth import get_user_model
from datetime import date
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from apps.care.models import CareEncounter, PreConsultationRevision
from apps.establishments.models import Establishment
from apps.audit.models import AuditEvent
from apps.identity.models import AccountContext
from .models import ClinicalDeclaration, PatientProfile, PatientRepresentation, RepresentationTransferRequest

User = get_user_model()


class PatientOwnedDataTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user(username="patient-a", password="local-test-password")
        self.b = User.objects.create_user(username="patient-b", password="local-test-password")
        self.client = APIClient()

    def test_profile_and_declarations_are_isolated(self):
        self.client.force_authenticate(self.a)
        created = self.client.post("/api/v1/patient/declarations/", {"kind": "allergy", "label": "Pénicilline", "details": "Déclaration fictive de test"}, format="json")
        self.assertEqual(created.status_code, 201)
        self.client.force_authenticate(self.b)
        self.assertEqual(self.client.get("/api/v1/patient/declarations/").data["data"], [])
        self.assertEqual(self.client.get("/api/v1/patient/profile/").status_code, 200)

    def test_blood_group_is_a_patient_declaration_and_only_one_is_active(self):
        self.client.force_authenticate(self.a)
        invalid = self.client.post("/api/v1/patient/declarations/", {"kind": "blood_group", "label": "G+", "details": ""}, format="json")
        self.assertEqual(invalid.status_code, 400)
        first = self.client.post("/api/v1/patient/declarations/", {"kind": "blood_group", "label": "A+", "details": ""}, format="json")
        second = self.client.post("/api/v1/patient/declarations/", {"kind": "blood_group", "label": "O−", "details": ""}, format="json")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(list(ClinicalDeclaration.objects.filter(patient__user=self.a, kind="blood_group", status="declared").values_list("label", flat=True)), ["O−"])
        card = self.client.get("/api/v1/patient/emergency-card/")
        self.assertEqual(card.data["data"]["blood_group"], "O−")
        self.assertFalse(card.data["data"]["qr_enabled"])

    def test_emergency_qr_only_exposes_selected_fields_and_can_be_revoked_or_rotated(self):
        self.client.force_authenticate(self.a)
        self.client.post("/api/v1/patient/declarations/", {"kind": "blood_group", "label": "AB+", "details": ""}, format="json")
        self.client.post("/api/v1/patient/declarations/", {"kind": "allergy", "label": "Pénicilline", "details": "Réaction cutanée"}, format="json")
        self.client.post("/api/v1/patient/declarations/", {"kind": "treatment", "label": "Traitement fictif", "details": "1 fois par jour"}, format="json")
        self.client.patch("/api/v1/patient/emergency-card/", {"city": "Abidjan", "contact_name": "Contact fictif", "contact_phone": "+225 00 00 00 00", "qr_enabled": True}, format="json")
        first_token = self.client.get("/api/v1/patient/emergency-card/").data["data"]["qr_token"]

        self.client.force_authenticate(None)
        public = self.client.get(f"/api/v1/patient/emergency-card/qr/{first_token}/")
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.data["data"]["blood_group"], "AB+")
        self.assertEqual(public.data["data"]["allergies"][0]["label"], "Pénicilline")
        self.assertEqual(public.data["data"]["treatments"][0]["label"], "Traitement fictif")
        self.assertEqual(public.data["data"]["contact_name"], "Contact fictif")
        self.assertEqual(public.data["data"]["city"], "Abidjan")
        self.assertEqual(set(public.data["data"]), {"first_name", "last_name", "city", "blood_group", "allergies", "treatments", "contact_name", "contact_phone", "updated_at"})
        # Jamais de date de naissance, d’adresse, de téléphone du patient ni d’identifiant interne sur la carte publique.
        for forbidden in ("birth_date", "address", "phone", "email", "id", "patient_id", "qr_token"):
            self.assertNotIn(forbidden, public.data["data"])
        self.assertIn("no-store", public["Cache-Control"])
        self.assertIn("noindex", public["X-Robots-Tag"])
        self.assertEqual(self.client.get("/api/v1/patient/emergency-card/qr/not-a-token/").status_code, 404)

        self.client.force_authenticate(self.a)
        rotated = self.client.post("/api/v1/patient/emergency-card/", {}, format="json")
        new_token = rotated.data["data"]["qr_token"]
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/v1/patient/emergency-card/qr/{first_token}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/patient/emergency-card/qr/{new_token}/").status_code, 200)

        self.client.force_authenticate(self.a)
        self.client.patch("/api/v1/patient/emergency-card/", {"qr_enabled": False}, format="json")
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/v1/patient/emergency-card/qr/{new_token}/").status_code, 404)

    def test_preconsultation_closure_is_idempotent_and_immutable(self):
        self.client.force_authenticate(self.a)
        site = Establishment.objects.create(created_by=self.a, name="Centre fictif", establishment_type="Centre", city="Abidjan", address="A", phone="0", email="patient-test@example.test", responsible_name="Responsable", status="active")
        created = self.client.post("/api/v1/patient/care/encounters/", {"establishment_id": str(site.id), "reason": "Motif fictif", "observations": "Observation fictive"}, format="json")
        pk = created.data["data"]["id"]
        first = self.client.post(f"/api/v1/patient/care/encounters/{pk}/", {}, format="json")
        second = self.client.post(f"/api/v1/patient/care/encounters/{pk}/", {}, format="json")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(PreConsultationRevision.objects.filter(encounter_id=pk).count(), 1)
        blocked = self.client.patch(f"/api/v1/patient/care/encounters/{pk}/", {"reason": "Modification interdite"}, format="json")
        self.assertEqual(blocked.status_code, 409)

    def test_anonymous_patient_data_is_forbidden(self):
        self.assertEqual(self.client.get("/api/v1/patient/profile/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/patient/emergency-card/").status_code, 403)

    def test_offline_card_contains_only_selected_declarations_and_is_private(self):
        self.client.force_authenticate(self.a)
        profile = self.client.get("/api/v1/patient/profile/").data["data"]
        self.client.patch("/api/v1/patient/profile/", {"birth_date": "1990-01-01"}, format="json")
        allergy = self.client.post("/api/v1/patient/declarations/", {"kind": "allergy", "label": "Allergie fictive", "details": "Détail choisi"}, format="json").data["data"]
        treatment = self.client.post("/api/v1/patient/declarations/", {"kind": "treatment", "label": "Traitement fictif", "details": "Détail à exclure"}, format="json").data["data"]
        self.client.patch("/api/v1/patient/emergency-card/", {
            "contact_name": "Contact fictif",
            "contact_phone": "+22500000000",
            "offline_declaration_ids": [allergy["id"]],
        }, format="json")

        offline = self.client.get("/api/v1/patient/emergency-card/offline/")
        self.assertEqual(offline.status_code, 200)
        self.assertEqual(offline.data["data"]["birth_date"], "1990-01-01")
        self.assertEqual([item["label"] for item in offline.data["data"]["allergies"]], ["Allergie fictive"])
        self.assertEqual(offline.data["data"]["treatments"], [])
        self.assertTrue(offline.data["data"]["may_be_outdated"])
        self.assertIn("no-store", offline["Cache-Control"])
        self.assertTrue(AuditEvent.objects.filter(event_type="patient.emergency_card.offline_exported", patient_id=profile["id"]).exists())
        self.assertTrue(profile["id"])

        invalid = self.client.patch("/api/v1/patient/emergency-card/", {
            "offline_declaration_ids": [treatment["id"], "00000000-0000-0000-0000-000000000000"],
        }, format="json")
        self.assertEqual(invalid.status_code, 400)
        unchanged = self.client.get("/api/v1/patient/emergency-card/offline/")
        self.assertEqual(unchanged.data["data"]["treatments"], [])


class PatientRepresentationTests(TestCase):
    def setUp(self):
        self.guardian = User.objects.create_user(username="guardian", email="guardian@example.test", password="a-long-local-password")
        self.other = User.objects.create_user(username="other", email="other@example.test", password="a-long-local-password")
        AccountContext.objects.create(user=self.guardian, role="patient", is_active=True)
        self.guardian_client = APIClient()
        self.guardian_client.force_authenticate(self.guardian)

    def test_representation_management_requires_an_active_patient_context(self):
        AccountContext.objects.create(user=self.other, role="professional", is_active=True)
        other_client = APIClient()
        other_client.force_authenticate(self.other)
        response = other_client.get("/api/v1/patient/representations/")
        self.assertEqual(response.status_code, 403)

    @override_settings(ECARNET_REPRESENTATION_LEGAL_AGE=18)
    def test_minor_profile_is_separate_selectable_and_all_patient_data_stays_isolated(self):
        parent_profile = self.guardian_client.get("/api/v1/patient/profile/").data["data"]
        created = self.guardian_client.post("/api/v1/patient/representations/", {
            "first_name": "Awa",
            "last_name": "Koné",
            "birth_date": "2015-05-10",
            "relationship": "child",
            "legal_representative_confirmed": True,
        }, format="json")
        self.assertEqual(created.status_code, 201)
        patient_id = created.data["data"]["patient_id"]
        child_profile = PatientProfile.objects.get(pk=patient_id)
        self.assertIsNone(child_profile.user_id)
        self.assertNotEqual(parent_profile["id"], patient_id)

        selected = self.guardian_client.post("/api/v1/patient/representations/active/", {"patient_id": patient_id}, format="json")
        self.assertEqual(selected.status_code, 200)
        current = self.guardian_client.get("/api/v1/patient/profile/")
        self.assertEqual(current.data["data"]["id"], patient_id)
        self.assertEqual(current.data["data"]["first_name"], "Awa")
        declaration = self.guardian_client.post("/api/v1/patient/declarations/", {
            "kind": "allergy", "label": "Déclaration enfant", "details": "Fictive",
        }, format="json")
        self.assertEqual(declaration.status_code, 201)
        self.assertTrue(ClinicalDeclaration.objects.filter(patient=child_profile, label="Déclaration enfant").exists())
        audited_change = AuditEvent.objects.filter(
            event_type="clinical_declaration.created",
            actor=self.guardian,
            patient=child_profile,
        ).latest("created_at")
        self.assertEqual(audited_change.actor_role, "guardian")

        stranger = APIClient()
        stranger.force_authenticate(self.other)
        self.assertEqual(stranger.post("/api/v1/patient/representations/active/", {"patient_id": patient_id}, format="json").status_code, 403)
        self.assertEqual(stranger.get("/api/v1/patient/declarations/").data["data"], [])
        self.assertTrue(PatientRepresentation.objects.filter(guardian=self.guardian, patient=child_profile, status="active").exists())
        self.assertEqual(self.guardian_client.delete("/api/v1/patient/representations/active/").status_code, 200)
        self.assertEqual(self.guardian_client.get("/api/v1/patient/profile/").data["data"]["id"], parent_profile["id"])

    @override_settings(ECARNET_REPRESENTATION_LEGAL_AGE=None)
    def test_child_profile_creation_waits_for_legal_age_configuration(self):
        response = self.guardian_client.post("/api/v1/patient/representations/", {
            "first_name": "Enfant",
            "last_name": "Exemple",
            "birth_date": date(timezone.localdate().year - 8, 1, 1).isoformat(),
            "relationship": "child",
            "legal_representative_confirmed": True,
        }, format="json")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(PatientRepresentation.objects.count(), 0)

    @override_settings(ECARNET_REPRESENTATION_LEGAL_AGE=18)
    def test_revoking_and_reactivating_link_preserves_the_child_profile(self):
        created = self.guardian_client.post("/api/v1/patient/representations/", {
            "first_name": "Enfant",
            "last_name": "Exemple",
            "birth_date": date(timezone.localdate().year - 8, 1, 1).isoformat(),
            "relationship": "child",
            "legal_representative_confirmed": True,
        }, format="json")
        item = created.data["data"]
        self.guardian_client.post("/api/v1/patient/representations/active/", {"patient_id": item["patient_id"]}, format="json")

        revoked = self.guardian_client.delete(f"/api/v1/patient/representations/{item['id']}/")
        self.assertEqual(revoked.status_code, 200)
        self.assertTrue(PatientProfile.objects.filter(pk=item["patient_id"]).exists())
        self.assertEqual(self.guardian_client.get("/api/v1/patient/profile/").status_code, 200)

        reactivated = self.guardian_client.patch(f"/api/v1/patient/representations/{item['id']}/", {}, format="json")
        self.assertEqual(reactivated.status_code, 200)
        self.assertEqual(reactivated.data["data"]["status"], "active")
        self.assertTrue(PatientProfile.objects.filter(pk=item["patient_id"]).exists())

    @override_settings(ECARNET_REPRESENTATION_LEGAL_AGE=18)
    def test_adult_and_unconsented_relative_profiles_are_rejected(self):
        adult = date(timezone.localdate().year - 25, 1, 1).isoformat()
        response = self.guardian_client.post("/api/v1/patient/representations/", {
            "first_name": "Proche",
            "last_name": "Adulte",
            "birth_date": adult,
            "relationship": "parent",
            "legal_representative_confirmed": True,
        }, format="json")
        self.assertEqual(response.status_code, 403)

    @override_settings(ECARNET_REPRESENTATION_LEGAL_AGE=18)
    def test_transfer_requires_manual_age_review_and_preserves_the_existing_dossier(self):
        represented = self.guardian_client.post("/api/v1/patient/representations/", {
            "first_name": "Awa",
            "last_name": "Koné",
            "birth_date": date(timezone.localdate().year - 17, 1, 1).isoformat(),
            "relationship": "child",
            "legal_representative_confirmed": True,
        }, format="json")
        patient_id = represented.data["data"]["patient_id"]
        child_profile = PatientProfile.objects.get(pk=patient_id)
        child_profile.birth_date = date(timezone.localdate().year - 25, 1, 1)
        child_profile.save(update_fields=("birth_date", "updated_at"))
        self.guardian_client.post("/api/v1/patient/representations/active/", {"patient_id": patient_id}, format="json")
        declaration = self.guardian_client.post("/api/v1/patient/declarations/", {
            "kind": "allergy", "label": "Historique conservé", "details": "Fictif",
        }, format="json").data["data"]

        applicant = User.objects.create_user(username="adult-child", email="adult-child@example.test", password="a-long-local-password")
        AccountContext.objects.create(user=applicant, role="patient", is_active=True)
        applicant_client = APIClient()
        applicant_client.force_authenticate(applicant)
        request = applicant_client.post("/api/v1/patient/representations/transfers/", {"patient_id": patient_id}, format="json")
        self.assertEqual(request.status_code, 201)
        child_profile = PatientProfile.objects.get(pk=patient_id)
        self.assertIsNone(child_profile.user_id)
        self.assertTrue(ClinicalDeclaration.objects.filter(pk=declaration["id"], patient=child_profile).exists())

        reviewer = User.objects.create_superuser(username="reviewer", email="reviewer@example.test", password="a-long-local-password")
        reviewer_client = APIClient()
        reviewer_client.force_authenticate(reviewer)
        queue = reviewer_client.get("/api/v1/patient/representations/transfers/review/")
        self.assertEqual(queue.status_code, 200)
        self.assertEqual(queue.data["data"][0]["id"], request.data["data"]["id"])
        self.assertEqual(queue.data["data"][0]["applicant"]["email"], applicant.email)
        self.assertNotIn("patient_id", queue.data["data"][0])
        self.assertEqual(APIClient().get("/api/v1/patient/representations/transfers/review/").status_code, 403)
        denied = reviewer_client.patch(f"/api/v1/patient/representations/transfers/{request.data['data']['id']}/review/", {
            "decision": "approve",
        }, format="json")
        self.assertEqual(denied.status_code, 400)
        denied_identity = reviewer_client.patch(f"/api/v1/patient/representations/transfers/{request.data['data']['id']}/review/", {
            "decision": "approve", "age_verified": True,
        }, format="json")
        self.assertEqual(denied_identity.status_code, 400)
        approved = reviewer_client.patch(f"/api/v1/patient/representations/transfers/{request.data['data']['id']}/review/", {
            "decision": "approve", "age_verified": True, "identity_verified": True,
        }, format="json")
        self.assertEqual(approved.status_code, 200)
        child_profile.refresh_from_db()
        self.assertEqual(child_profile.user_id, applicant.id)
        self.assertTrue(ClinicalDeclaration.objects.filter(pk=declaration["id"], patient=child_profile).exists())
        self.assertTrue(RepresentationTransferRequest.objects.get(pk=request.data["data"]["id"]).age_verified)
        stale_selection = self.guardian_client.get("/api/v1/patient/profile/")
        self.assertEqual(stale_selection.status_code, 403)
        self.guardian_client.delete("/api/v1/patient/representations/active/")
        guardian_profile = self.guardian_client.get("/api/v1/patient/profile/")
        self.assertNotEqual(guardian_profile.data["data"]["id"], patient_id)
        self.assertEqual(self.guardian_client.get("/api/v1/patient/declarations/").data["data"], [])

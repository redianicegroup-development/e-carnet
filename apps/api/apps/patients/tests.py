from django.contrib.auth import get_user_model
from datetime import date, timedelta
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from apps.care.models import CareEncounter, PreConsultationRevision
from apps.audit.models import AuditEvent
from apps.establishments.models import Establishment, EstablishmentRecordOpening
from apps.identity.models import AccountContext
from .models import ClinicalDeclaration, PatientProfile, PatientRepresentation, RepresentationTransferRequest

User = get_user_model()


class PatientOwnedDataTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user(username="patient-a", password="local-test-password")
        self.b = User.objects.create_user(username="patient-b", password="local-test-password")
        self.client = APIClient()


    def test_profile_gender_is_optional_and_saved_as_patient_declared_information(self):
        self.client.force_authenticate(self.a)
        self.assertEqual(self.client.get("/api/v1/patient/profile/").data["data"]["gender"], "")
        updated = self.client.patch("/api/v1/patient/profile/", {"gender": "female"}, format="json")
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["data"]["gender"], "female")
        invalid = self.client.patch("/api/v1/patient/profile/", {"gender": "unknown"}, format="json")
        self.assertEqual(invalid.status_code, 400)

    def test_profile_and_declarations_are_isolated(self):
        self.client.force_authenticate(self.a)
        created = self.client.post("/api/v1/patient/declarations/", {"kind": "allergy", "label": "Pénicilline", "details": "Déclaration fictive de test"}, format="json")
        self.assertEqual(created.status_code, 201)
        self.client.force_authenticate(self.b)
        self.assertEqual(self.client.get("/api/v1/patient/declarations/").data["data"], [])
        self.assertEqual(self.client.get("/api/v1/patient/profile/").status_code, 200)

    def test_record_views_are_grouped_by_establishment_and_scoped_to_active_patient(self):
        user = User.objects.create_user(username="record-view-owner", first_name="Ada", last_name="Patient")
        patient = PatientProfile.objects.create(user=user)
        establishment = Establishment.objects.create(name="Clinique locale", status="active")
        other_establishment = Establishment.objects.create(name="Clinique distante", status="active")
        admin = User.objects.create_user(username="record-view-admin", first_name="Awa", last_name="Admin")
        EstablishmentRecordOpening.objects.create(
            establishment=establishment,
            patient=patient,
            opened_by=admin,
            reason_category="soins_en_cours",
            opened_at=timezone.now() - timedelta(hours=1),
            expires_at=timezone.now(),
        )
        latest_opening = EstablishmentRecordOpening.objects.create(
            establishment=establishment,
            patient=patient,
            opened_by=admin,
            reason_category="autre",
            reason_note="Contrôle administratif",
            opened_at=timezone.now(),
            expires_at=timezone.now() + timedelta(minutes=30),
        )
        EstablishmentRecordOpening.objects.create(
            establishment=other_establishment,
            patient=patient,
            opened_by=admin,
            reason_category="demande_patient",
            opened_at=timezone.now(),
            expires_at=timezone.now() + timedelta(minutes=30),
        )

        self.client.force_authenticate(user)
        response = self.client.get("/api/v1/patient/record-views/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertEqual(len(response.data["data"]), 2)
        local = next(item for item in response.data["data"] if item["establishment_id"] == str(establishment.id))
        self.assertEqual(local["establishment_name"], establishment.name)
        self.assertEqual(local["openings_count"], 2)
        self.assertEqual(local["last_opened_at"], latest_opening.opened_at)
        self.assertEqual(local["openings"][0]["opening_id"], str(latest_opening.id))
        latest = local["openings"][0]
        self.assertEqual(latest["who"], "Awa Admin")
        self.assertEqual(latest["role"], "establishment_admin")
        self.assertEqual(latest["reason_category"], "autre")
        self.assertEqual(latest["reason_label"], "Autre")
        self.assertEqual(latest["reason_note"], "Contrôle administratif")

        other_user = User.objects.create_user(username="record-view-other")
        PatientProfile.objects.create(user=other_user)
        self.client.force_authenticate(other_user)
        isolated = self.client.get("/api/v1/patient/record-views/")
        self.assertEqual(isolated.status_code, 200)
        self.assertEqual(isolated.data["data"], [])

    def test_record_views_requires_authentication(self):
        response = self.client.get("/api/v1/patient/record-views/")

        # DRF SessionAuthentication renvoie 403 lorsqu’aucun mécanisme d’authentification n’a pu authentifier la requête.
        self.assertEqual(response.status_code, 403)


    def test_height_and_weight_are_singleton_declarations_in_private_and_public_card(self):
        self.client.force_authenticate(self.a)
        self.assertEqual(self.declare("height", "172.5").status_code, 201)
        self.assertEqual(self.declare("weight", "68.2").status_code, 201)
        self.assertEqual(self.declare("height", "173").status_code, 201)
        self.assertEqual(self.declare("height", "999").status_code, 400)
        active = ClinicalDeclaration.objects.filter(patient__user=self.a, status="declared")
        self.assertEqual(list(active.filter(kind="height").values_list("label", flat=True)), ["173"])
        card = self.client.get("/api/v1/patient/emergency-card/").data["data"]
        self.assertEqual((card["height_cm"], card["weight_kg"]), ("173 cm", "68.2 kg"))
        self.client.patch("/api/v1/patient/emergency-card/", {"qr_enabled": True}, format="json")
        token = self.client.get("/api/v1/patient/emergency-card/").data["data"]["qr_token"]
        self.client.force_authenticate(None)
        public = self.client.get(f"/api/v1/patient/emergency-card/qr/{token}/").data["data"]
        self.assertEqual((public["height_cm"], public["weight_kg"]), ("173 cm", "68.2 kg"))

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

    def declare(self, kind, label, details=""):
        return self.client.post("/api/v1/patient/declarations/", {"kind": kind, "label": label, "details": details}, format="json")

    def test_emergency_qr_is_static_reads_the_carnet_live_and_can_only_be_switched_off(self):
        self.client.force_authenticate(self.a)
        self.declare("blood_group", "AB+")
        self.declare("allergy", "Pénicilline", "Réaction cutanée")
        self.declare("treatment", "Traitement fictif", "1 fois par jour")
        self.declare("city", "Abidjan")
        self.declare("emergency_contact", "Contact fictif", "+225 00 00 00 00")
        self.client.patch("/api/v1/patient/emergency-card/", {"qr_enabled": True}, format="json")
        first_token = self.client.get("/api/v1/patient/emergency-card/").data["data"]["qr_token"]
        self.assertTrue(first_token)

        self.client.force_authenticate(None)
        public = self.client.get(f"/api/v1/patient/emergency-card/qr/{first_token}/")
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.data["data"]["blood_group"], "AB+")
        self.assertEqual(public.data["data"]["allergies"][0]["label"], "Pénicilline")
        self.assertEqual(public.data["data"]["treatments"][0]["label"], "Traitement fictif")
        self.assertEqual(public.data["data"]["contact_name"], "Contact fictif")
        self.assertEqual(public.data["data"]["contact_phone"], "+225 00 00 00 00")
        self.assertEqual(public.data["data"]["city"], "Abidjan")
        self.assertEqual(public.data["data"]["declarations_provenance"]["allergy"]["code"], "patient_declared")
        self.assertIn("non confirmé", public.data["data"]["declarations_provenance"]["allergy"]["label"])
        self.assertEqual(set(public.data["data"]), {"first_name", "last_name", "city", "blood_group", "height_cm", "weight_kg", "allergies", "treatments", "contact_name", "contact_phone", "declarations_provenance", "updated_at"})
        # Jamais de date de naissance, d’adresse, de téléphone du patient ni d’identifiant interne sur la carte publique.
        for forbidden in ("birth_date", "address", "phone", "email", "id", "patient_id", "qr_token"):
            self.assertNotIn(forbidden, public.data["data"])
        self.assertIn("no-store", public["Cache-Control"])
        self.assertIn("noindex", public["X-Robots-Tag"])
        self.assertEqual(self.client.get("/api/v1/patient/emergency-card/qr/not-a-token/").status_code, 404)

        # Mise à jour automatique : le même QR affiche tout de suite la nouvelle ville et le nouveau contact.
        self.client.force_authenticate(self.a)
        self.declare("city", "Bouaké")
        self.declare("emergency_contact", "Autre contact", "+225 11 11 11 11")
        self.assertEqual(self.client.get("/api/v1/patient/emergency-card/").data["data"]["qr_token"], first_token)
        self.client.force_authenticate(None)
        live = self.client.get(f"/api/v1/patient/emergency-card/qr/{first_token}/").data["data"]
        self.assertEqual((live["city"], live["contact_name"], live["contact_phone"]), ("Bouaké", "Autre contact", "+225 11 11 11 11"))

        # Plus de renouvellement : le QR est unique et statique.
        self.client.force_authenticate(self.a)
        self.assertEqual(self.client.post("/api/v1/patient/emergency-card/", {}, format="json").status_code, 405)
        self.assertEqual(self.client.get("/api/v1/patient/emergency-card/").data["data"]["qr_token"], first_token)

        # Couper le QR le rend muet ; le rallumer redonne exactement le même QR.
        self.client.patch("/api/v1/patient/emergency-card/", {"qr_enabled": False}, format="json")
        self.assertEqual(self.client.get("/api/v1/patient/emergency-card/").data["data"]["qr_token"], "")
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/v1/patient/emergency-card/qr/{first_token}/").status_code, 404)
        self.client.force_authenticate(self.a)
        self.client.patch("/api/v1/patient/emergency-card/", {"qr_enabled": True}, format="json")
        self.assertEqual(self.client.get("/api/v1/patient/emergency-card/").data["data"]["qr_token"], first_token)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/v1/patient/emergency-card/qr/{first_token}/").status_code, 200)
        self.assertFalse(AuditEvent.objects.filter(event_type="patient.emergency_card.qr_rotated").exists())

    def test_city_and_emergency_contact_are_carnet_declarations_with_one_active_value(self):
        self.client.force_authenticate(self.a)
        self.assertEqual(self.declare("city", "Abidjan").status_code, 201)
        self.assertEqual(self.declare("city", "Yamoussoukro").status_code, 201)
        self.assertEqual(self.declare("emergency_contact", "Awa Koné", "+225 07 00 00 00 00").status_code, 201)
        self.assertEqual(self.declare("emergency_contact", "Awa Koné", "+225 05 00 00 00 00").status_code, 200)
        active = ClinicalDeclaration.objects.filter(patient__user=self.a, status="declared")
        self.assertEqual(list(active.filter(kind="city").values_list("label", flat=True)), ["Yamoussoukro"])
        contact = active.get(kind="emergency_contact")
        self.assertEqual((contact.label, contact.details), ("Awa Koné", "+225 05 00 00 00 00"))
        listed = self.client.get("/api/v1/patient/declarations/").data["data"]
        self.assertEqual({item["kind"] for item in listed}, {"city", "emergency_contact"})
        card = self.client.get("/api/v1/patient/emergency-card/").data["data"]
        self.assertEqual((card["city"], card["contact_name"], card["contact_phone"]), ("Yamoussoukro", "Awa Koné", "+225 05 00 00 00 00"))
        # Une déclaration de patient n’écrase jamais celle d’un autre.
        self.client.force_authenticate(self.b)
        self.assertEqual(self.client.get("/api/v1/patient/declarations/").data["data"], [])

    def test_emergency_contact_needs_a_valid_phone_and_city_has_no_details(self):
        self.client.force_authenticate(self.a)
        for phone in ("", "abc", "07", "<script>"):
            self.assertEqual(self.declare("emergency_contact", "Contact", phone).status_code, 400, phone)
        self.assertEqual(self.declare("emergency_contact", "N" * 121, "+225 07 00 00 00 00").status_code, 400)
        self.assertEqual(self.declare("city", "V" * 121).status_code, 400)
        created = self.declare("city", "Abidjan", "détail ignoré")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["data"]["details"], "")

    def test_card_settings_only_accept_the_qr_switch_and_refuse_the_moved_fields(self):
        self.client.force_authenticate(self.a)
        for payload in ({"city": "Abidjan"}, {"contact_name": "X"}, {"contact_phone": "+225 07 00 00 00 00"}, {"offline_declaration_ids": []}):
            self.assertEqual(self.client.patch("/api/v1/patient/emergency-card/", payload, format="json").status_code, 400, payload)
        self.assertEqual(self.client.patch("/api/v1/patient/emergency-card/", {"qr_enabled": True}, format="json").status_code, 200)
        data = self.client.get("/api/v1/patient/emergency-card/").data["data"]
        self.assertNotIn("offline_options", data)
        self.assertNotIn("offline_declaration_ids", data)

    def test_the_printable_offline_card_no_longer_exists(self):
        self.client.force_authenticate(self.a)
        self.assertEqual(self.client.get("/api/v1/patient/emergency-card/offline/").status_code, 404)

    def test_migration_copies_the_old_card_city_and_contact_into_declarations_without_clearing_the_card(self):
        import importlib
        from django.apps import apps as django_apps
        from .models import PatientEmergencyCard
        profile = PatientProfile.objects.create(user=self.a)
        PatientEmergencyCard.objects.create(patient=profile, city="Abidjan", contact_name="Contact hérité", contact_phone="+225 00 00 00 00")
        silent = PatientProfile.objects.create(user=self.b)
        PatientEmergencyCard.objects.create(patient=silent)
        migration = importlib.import_module("apps.patients.migrations.0008_declarations_city_and_emergency_contact")
        migration.copy_card_details_to_declarations(django_apps, None)
        migration.copy_card_details_to_declarations(django_apps, None)  # idempotent
        rows = ClinicalDeclaration.objects.filter(patient=profile)
        self.assertEqual(sorted(rows.values_list("kind", "label", "details")), [("city", "Abidjan", ""), ("emergency_contact", "Contact hérité", "+225 00 00 00 00")])
        self.assertFalse(ClinicalDeclaration.objects.filter(patient=silent).exists())
        self.assertEqual(PatientEmergencyCard.objects.get(patient=profile).city, "Abidjan")

    def test_patient_cannot_close_a_preconsultation_and_a_closed_one_is_immutable(self):
        self.client.force_authenticate(self.a)
        created = self.client.post("/api/v1/patient/care/encounters/", {"reason": "Motif fictif", "observations": "Observation fictive"}, format="json")
        self.assertEqual(created.status_code, 201)
        pk = created.data["data"]["id"]
        # La clôture appartient au médecin : l’ancienne route patient n’existe plus.
        self.assertEqual(self.client.post(f"/api/v1/patient/care/encounters/{pk}/", {}, format="json").status_code, 405)
        self.assertEqual(CareEncounter.objects.get(pk=pk).status, "draft")
        self.assertEqual(PreConsultationRevision.objects.filter(encounter_id=pk).count(), 0)
        # Clôturée par le médecin (voir les tests de consultation), elle n’est plus modifiable par le patient.
        CareEncounter.objects.filter(pk=pk).update(status="closed", closed_at=timezone.now())
        blocked = self.client.patch(f"/api/v1/patient/care/encounters/{pk}/", {"reason": "Modification interdite"}, format="json")
        self.assertEqual(blocked.status_code, 409)
        # Le brouillon étant clos, le patient peut préparer la pré-consultation suivante.
        self.assertEqual(self.client.post("/api/v1/patient/care/encounters/", {"reason": "Nouveau motif"}, format="json").status_code, 201)

    def test_anonymous_patient_data_is_forbidden(self):
        self.assertEqual(self.client.get("/api/v1/patient/profile/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/patient/emergency-card/").status_code, 403)


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

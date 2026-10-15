from datetime import timedelta
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from apps.identity.models import AccountContext
from django.utils import timezone
from django.test import TestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient
from apps.patients.models import PatientProfile
from apps.establishments.models import Establishment, EstablishmentMembership
from apps.professionals.models import ProfessionalProfile
from apps.audit.models import AuditEvent
from .models import AccessGrant, CareEncounter, Consultation, ConsultationRevision

User = get_user_model()


class PatientAccessTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="patient-care", password="local-test-password")
        self.other = User.objects.create_user(username="other-care", password="local-test-password")
        self.profile = PatientProfile.objects.create(user=self.user)
        self.other_profile = PatientProfile.objects.create(user=self.other)
        self.client = APIClient()

    def qr(self, patient=None):
        """QR frais du patient : chaque demande professionnelle en exige un, à usage unique."""
        from .services import create_patient_qr_token
        return create_patient_qr_token(patient=patient or self.profile)

    def make_access_target(self, suffix):
        user = User.objects.create_user(
            username=f"doctor-{suffix}",
            email=f"doctor-{suffix}@example.test",
            password="a-long-local-password",
        )
        professional = ProfessionalProfile.objects.create(user=user, professional_title="Médecin")
        establishment = Establishment.objects.create(
            created_by=self.user,
            name=f"Clinique {suffix}",
            establishment_type="Clinique",
            city="Abidjan",
            address="Adresse fictive",
            phone="00000000",
            email=f"{suffix}@example.test",
            responsible_name="Responsable fictif",
            status="active",
        )
        return professional, establishment

    def test_patient_controls_two_extensions_then_revoke(self):
        professional, establishment = self.make_access_target("consent")
        grant = AccessGrant.objects.create(patient=self.profile, professional=professional, establishment=establishment, professional_name="Dr Test", facility_label=establishment.name, scope=["preconsultation"])
        self.client.force_authenticate(self.user)
        accepted = self.client.post(f"/api/v1/patient/care/access-grants/{grant.id}/accept/")
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.data["data"]["status"], "active")
        self.assertEqual(self.client.post(f"/api/v1/patient/care/access-grants/{grant.id}/extend/").status_code, 200)
        self.assertEqual(self.client.post(f"/api/v1/patient/care/access-grants/{grant.id}/extend/").status_code, 200)
        self.assertEqual(self.client.post(f"/api/v1/patient/care/access-grants/{grant.id}/extend/").status_code, 409)
        self.assertEqual(self.client.post(f"/api/v1/patient/care/access-grants/{grant.id}/revoke/").data["data"]["status"], "revoked")
        events = AuditEvent.objects.filter(access_grant=grant)
        self.assertEqual(events.count(), 4)
        self.assertTrue(all("clinical_text" not in event.metadata for event in events))
        event = events.first()
        event.event_type = "audit.modified"
        with self.assertRaises(TypeError):
            event.save()
        with self.assertRaises(TypeError):
            event.delete()
        with self.assertRaises(TypeError):
            events.update(event_type="audit.modified")
        with self.assertRaises(TypeError):
            events.delete()

    def test_expired_grant_is_audited_once_as_a_system_transition(self):
        professional, establishment = self.make_access_target("expiry")
        grant = AccessGrant.objects.create(
            patient=self.profile,
            professional=professional,
            establishment=establishment,
            professional_name="Médecin fictif",
            facility_label=establishment.name,
            scope=["preconsultation"],
            status="active",
            starts_at=timezone.now() - timedelta(hours=3),
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        self.client.force_authenticate(self.user)
        self.client.get("/api/v1/patient/care/access-grants/")
        self.client.get("/api/v1/patient/care/access-grants/")
        grant.refresh_from_db()
        event = AuditEvent.objects.get(access_grant=grant, event_type="access_grant.expired")
        self.assertEqual(grant.status, "expired")
        self.assertIsNone(event.actor)
        self.assertEqual(event.actor_role, "system")
        self.assertEqual(AuditEvent.objects.filter(access_grant=grant).count(), 1)

    def test_pending_request_can_be_refused_and_is_isolated(self):
        professional, establishment = self.make_access_target("refusal")
        grant = AccessGrant.objects.create(patient=self.profile, professional=professional, establishment=establishment, professional_name="Dr Test", facility_label=establishment.name, scope=["declarations"])
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/v1/patient/care/access-grants/").data["data"], [])
        self.client.force_authenticate(self.user)
        response = self.client.post(f"/api/v1/patient/care/access-grants/{grant.id}/refuse/")
        self.assertEqual(response.data["data"]["status"], "refused")
        self.assertIsNotNone(response.data["data"]["refused_at"])
        history = self.client.get("/api/v1/patient/care/access-audit/")
        self.assertEqual(history.status_code, 200)
        self.assertEqual([item["action"] for item in history.data["data"]], ["refuse"])
        self.assertNotIn("clinical_text", history.data["data"][0])

    def test_expired_pending_request_is_closed_before_a_new_request(self):
        doctor = User.objects.create_user(
            username="doctor-stale-pending",
            email="doctor-stale-pending@example.test",
            password="a-long-local-password",
        )
        profile = ProfessionalProfile.objects.create(user=doctor, professional_title="Médecin", verification_status="verified")
        AccountContext.objects.create(user=doctor, role="professional", is_active=True)
        establishment = Establishment.objects.create(
            created_by=self.user,
            name="Clinique demande expirée",
            establishment_type="Clinique",
            city="Abidjan",
            address="Adresse fictive",
            phone="00000000",
            email="stale@example.test",
            responsible_name="Responsable fictif",
            status="active",
        )
        EstablishmentMembership.objects.create(establishment=establishment, professional=profile, status="active")
        profile.active_establishment = establishment
        profile.save(update_fields=("active_establishment", "updated_at"))
        old = AccessGrant.objects.create(
            patient=self.profile,
            professional=profile,
            establishment=establishment,
            professional_name="Médecin",
            facility_label=establishment.name,
            scope=["preconsultation"],
        )
        AccessGrant.objects.filter(pk=old.pk).update(expires_at=timezone.now() - timedelta(seconds=1))

        self.client.force_authenticate(doctor)
        response = self.client.post(
            "/api/v1/patient/care/professional/access-grants/",
            {"qr_token": self.qr(), "scope": ["preconsultation"]},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        old.refresh_from_db()
        self.assertEqual(old.status, "expired")
        self.assertTrue(AuditEvent.objects.filter(access_grant=old, event_type="access_grant.expired").exists())

    def test_expired_pending_request_cannot_be_accepted(self):
        professional, establishment = self.make_access_target("expired-consent")
        grant = AccessGrant.objects.create(
            patient=self.profile,
            professional=professional,
            establishment=establishment,
            professional_name="Médecin",
            facility_label=establishment.name,
            scope=["preconsultation"],
        )
        AccessGrant.objects.filter(pk=grant.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.client.force_authenticate(self.user)

        response = self.client.post(f"/api/v1/patient/care/access-grants/{grant.id}/accept/")

        self.assertEqual(response.status_code, 409)
        grant.refresh_from_db()
        self.assertEqual(grant.status, "expired")

    def test_access_grant_targets_are_required_and_open_requests_are_unique(self):
        professional, establishment = self.make_access_target("constraint")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                AccessGrant.objects.create(
                    patient=self.profile,
                    professional_name="Médecin",
                    facility_label=establishment.name,
                    scope=["preconsultation"],
                )

        grant = AccessGrant.objects.create(
            patient=self.profile,
            professional=professional,
            establishment=establishment,
            professional_name="Médecin",
            facility_label=establishment.name,
            scope=["preconsultation"],
        )
        self.assertAlmostEqual(
            (grant.expires_at - timezone.now()).total_seconds(),
            timedelta(days=7).total_seconds(),
            delta=2,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                AccessGrant.objects.filter(pk=grant.pk).update(expires_at=None)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                AccessGrant.objects.create(
                    patient=self.profile,
                    professional=professional,
                    establishment=establishment,
                    professional_name="Médecin",
                    facility_label=establishment.name,
                    scope=["preconsultation"],
                )

    def test_professional_clinical_reads_require_current_context_and_membership(self):
        doctor = User.objects.create_user(username="doctor-read-guard", password="local-test-password")
        profile = ProfessionalProfile.objects.create(user=doctor, professional_title="Médecin", verification_status="verified")
        establishment = Establishment.objects.create(created_by=self.user, name="Clinique garde", establishment_type="Clinique", city="Abidjan", address="G", phone="0", email="guard@example.test", responsible_name="Root", status="active", internal_code="GUARD-1")
        membership = EstablishmentMembership.objects.create(establishment=establishment, professional=profile, status="active")
        profile.active_establishment = establishment
        profile.save(update_fields=("active_establishment", "updated_at"))
        grant = AccessGrant.objects.create(patient=self.profile, professional=profile, establishment=establishment, professional_name="Médecin", facility_label=establishment.name, scope=["preconsultation"], status="active", starts_at=timezone.now(), expires_at=timezone.now() + timedelta(hours=1))
        self.client.force_authenticate(doctor)
        url = f"/api/v1/patient/care/professional/access-grants/{grant.id}/encounters/"

        self.assertEqual(self.client.get(url).status_code, 403)
        AccountContext.objects.create(user=doctor, role="professional", is_active=True)
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.get("/api/v1/patient/care/professional/consultations/").status_code, 200)

        grant.status = "revoked"
        grant.save(update_fields=("status",))
        self.assertEqual(self.client.get(url).status_code, 403)
        grant.status = "active"
        grant.expires_at = timezone.now() - timedelta(minutes=1)
        grant.save(update_fields=("status", "expires_at"))
        self.assertEqual(self.client.get(url).status_code, 403)
        grant.status = "active"
        grant.expires_at = timezone.now() + timedelta(hours=1)
        grant.save(update_fields=("status", "expires_at"))

        consultation = Consultation.objects.create(patient=self.profile, professional=profile, establishment=establishment, access_grant=grant, professional_name="Médecin", facility_label=establishment.name, reason="Motif synthétique", validated_at=timezone.now())
        membership.status = "suspended"
        membership.save(update_fields=("status",))
        self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(self.client.get("/api/v1/patient/care/professional/consultations/").status_code, 403)
        self.assertTrue(Consultation.objects.filter(pk=consultation.pk).exists())

    def test_nurse_role_and_endpoint_do_not_exist(self):
        roles = {value for value, _label in AccountContext.ROLE_CHOICES}
        self.assertNotIn("nurse", roles)
        self.assertEqual(self.client.get("/api/v1/patient/care/nurse/").status_code, 404)

    def test_patient_preconsultation_is_bound_to_active_site_not_free_text(self):
        site = Establishment.objects.create(created_by=self.user, name="Clinique officielle", establishment_type="Centre", city="Abidjan", address="A", phone="0", email="catalog@example.test", responsible_name="Root", status="active")
        self.client.force_authenticate(self.user)
        catalog = self.client.get("/api/v1/establishments/catalog/")
        self.assertEqual(catalog.status_code, 200)
        self.assertEqual(catalog.data["data"], [{"id": str(site.id), "name": site.name, "city": site.city}])
        response = self.client.post("/api/v1/patient/care/encounters/", {"establishment_id": str(site.id), "facility_label": "Clinique inventée", "reason": "Motif synthétique"}, format="json")
        self.assertEqual(response.status_code, 201)
        item = CareEncounter.objects.get(pk=response.data["data"]["id"])
        self.assertEqual(item.establishment_id, site.id)
        self.assertEqual(item.facility_label, site.name)
        self.assertNotEqual(item.facility_label, "Clinique inventée")

    def test_valid_grant_for_site_b_never_returns_site_a_preconsultations(self):
        doctor = User.objects.create_user(username="doctor-cross-site", password="local-test-password")
        profile = ProfessionalProfile.objects.create(user=doctor, professional_title="Médecin", verification_status="pending")
        site_a = Establishment.objects.create(created_by=self.user, name="Site A fictif", establishment_type="Centre", city="Abidjan", address="A", phone="0", email="site-a@example.test", responsible_name="Root A", status="active", internal_code="SITE-A-1")
        site_b = Establishment.objects.create(created_by=self.user, name="Site B fictif", establishment_type="Centre", city="Abidjan", address="B", phone="0", email="site-b@example.test", responsible_name="Root B", status="active", internal_code="SITE-B-1")
        EstablishmentMembership.objects.create(establishment=site_a, professional=profile, status="active")
        EstablishmentMembership.objects.create(establishment=site_b, professional=profile, status="active")
        profile.active_establishment = site_b
        profile.save(update_fields=("active_establishment", "updated_at"))
        AccountContext.objects.create(user=doctor, role="professional", is_active=True)
        encounter_a = CareEncounter.objects.create(patient=self.profile, establishment=site_a, facility_label=site_a.name, reason="Préconsultation de A", status="closed", closed_at=timezone.now())
        encounter_b = CareEncounter.objects.create(patient=self.profile, establishment=site_b, facility_label=site_b.name, reason="Préconsultation de B", status="closed", closed_at=timezone.now())
        grant_a = AccessGrant.objects.create(patient=self.profile, professional=profile, establishment=site_a, professional_name="Médecin", facility_label=site_a.name, scope=["preconsultation"], status="active", starts_at=timezone.now(), expires_at=timezone.now() + timedelta(hours=1))
        grant_b = AccessGrant.objects.create(patient=self.profile, professional=profile, establishment=site_b, professional_name="Médecin", facility_label=site_b.name, scope=["preconsultation"], status="active", starts_at=timezone.now(), expires_at=timezone.now() + timedelta(hours=1))
        Consultation.objects.create(patient=self.profile, professional=profile, establishment=site_a, access_grant=grant_a, professional_name="Médecin", facility_label=site_a.name, reason="Consultation fictive site A", validated_at=timezone.now())
        self.client.force_authenticate(doctor)

        grants_response = self.client.get("/api/v1/patient/care/professional/access-grants/")
        self.assertEqual(grants_response.status_code, 200)
        self.assertEqual([item["establishment_id"] for item in grants_response.data["data"]], [str(site_b.id)])
        response = self.client.get(f"/api/v1/patient/care/professional/access-grants/{grant_b.id}/encounters/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data["data"]], [str(encounter_b.id)])
        self.assertNotIn(str(encounter_a.id), [item["id"] for item in response.data["data"]])
        self.assertEqual(self.client.get(f"/api/v1/patient/care/professional/access-grants/{grant_a.id}/encounters/").status_code, 404)

        # Le choix d’une source A ne permet pas au médecin de B de créer une consultation.
        invalid = self.client.post("/api/v1/patient/care/professional/consultations/", {"access_grant_id": str(grant_b.id), "source_encounter_id": str(encounter_a.id), "attestation_svg": "<svg></svg>"}, format="json")
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(Consultation.objects.filter(access_grant=grant_b).count(), 0)

        self.client.force_authenticate(self.user)
        audit = self.client.get("/api/v1/patient/care/access-audit/")
        reads = [event for event in audit.data["data"] if event["action"] == "read_preconsultations"]
        self.assertEqual(len(reads), 1)
        self.assertEqual(reads[0]["resource_count"], 1)
        self.assertEqual(reads[0]["access_duration_minutes"], 60)
        self.assertIsNotNone(reads[0]["authorized_until"])
        self.assertEqual(reads[0]["facility_label"], site_b.name)
        self.assertNotIn("Préconsultation de B", str(audit.data))

    def test_consultations_are_read_only_and_patient_owned(self):
        Consultation.objects.create(patient=self.profile, professional_name="Dr Test", facility_label="Clinique fictive", reason="Motif fictif", validated_at=timezone.now())
        self.client.force_authenticate(self.user)
        self.assertEqual(len(self.client.get("/api/v1/patient/care/consultations/").data["data"]), 1)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/v1/patient/care/consultations/").data["data"], [])

    def test_professional_request_requires_active_establishment_and_membership(self):
        patient = self.profile
        doctor = User.objects.create_user(username="doctor-grant", email="doctor-grant@example.test", password="local-test-password", first_name="Docteur", last_name="Test")
        profile = ProfessionalProfile.objects.create(user=doctor, professional_title="Médecin", verification_status="verified")
        AccountContext.objects.create(user=doctor, role="professional", is_active=True)
        establishment = Establishment.objects.create(created_by=self.user, name="Clinique Grant", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="grant@example.test", responsible_name="Root", status="active", internal_code="GRANT-1")
        EstablishmentMembership.objects.create(establishment=establishment, professional=profile, status="active")
        profile.active_establishment = establishment
        profile.save(update_fields=("active_establishment", "updated_at"))
        self.client.force_authenticate(doctor)
        created = self.client.post("/api/v1/patient/care/professional/access-grants/", {"qr_token": self.qr(patient), "scope": ["preconsultation", "declarations"]}, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["data"]["status"], "pending")
        self.assertEqual(created.data["data"]["establishment_id"], str(establishment.id))

    def test_professional_can_request_with_qr_token_alone_without_patient_uuid(self):
        from .models import PatientAccessQrToken
        doctor = User.objects.create_user(username="doctor-qr-only", password="local-test-password")
        profile = ProfessionalProfile.objects.create(user=doctor, professional_title="Médecin", verification_status="verified")
        AccountContext.objects.create(user=doctor, role="professional", is_active=True)
        establishment = Establishment.objects.create(created_by=self.user, name="Clinique QR", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="qr@example.test", responsible_name="Root", status="active", internal_code="QR-ONLY")
        EstablishmentMembership.objects.create(establishment=establishment, professional=profile, status="active")
        profile.active_establishment = establishment
        profile.save(update_fields=("active_establishment", "updated_at"))

        patient_client = APIClient()
        patient_client.force_authenticate(self.user)
        qr = patient_client.post("/api/v1/patient/care/access-qr/")
        raw_token = qr.data["data"]["token"]
        self.client.force_authenticate(doctor)
        created = self.client.post("/api/v1/patient/care/professional/access-grants/", {"qr_token": raw_token, "scope": ["preconsultation", "declarations"]}, format="json")

        self.assertEqual(created.status_code, 201)
        # Le professionnel ne reçoit jamais l’identifiant du patient : seulement une référence propre à cet accès.
        self.assertNotIn("patient_id", created.data["data"])
        self.assertEqual(created.data["data"]["reference"], created.data["data"]["id"][:8].upper())
        token = PatientAccessQrToken.objects.get(patient=self.profile)
        self.assertIsNotNone(token.consumed_at)

    def test_professional_cannot_request_access_for_unknown_scope_or_duplicate(self):
        doctor = User.objects.create_user(username="doctor-duplicate", password="local-test-password")
        profile = ProfessionalProfile.objects.create(user=doctor, professional_title="Médecin", verification_status="verified")
        AccountContext.objects.create(user=doctor, role="professional", is_active=True)
        establishment = Establishment.objects.create(created_by=self.user, name="Clinique Grant 2", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="grant2@example.test", responsible_name="Root", status="active", internal_code="GRANT-2")
        EstablishmentMembership.objects.create(establishment=establishment, professional=profile, status="active")
        profile.active_establishment = establishment
        profile.save(update_fields=("active_establishment", "updated_at"))
        self.client.force_authenticate(doctor)
        unknown = self.client.post("/api/v1/patient/care/professional/access-grants/", {"qr_token": self.qr(), "scope": ["diagnostic"]}, format="json")
        self.assertEqual(unknown.status_code, 400)
        first = self.client.post("/api/v1/patient/care/professional/access-grants/", {"qr_token": self.qr(), "scope": ["preconsultation"]}, format="json")
        self.assertEqual(first.status_code, 201)
        duplicate = self.client.post("/api/v1/patient/care/professional/access-grants/", {"qr_token": self.qr(), "scope": ["preconsultation"]}, format="json")
        self.assertEqual(duplicate.status_code, 400)
        grant = AccessGrant.objects.get(patient=self.profile)
        self.client.force_authenticate(self.user)
        refused = self.client.post(f"/api/v1/patient/care/access-grants/{grant.id}/refuse/")
        self.assertEqual(refused.status_code, 200)
        self.client.force_authenticate(doctor)
        retry = self.client.post("/api/v1/patient/care/professional/access-grants/", {"qr_token": self.qr(), "scope": ["preconsultation"]}, format="json")
        self.assertEqual(retry.status_code, 400)
        AccessGrant.objects.filter(pk=grant.pk).update(refused_at=timezone.now() - timedelta(days=31))
        allowed = self.client.post("/api/v1/patient/care/professional/access-grants/", {"qr_token": self.qr(), "scope": ["preconsultation"]}, format="json")
        self.assertEqual(allowed.status_code, 201)

    def test_professional_validates_consultation_from_closed_encounter_with_server_context(self):
        doctor = User.objects.create_user(username="doctor-consult", password="local-test-password", first_name="Docteur", last_name="Validant")
        profile = ProfessionalProfile.objects.create(user=doctor, professional_title="Médecin", verification_status="verified")
        AccountContext.objects.create(user=doctor, role="professional", is_active=True)
        establishment = Establishment.objects.create(created_by=self.user, name="Clinique Consultation", establishment_type="Clinique", city="Abidjan", address="C", phone="0", email="consult@example.test", responsible_name="Root", status="active", internal_code="CONSULT-1")
        EstablishmentMembership.objects.create(establishment=establishment, professional=profile, status="active")
        profile.active_establishment = establishment
        profile.save(update_fields=("active_establishment", "updated_at"))
        encounter = CareEncounter.objects.create(patient=self.profile, establishment=establishment, facility_label=establishment.name, reason="Motif fictif", observations="Observations fictives", status="closed", closed_at=timezone.now())
        grant = AccessGrant.objects.create(patient=self.profile, professional=profile, establishment=establishment, professional_name="Docteur Validant", facility_label=establishment.name, scope=["preconsultation", "declarations"], status="active", starts_at=timezone.now() - timedelta(minutes=5), expires_at=timezone.now() + timedelta(hours=1))
        self.client.force_authenticate(doctor)
        response = self.client.post("/api/v1/patient/care/professional/consultations/", {"access_grant_id": str(grant.id), "source_encounter_id": str(encounter.id), "patient_id": str(self.other_profile.id), "professional_id": str(self.other.id), "establishment_id": str(self.other.id), "conclusion": "Conclusion fictive", "care_plan": "Suivi fictif", "attestation_svg": "<svg></svg>"}, format="json")
        self.assertEqual(response.status_code, 201)
        consultation = Consultation.objects.get()
        self.assertEqual(consultation.professional_id, profile.id)
        self.assertEqual(consultation.establishment_id, establishment.id)
        self.assertEqual(consultation.patient_id, self.profile.id)
        self.assertEqual(consultation.source_encounter_id, encounter.id)
        self.assertEqual(ConsultationRevision.objects.filter(consultation=consultation).count(), 1)
        self.client.force_authenticate(self.user)
        patient_history = self.client.get("/api/v1/patient/care/consultations/")
        self.assertEqual(patient_history.status_code, 200)
        self.assertEqual(patient_history.data["data"][0]["provenance"]["code"], "verified")

    def test_consultation_rejects_expired_grant_and_open_preconsultation(self):
        doctor = User.objects.create_user(username="doctor-expired", password="local-test-password")
        profile = ProfessionalProfile.objects.create(user=doctor, professional_title="Médecin", verification_status="verified")
        AccountContext.objects.create(user=doctor, role="professional", is_active=True)
        establishment = Establishment.objects.create(created_by=self.user, name="Clinique Expiree", establishment_type="Clinique", city="Abidjan", address="D", phone="0", email="expired@example.test", responsible_name="Root", status="active", internal_code="EXPIRE-1")
        EstablishmentMembership.objects.create(establishment=establishment, professional=profile, status="active")
        profile.active_establishment = establishment
        profile.save(update_fields=("active_establishment", "updated_at"))
        encounter = CareEncounter.objects.create(patient=self.profile, reason="Motif ouvert", status="draft")
        grant = AccessGrant.objects.create(patient=self.profile, professional=profile, establishment=establishment, professional_name="Médecin", facility_label=establishment.name, scope=["preconsultation"], status="active", starts_at=timezone.now() - timedelta(hours=3), expires_at=timezone.now() - timedelta(minutes=1))
        self.client.force_authenticate(doctor)
        response = self.client.post("/api/v1/patient/care/professional/consultations/", {"access_grant_id": str(grant.id), "source_encounter_id": str(encounter.id), "attestation_svg": "<svg></svg>"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Consultation.objects.count(), 0)

    def test_professional_reads_only_closed_encounters_after_active_grant(self):
        doctor = User.objects.create_user(username="doctor-read", password="local-test-password")
        profile = ProfessionalProfile.objects.create(user=doctor, professional_title="Médecin", verification_status="verified")
        AccountContext.objects.create(user=doctor, role="professional", is_active=True)
        establishment = Establishment.objects.create(created_by=self.user, name="Clinique Lecture", establishment_type="Clinique", city="Abidjan", address="E", phone="0", email="read@example.test", responsible_name="Root", status="active", internal_code="READ-1")
        EstablishmentMembership.objects.create(establishment=establishment, professional=profile, status="active")
        profile.active_establishment = establishment
        profile.save(update_fields=("active_establishment", "updated_at"))
        closed = CareEncounter.objects.create(patient=self.profile, establishment=establishment, facility_label=establishment.name, reason="Clos", status="closed", closed_at=timezone.now())
        CareEncounter.objects.create(patient=self.profile, reason="Brouillon", status="draft")
        grant = AccessGrant.objects.create(patient=self.profile, professional=profile, establishment=establishment, professional_name="Médecin", facility_label=establishment.name, scope=["preconsultation"], status="active", starts_at=timezone.now(), expires_at=timezone.now() + timedelta(hours=1))
        self.client.force_authenticate(doctor)
        response = self.client.get(f"/api/v1/patient/care/professional/access-grants/{grant.id}/encounters/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data["data"]], [str(closed.id)])

    def test_patient_consent_to_professional_consultation_and_revocation(self):
        doctor = User.objects.create_user(
            username="doctor-full-journey",
            first_name="Docteur",
            last_name="Parcours",
            password="local-test-password",
        )
        profile = ProfessionalProfile.objects.create(
            user=doctor,
            professional_title="Médecin",
            verification_status="verified",
        )
        AccountContext.objects.create(user=doctor, role="professional", is_active=True)
        establishment = Establishment.objects.create(
            created_by=self.user,
            name="Clinique Parcours",
            establishment_type="Clinique",
            city="Abidjan",
            address="Adresse fictive",
            phone="00000000",
            email="parcours@example.test",
            responsible_name="Responsable fictif",
            status="active",
            internal_code="FLOW-1",
        )
        EstablishmentMembership.objects.create(
            establishment=establishment,
            professional=profile,
            status="active",
        )
        profile.active_establishment = establishment
        profile.save(update_fields=("active_establishment", "updated_at"))

        patient_client = APIClient()
        patient_client.force_authenticate(self.user)
        professional_client = APIClient()
        professional_client.force_authenticate(doctor)

        request = professional_client.post(
            "/api/v1/patient/care/professional/access-grants/",
            {"qr_token": self.qr(), "scope": ["preconsultation"]},
            format="json",
        )
        self.assertEqual(request.status_code, 201)
        grant_id = request.data["data"]["id"]
        self.assertEqual(request.data["data"]["status"], "pending")

        denied_before_consent = professional_client.get(
            f"/api/v1/patient/care/professional/access-grants/{grant_id}/encounters/"
        )
        self.assertEqual(denied_before_consent.status_code, 403)

        consent = patient_client.post(
            f"/api/v1/patient/care/access-grants/{grant_id}/accept/"
        )
        self.assertEqual(consent.status_code, 200)
        self.assertEqual(consent.data["data"]["status"], "active")

        draft_response = patient_client.post(
            "/api/v1/patient/care/encounters/",
            {
                "establishment_id": str(establishment.id),
                "facility_label": establishment.name,
                "reason": "Pré-consultation en brouillon",
                "observations": "Cette version ne doit pas être accessible au professionnel.",
            },
            format="json",
        )
        self.assertEqual(draft_response.status_code, 201)
        draft_id = draft_response.data["data"]["id"]

        encounter_response = patient_client.post(
            "/api/v1/patient/care/encounters/",
            {
                "establishment_id": str(establishment.id),
                "facility_label": establishment.name,
                "reason": "Suivi de santé",
                "observations": "Informations communiquées par le patient.",
                "recorded_with_help": "Saisie par le patient",
            },
            format="json",
        )
        self.assertEqual(encounter_response.status_code, 201)
        encounter_id = encounter_response.data["data"]["id"]
        closed_encounter = patient_client.post(
            f"/api/v1/patient/care/encounters/{encounter_id}/",
            {},
            format="json",
        )
        self.assertEqual(closed_encounter.status_code, 200)
        self.assertEqual(closed_encounter.data["data"]["status"], "closed")

        authorized_encounters = professional_client.get(
            f"/api/v1/patient/care/professional/access-grants/{grant_id}/encounters/"
        )
        self.assertEqual(authorized_encounters.status_code, 200)
        self.assertEqual(
            [item["id"] for item in authorized_encounters.data["data"]],
            [encounter_id],
        )
        self.assertNotIn(
            draft_id,
            [item["id"] for item in authorized_encounters.data["data"]],
        )

        consultation_response = professional_client.post(
            "/api/v1/patient/care/professional/consultations/",
            {
                "access_grant_id": grant_id,
                "source_encounter_id": encounter_id,
                "conclusion": "Conclusion de suivi fictive.",
                "care_plan": "Contrôle ultérieur.",
                "attestation_svg": "<svg></svg>",
            },
            format="json",
        )
        self.assertEqual(consultation_response.status_code, 201)
        self.assertEqual(
            consultation_response.data["data"]["source_encounter_id"],
            encounter_id,
        )

        patient_history = patient_client.get("/api/v1/patient/care/consultations/")
        self.assertEqual(patient_history.status_code, 200)
        self.assertEqual(len(patient_history.data["data"]), 1)
        self.assertEqual(
            patient_history.data["data"][0]["provenance"]["code"], "verified"
        )

        revoked = patient_client.post(
            f"/api/v1/patient/care/access-grants/{grant_id}/revoke/"
        )
        self.assertEqual(revoked.status_code, 200)
        self.assertEqual(revoked.data["data"]["status"], "revoked")
        denied_after_revocation = professional_client.get(
            f"/api/v1/patient/care/professional/access-grants/{grant_id}/encounters/"
        )
        self.assertEqual(denied_after_revocation.status_code, 403)

class PatientQrContractTests(TestCase):
    def test_qr_contract_is_five_minutes_and_single_use_value_is_hashed(self):
        from .services import QR_TOKEN_TTL_SECONDS, create_patient_qr_token
        from .models import PatientAccessQrToken
        user = User.objects.create_user(username="qr-contract", password="local-test-password")
        profile = PatientProfile.objects.create(user=user)
        before = timezone.now()
        raw = create_patient_qr_token(patient=profile)
        token = PatientAccessQrToken.objects.get(patient=profile)
        self.assertEqual(QR_TOKEN_TTL_SECONDS, 300)
        self.assertGreaterEqual((token.expires_at - before).total_seconds(), 299)
        self.assertNotEqual(token.token_hash, raw)

class SvgSanitizerSecurityTests(TestCase):
    def test_svg_allows_drawing_primitives_and_normalizes_output(self):
        from .svg_sanitizer import sanitize_svg
        output = sanitize_svg('<svg viewBox="0 0 10 10"><path d="M0 0 L10 10" stroke="#000" fill="none" /></svg>')
        self.assertIn("<path", output)
        self.assertNotIn("  ", output)

    def test_svg_rejects_script_css_external_refs_and_foreign_namespace(self):
        from .svg_sanitizer import sanitize_svg
        payloads = (
            '<svg><script>alert(1)</script></svg>',
            '<svg><path style="fill:url(https://evil.test/x)" d="M0 0" /></svg>',
            '<svg><image href="https://evil.test/x" /></svg>',
            '<svg><path d="M0 0" fill="url(#paint)" /></svg>',
            '<svg xmlns="http://www.w3.org/2001/svg"><foreignObject><div>x</div></foreignObject></svg>',
            '<!DOCTYPE svg [<!ENTITY x "boom">]><svg>&x;</svg>',
        )
        for payload in payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(ValidationError):
                    sanitize_svg(payload)


class QrOnlyAndSingleUseTests(TestCase):
    """Le QR du patient est la seule porte d’entrée d’une demande d’accès, et il ne sert qu’une fois."""

    def setUp(self):
        self.patient_user = User.objects.create_user(username="qr-patient", password="local-test-password")
        self.profile = PatientProfile.objects.create(user=self.patient_user)
        self.establishment = Establishment.objects.create(created_by=self.patient_user, name="Clinique QR unique", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="qr-unique@example.test", responsible_name="Root", status="active", internal_code="QR-UNIQUE")
        self.doctor_a, self.client_a = self.make_professional("a")
        self.doctor_b, self.client_b = self.make_professional("b")

    def make_professional(self, suffix):
        user = User.objects.create_user(username=f"qr-doctor-{suffix}", email=f"qr-doctor-{suffix}@example.test", password="local-test-password")
        profile = ProfessionalProfile.objects.create(user=user, professional_title="Médecin", verification_status="verified")
        AccountContext.objects.create(user=user, role="professional", is_active=True)
        EstablishmentMembership.objects.create(establishment=self.establishment, professional=profile, status="active")
        profile.active_establishment = self.establishment
        profile.save(update_fields=("active_establishment", "updated_at"))
        client = APIClient()
        client.force_authenticate(user)
        return profile, client

    def new_qr(self):
        from .services import create_patient_qr_token
        return create_patient_qr_token(patient=self.profile)

    def request_access(self, client, payload):
        return client.post("/api/v1/patient/care/professional/access-grants/", payload, format="json")

    def test_a_patient_identifier_alone_never_opens_a_request(self):
        response = self.request_access(self.client_a, {"patient_id": str(self.profile.id), "scope": ["preconsultation"]})
        self.assertEqual(response.status_code, 400)
        self.assertIn("QR", response.data["message"])
        self.assertFalse(AccessGrant.objects.exists())

    def test_a_patient_identifier_is_ignored_when_a_qr_is_also_sent(self):
        other_user = User.objects.create_user(username="qr-other-patient", password="local-test-password")
        other = PatientProfile.objects.create(user=other_user)
        response = self.request_access(self.client_a, {"qr_token": self.new_qr(), "patient_id": str(other.id), "scope": ["preconsultation"]})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(AccessGrant.objects.get().patient_id, self.profile.id)

    def test_professional_payloads_never_contain_a_patient_identifier(self):
        created = self.request_access(self.client_a, {"qr_token": self.new_qr(), "scope": ["preconsultation"]})
        self.assertEqual(created.status_code, 201)
        listed = self.client_a.get("/api/v1/patient/care/professional/access-grants/")
        self.assertEqual(listed.status_code, 200)
        for payload in (created.data["data"], *listed.data["data"]):
            self.assertNotIn("patient_id", payload)
            self.assertNotIn(str(self.profile.id), str(payload))

    def test_after_revocation_a_new_request_needs_a_new_qr_from_the_patient(self):
        created = self.request_access(self.client_a, {"qr_token": self.new_qr(), "scope": ["preconsultation"]})
        grant_id = created.data["data"]["id"]
        patient_client = APIClient()
        patient_client.force_authenticate(self.patient_user)
        self.assertEqual(patient_client.post(f"/api/v1/patient/care/access-grants/{grant_id}/accept/").status_code, 200)
        self.assertEqual(patient_client.post(f"/api/v1/patient/care/access-grants/{grant_id}/revoke/").status_code, 200)
        # Rien de ce que le professionnel a reçu ne permet de redemander : sans QR, la demande est refusée.
        retry = self.request_access(self.client_a, {"patient_id": str(self.profile.id), "scope": ["preconsultation"]})
        self.assertEqual(retry.status_code, 400)
        self.assertEqual(AccessGrant.objects.filter(status="pending").count(), 0)
        # Avec un nouveau QR présenté par le patient, la demande est possible.
        again = self.request_access(self.client_a, {"qr_token": self.new_qr(), "scope": ["preconsultation"]})
        self.assertEqual(again.status_code, 201)

    def test_a_qr_token_works_once_even_for_two_professionals(self):
        raw = self.new_qr()
        first = self.request_access(self.client_a, {"qr_token": raw, "scope": ["preconsultation"]})
        second = self.request_access(self.client_b, {"qr_token": raw, "scope": ["preconsultation"]})
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)
        self.assertEqual(AccessGrant.objects.count(), 1)

    def test_consuming_a_stale_token_instance_fails(self):
        """Simule la course : deux appelants ont lu le même jeton valable, un seul peut le consommer."""
        from .services import consume_qr_token, patient_from_qr_token
        raw = self.new_qr()
        reader_one = patient_from_qr_token(raw)
        reader_two = patient_from_qr_token(raw)
        consume_qr_token(reader_one)
        with self.assertRaises(ValidationError):
            consume_qr_token(reader_two)

    def test_a_new_qr_invalidates_the_previous_one(self):
        old = self.new_qr()
        current = self.new_qr()
        refused = self.request_access(self.client_a, {"qr_token": old, "scope": ["preconsultation"]})
        self.assertEqual(refused.status_code, 400)
        accepted = self.request_access(self.client_a, {"qr_token": current, "scope": ["preconsultation"]})
        self.assertEqual(accepted.status_code, 201)

    def test_an_expired_qr_is_refused(self):
        from .models import PatientAccessQrToken
        raw = self.new_qr()
        PatientAccessQrToken.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        response = self.request_access(self.client_a, {"qr_token": raw, "scope": ["preconsultation"]})
        self.assertEqual(response.status_code, 400)

    def test_qr_creation_is_rate_limited_per_user(self):
        from django.conf import settings
        from .views import PatientAccessQrCreateView
        self.assertEqual(PatientAccessQrCreateView.throttle_scope, "qr_create")
        self.assertIn("qr_create", settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"])

    def test_cleanup_command_removes_only_old_expired_or_used_tokens(self):
        from io import StringIO
        from django.core.management import call_command
        from .models import PatientAccessQrToken
        now = timezone.now()
        old_expired = PatientAccessQrToken.objects.create(patient=self.profile, token_hash="a" * 64, expires_at=now - timedelta(days=3))
        old_used = PatientAccessQrToken.objects.create(patient=self.profile, token_hash="b" * 64, expires_at=now + timedelta(minutes=5), consumed_at=now - timedelta(days=3))
        recent_expired = PatientAccessQrToken.objects.create(patient=self.profile, token_hash="c" * 64, expires_at=now - timedelta(minutes=10))
        valid = PatientAccessQrToken.objects.create(patient=self.profile, token_hash="d" * 64, expires_at=now + timedelta(minutes=5))
        call_command("cleanup_access_qr_tokens", stdout=StringIO())
        remaining = set(PatientAccessQrToken.objects.values_list("pk", flat=True))
        self.assertEqual(remaining, {recent_expired.pk, valid.pk})
        self.assertNotIn(old_expired.pk, remaining)
        self.assertNotIn(old_used.pk, remaining)

    def test_creating_a_qr_also_purges_this_patients_old_tokens(self):
        from .models import PatientAccessQrToken
        old = PatientAccessQrToken.objects.create(patient=self.profile, token_hash="e" * 64, expires_at=timezone.now() - timedelta(days=3))
        self.new_qr()
        self.assertFalse(PatientAccessQrToken.objects.filter(pk=old.pk).exists())

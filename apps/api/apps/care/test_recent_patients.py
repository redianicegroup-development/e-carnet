from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.establishments.models import Establishment, EstablishmentMembership
from apps.identity.models import AccountContext
from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile

from .models import AccessGrant, Consultation


User = get_user_model()
URL = "/api/v1/patient/care/professional/recent-patients/"


class ProfessionalRecentPatientsTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="recent-doctor", password="local-test-password")
        self.profile = ProfessionalProfile.objects.create(
            user=self.owner, professional_title="Médecin", verification_status="verified"
        )
        AccountContext.objects.create(user=self.owner, role="professional", is_active=True)
        self.establishment = Establishment.objects.create(created_by=self.owner, name="Clinique récente", status="active")
        self.profile.active_establishment = self.establishment
        self.profile.save(update_fields=("active_establishment",))
        EstablishmentMembership.objects.create(
            establishment=self.establishment, professional=self.profile, status="active"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def patient(self, username, first_name, last_name):
        user = User.objects.create_user(username=username, password="local-test-password")
        return PatientProfile.objects.create(user=user, first_name=first_name, last_name=last_name)

    def grant(self, patient, *, expires_at=None):
        now = timezone.now()
        return AccessGrant.objects.create(
            patient=patient,
            professional=self.profile,
            establishment=self.establishment,
            professional_name="Médecin",
            facility_label=self.establishment.name,
            scope=["consultations"],
            status="active" if expires_at is None else "expired",
            starts_at=now - timedelta(hours=1),
            expires_at=expires_at or now + timedelta(hours=1),
        )

    def test_only_own_patients_and_only_the_three_allowed_fields(self):
        patient = self.patient("recent-owned", "Awa", "Kouassi")
        other_user = User.objects.create_user(username="other-doctor", password="local-test-password")
        other_profile = ProfessionalProfile.objects.create(user=other_user, professional_title="Médecin")
        self.grant(patient)
        other_patient = self.patient("recent-other", "Binta", "Traoré")
        AccessGrant.objects.create(
            patient=other_patient, professional=other_profile, establishment=self.establishment,
            professional_name="Autre", facility_label="Autre", scope=["consultations"],
            status="active", starts_at=timezone.now() - timedelta(hours=1), expires_at=timezone.now() + timedelta(hours=1),
        )
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], [{"first_name": "Awa", "last_name": "Kouassi", "last_accessed_at": response.data["data"][0]["last_accessed_at"]}])
        self.assertEqual(set(response.data["data"][0]), {"first_name", "last_name", "last_accessed_at"})

    def test_expired_grant_is_kept_thirty_days_but_older_one_is_not(self):
        recent = self.patient("recent-expired", "Nom", "Récent")
        old = self.patient("old-expired", "Nom", "Ancien")
        self.grant(recent, expires_at=timezone.now() - timedelta(days=29))
        self.grant(old, expires_at=timezone.now() - timedelta(days=31))
        AccessGrant.objects.filter(patient=recent).update(status="expired")
        AccessGrant.objects.filter(patient=old).update(status="expired")
        names = {(row["first_name"], row["last_name"]) for row in self.client.get(URL).data["data"]}
        self.assertIn(("Nom", "Récent"), names)
        self.assertNotIn(("Nom", "Ancien"), names)

    def test_inactive_account_is_excluded_and_twenty_limit_is_applied(self):
        blocked = self.patient("recent-blocked", "Compte", "Bloqué")
        blocked.user.is_active = False
        blocked.user.save(update_fields=("is_active",))
        self.grant(blocked)
        for index in range(25):
            self.grant(self.patient(f"recent-{index}", "Patient", str(index)))
        data = self.client.get(URL).data["data"]
        self.assertEqual(len(data), 20)
        self.assertNotIn("Bloqué", {row["last_name"] for row in data})

    def test_recent_consultation_can_seed_the_list_without_exposing_medical_data(self):
        patient = self.patient("consulted", "Consulté", "Aujourd’hui")
        grant = self.grant(patient)
        Consultation.objects.create(
            patient=patient, professional=self.profile, establishment=self.establishment,
            access_grant=grant, professional_name="Médecin", facility_label="Clinique",
            reason="Motif privé", validated_at=timezone.now(), diagnosis="Donnée privée",
        )
        row = self.client.get(URL).data["data"][0]
        self.assertEqual((row["first_name"], row["last_name"]), ("Consulté", "Aujourd’hui"))
        self.assertNotIn("diagnosis", row)

    # --- PRO-15 : garde-fous de la liste « patients récents » -------------------------------------------------

    def test_anonymous_request_is_refused(self):
        response = APIClient().get(URL)
        self.assertIn(response.status_code, (401, 403))

    def test_professional_without_active_establishment_is_refused_with_403(self):
        self.profile.active_establishment = None
        self.profile.save(update_fields=("active_establishment",))
        self.grant(self.patient("recent-no-etab", "Sans", "Établissement"))
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("data", response.data)

    def test_professional_without_active_membership_is_refused_with_403(self):
        EstablishmentMembership.objects.filter(professional=self.profile).update(status="suspended")
        self.grant(self.patient("recent-no-membership", "Sans", "Rattachement"))
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 403)

    def test_patient_context_user_has_no_professional_profile_and_is_refused(self):
        patient = self.patient("recent-just-patient", "Simple", "Patient")
        client = APIClient()
        client.force_authenticate(patient.user)
        self.assertEqual(client.get(URL).status_code, 403)

    def test_professional_context_must_be_selected(self):
        AccountContext.objects.filter(user=self.owner).update(is_active=False)
        self.assertEqual(self.client.get(URL).status_code, 403)

    def test_revoked_and_pending_grants_never_list_the_patient(self):
        revoked = self.patient("recent-revoked", "Accès", "Révoqué")
        pending = self.patient("recent-pending", "Accès", "Attente")
        self.grant(revoked)
        self.grant(pending)
        AccessGrant.objects.filter(patient=revoked).update(status="revoked")
        AccessGrant.objects.filter(patient=pending).update(status="pending")
        names = {row["last_name"] for row in self.client.get(URL).data["data"]}
        self.assertNotIn("Révoqué", names)
        self.assertNotIn("Attente", names)

    def test_consultation_older_than_thirty_days_does_not_keep_the_patient(self):
        patient = self.patient("recent-old-consult", "Consultation", "Ancienne")
        grant = self.grant(patient, expires_at=timezone.now() - timedelta(days=40))
        Consultation.objects.create(
            patient=patient, professional=self.profile, establishment=self.establishment,
            access_grant=grant, professional_name="Médecin", facility_label="Clinique",
            reason="Ancien motif", validated_at=timezone.now() - timedelta(days=45),
        )
        names = {row["last_name"] for row in self.client.get(URL).data["data"]}
        self.assertNotIn("Ancienne", names)

    def test_list_is_sorted_from_most_recent_access_and_has_no_identifier(self):
        older = self.patient("recent-sort-old", "Ancien", "Accès")
        newer = self.patient("recent-sort-new", "Nouveau", "Accès")
        self.grant(older, expires_at=timezone.now() - timedelta(days=10))
        AccessGrant.objects.filter(patient=older).update(status="expired", requested_at=timezone.now() - timedelta(days=12), starts_at=timezone.now() - timedelta(days=11))
        self.grant(newer)
        data = self.client.get(URL).data["data"]
        self.assertEqual([row["first_name"] for row in data], ["Nouveau", "Ancien"])
        for row in data:
            self.assertEqual(set(row), {"first_name", "last_name", "last_accessed_at"})

    def test_response_is_never_cached_by_the_browser(self):
        self.grant(self.patient("recent-nocache", "Sans", "Cache"))
        response = self.client.get(URL)
        self.assertEqual(response["Cache-Control"], "private, no-store")

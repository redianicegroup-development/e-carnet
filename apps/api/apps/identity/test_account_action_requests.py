from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.care.models import CareEncounter
from apps.patients.models import ClinicalDeclaration, PatientProfile, PatientRepresentation
from .auth_serializers import RegisterSerializer
from .models import AccountActionRequest


User = get_user_model()


class AccountActionRequestTests(TestCase):
    user_url = "/api/v1/identity/me/account-requests/"
    admin_url = "/api/v1/identity/admin/account-requests/"

    def setUp(self):
        self.user = User.objects.create_user(
            username="patient@example.test", email="patient@example.test", password="Test-password-2026!",
            first_name="Camille", last_name="Patient",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_suspension_is_immediate_closes_the_account_and_ends_by_itself(self):
        from datetime import timedelta

        from django.utils import timezone

        from .models import LoginEvent

        login = APIClient()
        self.assertEqual(login.post("/api/v1/identity/login/", {"email": "patient@example.test", "password": "Test-password-2026!"}, format="json").status_code, 200)
        response = login.post(self.user_url, {"request_type": "suspension", "suspension_days": 14, "reason": "privacy"}, format="json")
        self.assertEqual(response.status_code, 201)
        data = response.data["data"]
        self.assertEqual((data["suspension_days"], data["status"], data["reason"]), (14, "resolved", "privacy"))
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists(), "le compte n'est pas supprimé")
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active, "effet immédiat, sans validation de l'équipe")
        self.assertEqual(login.get("/api/v1/identity/me/").status_code, 403, "la session en cours est fermée")
        item = AccountActionRequest.objects.get()
        self.assertGreater(item.suspended_until, timezone.now() + timedelta(days=13))

        # Pendant la suspension : bon mot de passe → message clair ; mauvais mot de passe → message neutre (rien n'est révélé).
        blocked = APIClient().post("/api/v1/identity/login/", {"email": "patient@example.test", "password": "Test-password-2026!"}, format="json")
        self.assertEqual((blocked.status_code, blocked.data["code"]), (403, "account_suspended"))
        self.assertIn("suspendu jusqu’au", blocked.data["message"])
        wrong = APIClient().post("/api/v1/identity/login/", {"email": "patient@example.test", "password": "mauvais-mot-de-passe"}, format="json")
        self.assertEqual((wrong.status_code, wrong.data["code"]), (400, "invalid_credentials"))
        self.assertTrue(LoginEvent.objects.filter(user=self.user, outcome="blocked").exists())

        # À l'échéance, la prochaine connexion rouvre le compte.
        AccountActionRequest.objects.filter(pk=item.pk).update(suspended_until=timezone.now() - timedelta(minutes=1))
        reopened = APIClient().post("/api/v1/identity/login/", {"email": "patient@example.test", "password": "Test-password-2026!"}, format="json")
        self.assertEqual(reopened.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        item.refresh_from_db()
        self.assertIsNotNone(item.lifted_at)

    def test_suspension_needs_a_reason_and_other_needs_details(self):
        missing = self.client.post(self.user_url, {"request_type": "suspension", "suspension_days": 7}, format="json")
        self.assertEqual(missing.status_code, 400)
        other = self.client.post(self.user_url, {"request_type": "suspension", "suspension_days": 7, "reason": "other"}, format="json")
        self.assertEqual(other.status_code, 400)
        self.assertFalse(AccountActionRequest.objects.exists())
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)

    def test_suspension_duration_must_be_one_of_the_offered_values(self):
        response = self.client.post(self.user_url, {"request_type": "suspension", "suspension_days": 10, "reason": "privacy"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(AccountActionRequest.objects.exists())

    def test_deletion_needs_no_reason_and_deletes_identity_immediately(self):
        patient = PatientProfile.objects.create(user=self.user, phone="+2250102030405", address="Adresse privée", coverage_provider="Assurance")
        ClinicalDeclaration.objects.create(patient=patient, kind="allergy", label="Allergie confidentielle")
        # Un ancien client qui envoie encore un motif : il est ignoré et jamais conservé.
        created = self.client.post(self.user_url, {"request_type": "deletion", "reason": "privacy", "details": "texte libre"}, format="json")
        self.assertEqual(created.status_code, 201)
        self.user.refresh_from_db()
        patient.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.assertFalse(self.user.email)
        self.assertFalse(self.user.get_full_name())
        self.assertFalse(self.user.has_usable_password())
        self.assertEqual(patient.phone, "")
        self.assertEqual(patient.address, "")
        self.assertFalse(ClinicalDeclaration.objects.filter(patient=patient).exists())
        saved_request = AccountActionRequest.objects.get()
        self.assertIsNone(saved_request.user_id)
        self.assertEqual((saved_request.status, saved_request.reason, saved_request.details), ("resolved", "", ""))
        self.assertTrue(created.data["data"]["account_deleted"])

        admin = User.objects.create_superuser(username="admin@example.test", email="admin@example.test", password="Test-password-2026!")
        admin_client = APIClient()
        admin_client.force_authenticate(admin)
        response = admin_client.get(self.admin_url)
        self.assertEqual(response.status_code, 200)
        row = response.data["data"][0]
        self.assertEqual(row["kind"], "deletion")
        self.assertEqual(set(row), {"id", "kind", "submitted_at"}, "le journal d'une suppression ne montre ni motif ni identité")

    def test_account_deletion_erases_the_records_of_the_account_and_of_its_children(self):
        patient = PatientProfile.objects.create(user=self.user, first_name="Camille", last_name="Patient", phone="+2250102030405")
        child = PatientProfile.objects.create(first_name="Awa", last_name="Koné")
        representation = PatientRepresentation.objects.create(guardian=self.user, patient=child, relationship="child")
        ClinicalDeclaration.objects.create(patient=patient, kind="allergy", label="Allergie du titulaire")
        ClinicalDeclaration.objects.create(patient=child, kind="allergy", label="Allergie de l'enfant")
        encounter = CareEncounter.objects.create(patient=child, reason="Fièvre", observations="Toux", status="draft", vitals={"weight_kg": 20.0})
        created = self.client.post(self.user_url, {"request_type": "deletion"}, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertFalse(ClinicalDeclaration.objects.filter(patient__in=(patient, child)).exists(), "les lignes sont réellement supprimées de la base")
        child.refresh_from_db()
        self.assertEqual((child.first_name, child.last_name), ("", ""), "l'identité de l'enfant est effacée avec le compte du titulaire")
        encounter.refresh_from_db()
        self.assertEqual((encounter.reason, encounter.observations, encounter.vitals), ("", "", {}))
        representation.refresh_from_db()
        self.assertEqual((representation.status, representation.deletion_reason), ("deleted", "account_deleted"))

    def test_account_deletion_succeeds_for_a_patient_who_had_an_emergency_access(self):
        """Régression : le gestionnaire des accès d'urgence refuse update() (TypeError, « immuables »). L'effacement l'appelait pour vider le motif libre :
        TOUTE suppression de compte renvoyait donc une erreur 500. Le motif libre est maintenant remplacé, le reste (qui, quand, où) est conservé."""
        from datetime import timedelta

        from django.utils import timezone

        from apps.care.models import EmergencyAccessRequest
        from apps.care.tests import make_clinic_doctor
        from apps.patients.erasure import ERASED_EMERGENCY_NOTE

        patient = PatientProfile.objects.create(user=self.user, first_name="Camille", last_name="Patient")
        _doctor, profile, establishment = make_clinic_doctor(self.user, "acctdel")
        EmergencyAccessRequest.objects.create(
            patient=patient, professional=profile, establishment=establishment, professional_name="Docteur Acctdel", facility_label=establishment.name,
            reason_category="unconscious", reason_note="Camille retrouvée inconsciente chez elle", expires_at=timezone.now() + timedelta(hours=1),
            review_due_at=timezone.now() + timedelta(hours=72),
        )
        created = self.client.post(self.user_url, {"request_type": "deletion"}, format="json")
        self.assertEqual(created.status_code, 201)
        access = EmergencyAccessRequest.objects.get()
        self.assertEqual(access.reason_note, ERASED_EMERGENCY_NOTE)
        self.assertEqual((access.professional_name, access.reason_category), ("Docteur Acctdel", "unconscious"))
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_second_suspension_is_rejected_and_other_accounts_cannot_read_it(self):
        first = self.client.post(self.user_url, {"request_type": "suspension", "suspension_days": 7, "reason": "experience"}, format="json")
        self.assertEqual(first.status_code, 201)
        duplicate = self.client.post(self.user_url, {"request_type": "suspension", "suspension_days": 30, "reason": "experience"}, format="json")
        self.assertEqual(duplicate.status_code, 409)
        other = User.objects.create_user(username="other@example.test", email="other@example.test")
        other_client = APIClient()
        other_client.force_authenticate(other)
        own_requests = other_client.get(self.user_url)
        self.assertEqual(own_requests.status_code, 200)
        self.assertEqual(own_requests.data["data"], [])

    def test_journal_is_read_only_superadmin_only_and_shows_the_reason_of_a_suspension(self):
        self.client.post(self.user_url, {"request_type": "suspension", "suspension_days": 7, "reason": "privacy", "details": ""}, format="json")
        staff = User.objects.create_user(username="staff@example.test", is_staff=True)
        staff_client = APIClient()
        staff_client.force_authenticate(staff)
        self.assertEqual(staff_client.get(self.admin_url).status_code, 403)

        admin = User.objects.create_superuser(username="admin@example.test", email="admin@example.test", password="Test-password-2026!")
        admin_client = APIClient()
        admin_client.force_authenticate(admin)
        rows = admin_client.get(self.admin_url).data["data"]
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual((row["kind"], row["state"], row["reason"], row["suspension_days"]), ("suspension", "active", "privacy", 7))
        self.assertTrue(row["reason_label"])
        for forbidden in ("user_email", "user_name", "details", "status"):
            self.assertNotIn(forbidden, row)
        # L'équipe ne traite plus ces demandes : plus de changement de statut ni de suppression à sa main.
        item_id = row["id"]
        self.assertEqual(admin_client.patch(f"{self.admin_url}{item_id}/", {"status": "in_review"}, format="json").status_code, 404)
        self.assertEqual(admin_client.post(f"{self.admin_url}{item_id}/delete/", {}, format="json").status_code, 404)

    def test_admin_and_superadmin_accounts_cannot_be_deleted_or_suspended(self):
        for index, flags in enumerate(({"is_staff": True}, {"is_superuser": True, "is_staff": True})):
            privileged = User.objects.create_user(username=f"privileged-{index}@example.test", **flags)
            client = APIClient()
            client.force_authenticate(privileged)
            for payload in ({"request_type": "deletion"}, {"request_type": "suspension", "suspension_days": 7, "reason": "privacy"}):
                response = client.post(self.user_url, payload, format="json")
                self.assertEqual(response.status_code, 403)
            privileged.refresh_from_db()
            self.assertTrue(privileged.is_active)
            self.assertTrue(AccountActionRequest.objects.filter(user=privileged).count() == 0)

    def test_public_registration_cannot_create_an_admin_or_superadmin(self):
        serializer = RegisterSerializer(data={
            "email": "new-user@example.test", "password": "a-secure-test-password",
            "first_name": "Nouveau", "last_name": "Compte", "is_staff": True, "is_superuser": True,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        created = serializer.save()
        self.assertFalse(created.is_staff)
        self.assertFalse(created.is_superuser)

    def test_account_payload_admin_flag_is_server_controlled(self):
        ordinary = self.client.get("/api/v1/identity/me/")
        self.assertEqual(ordinary.status_code, 200)
        self.assertFalse(ordinary.data["data"]["is_admin"])
        admin = User.objects.create_superuser(username="flag-admin@example.test", email="flag-admin@example.test", password="Test-password-2026!")
        client = APIClient()
        client.force_authenticate(admin)
        response = client.get("/api/v1/identity/me/")
        self.assertTrue(response.data["data"]["is_admin"])

    def test_a_member_can_be_closed_by_the_team_only_through_the_users_console_never_by_deleting_a_request(self):
        admin = User.objects.create_superuser(username="root@example.test", email="root@example.test", password="Test-password-2026!")
        admin_client = APIClient()
        admin_client.force_authenticate(admin)
        item = AccountActionRequest.objects.create(user=self.user, request_type="deletion", reason="privacy")
        self.assertEqual(admin_client.post(f"{self.admin_url}{item.id}/delete/", {}, format="json").status_code, 404)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)

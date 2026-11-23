from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.identity.models import AccountContext
from apps.professionals.models import ProfessionalProfile
from .models import Establishment, EstablishmentAdministrator, EstablishmentMembership, EstablishmentNotification

User = get_user_model()
BASE = "/api/v1/establishments/notifications/"


class RoleNotificationTests(TestCase):
    """Boîte de notifications des espaces professionnel / établissement : demande reçue, décision, révocation, lecture, effacement, cloisonnement."""

    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(username="staff-rn", password="staff-password", is_staff=True)
        self.admin = User.objects.create_user(username="admin-rn", email="admin-rn@test", password="admin-password")
        self.doctor = User.objects.create_user(username="doctor-rn", email="doctor-rn@test", password="doctor-password", first_name="Aka", last_name="Mbollo")
        self.other = User.objects.create_user(username="other-rn", password="other-password")
        self.profile = ProfessionalProfile.objects.create(user=self.doctor, professional_title="Médecin", verification_status="pending")
        self.establishment = Establishment.objects.create(name="Clinique notif", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="n@test", responsible_name="Admin", status="active")
        EstablishmentAdministrator.objects.create(establishment=self.establishment, user=self.admin, assigned_by=self.staff)
        AccountContext.objects.create(user=self.admin, role="establishment", is_active=True)
        AccountContext.objects.create(user=self.doctor, role="professional", is_active=True)
        self.membership = EstablishmentMembership.objects.create(
            establishment=self.establishment, professional=self.profile, status="pending",
            agreement_version="2026-10-08-v1", agreement_accepted_by=self.doctor,
        )
        EstablishmentMembership.objects.filter(pk=self.membership.pk).update(agreement_accepted_at=self.membership.requested_at)

    def decide(self, decision):
        self.client.force_authenticate(self.admin)
        return self.client.post(f"/api/v1/establishments/{self.establishment.id}/memberships/{self.membership.id}/decision/", {"decision": decision}, format="json")

    def test_approval_reaches_the_professional_inbox_and_pulse(self):
        self.assertEqual(self.decide("approve").status_code, 200)
        self.client.force_authenticate(self.doctor)
        inbox = self.client.get(BASE + "inbox/").data["data"]
        self.assertEqual(inbox["unread_count"], 1)
        self.assertEqual(inbox["items"][0]["kind"], "membership.approved")
        self.assertIn("Clinique notif", inbox["items"][0]["body"])
        pulse = self.client.get(BASE + "pulse/").data["data"]
        self.assertEqual((pulse["unread_count"], pulse["total_count"]), (1, 1))

    def test_refusal_is_notified_and_a_repeated_decision_does_not_duplicate(self):
        self.assertEqual(self.decide("refuse").status_code, 200)
        self.assertEqual(self.decide("refuse").status_code, 400)  # plus en attente
        notifications = EstablishmentNotification.objects.filter(recipient=self.doctor)
        self.assertEqual(notifications.count(), 1)
        self.assertEqual(notifications.get().kind, "membership.refused")

    def test_inbox_is_private_and_can_be_read_deleted_and_cleared(self):
        self.decide("approve")
        mine = EstablishmentNotification.objects.get(recipient=self.doctor)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(BASE + "inbox/").data["data"]["total_count"], 0)
        self.assertEqual(self.client.patch(f"{BASE}{mine.id}/read/", {}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(f"{BASE}{mine.id}/").status_code, 404)

        self.client.force_authenticate(self.doctor)
        self.assertEqual(self.client.patch(f"{BASE}{mine.id}/read/", {}, format="json").status_code, 200)
        self.assertEqual(self.client.get(BASE + "pulse/").data["data"]["unread_count"], 0)
        self.assertEqual(self.client.delete(f"{BASE}{mine.id}/").status_code, 200)
        self.assertEqual(self.client.post(BASE + "read-all/", {}, format="json").status_code, 200)
        self.assertEqual(self.client.post(BASE + "clear/", {}, format="json").status_code, 200)

    def test_new_request_notifies_the_establishment_administrators(self):
        # Même effet que la saisie d'un code médecin : l'administrateur reçoit « Nouvelle demande de rattachement ».
        from .role_notifications import notify_user

        notify_user(self.admin, self.establishment, kind="membership.request", title="Nouvelle demande de rattachement", body="Aka Mbollo demande à rejoindre Clinique notif.", event_key="membership-request:test:1")
        notify_user(self.admin, self.establishment, kind="membership.request", title="Nouvelle demande de rattachement", body="doublon", event_key="membership-request:test:1")
        self.client.force_authenticate(self.admin)
        inbox = self.client.get(BASE + "inbox/").data["data"]
        self.assertEqual(inbox["total_count"], 1)
        self.assertEqual(inbox["items"][0]["title"], "Nouvelle demande de rattachement")


class LaboratoryAndStaffNotificationTests(TestCase):
    """Labo (bienvenue, collègue ajouté/retiré, structure suspendue) et équipe (retour utilisateur, demande de suspension)."""

    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(username="staff-ln", password="staff-password", is_staff=True)
        self.root = User.objects.create_user(username="root-ln", password="root-password", is_staff=True, is_superuser=True)
        self.admin = User.objects.create_user(username="admin-ln", email="admin-ln@test", password="admin-password")
        self.lab_admin = User.objects.create_user(username="lab-ln", email="lab-ln@test", password="lab-password")
        self.establishment = Establishment.objects.create(name="Clinique labo", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="l@test", responsible_name="Admin", status="active")
        self.laboratory = Establishment.objects.create(name="Laboratoire Clinique labo", establishment_type="Laboratoire", city="Abidjan", status="active", is_laboratory=True, parent=self.establishment)
        EstablishmentAdministrator.objects.create(establishment=self.establishment, user=self.admin, assigned_by=self.staff)
        EstablishmentAdministrator.objects.create(establishment=self.laboratory, user=self.lab_admin, assigned_by=self.staff)

    def inbox(self, user):
        self.client.force_authenticate(user)
        return self.client.get(BASE + "inbox/").data["data"]

    def test_suspension_and_reactivation_reach_the_establishment_and_its_laboratory(self):
        self.client.force_authenticate(self.staff)
        url = f"/api/v1/establishments/startup/{self.establishment.id}/status/"
        self.assertEqual(self.client.post(url, {"action": "suspend", "reason": "operational"}, format="json").status_code, 200)
        self.assertEqual(self.inbox(self.admin)["items"][0]["kind"], "establishment.suspended")
        lab_items = self.inbox(self.lab_admin)["items"]
        self.assertEqual(lab_items[0]["kind"], "establishment.suspended")
        self.assertIn("votre établissement", lab_items[0]["body"])
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.post(url, {"action": "reactivate"}, format="json").status_code, 200)
        self.assertEqual(self.inbox(self.admin)["items"][0]["kind"], "establishment.reactivated")

    def test_feedback_with_a_message_notifies_only_superusers_without_any_personal_content(self):
        response = APIClient().post("/api/v1/identity/feedback/", {"category": "bug", "message": "Le bouton ne répond pas sur mon téléphone.", "page": "/"}, format="json")
        self.assertEqual(response.status_code, 201)
        items = self.inbox(self.root)["items"]
        self.assertEqual(items[0]["kind"], "admin.feedback")
        self.assertNotIn("bouton", items[0]["body"])
        self.assertEqual(self.inbox(self.staff)["total_count"], 0)  # is_staff sans être super-administrateur : rien

    def test_a_good_rating_alone_does_not_disturb_the_team(self):
        response = APIClient().post("/api/v1/identity/feedback/", {"category": "idea", "message": "", "rating": 5, "page": "/"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.inbox(self.root)["total_count"], 0)

    def test_suspension_request_notifies_the_team(self):
        patient = User.objects.create_user(username="patient-ln", email="patient-ln@test", password="patient-password")
        self.client.force_authenticate(patient)
        response = self.client.post("/api/v1/identity/me/account-requests/", {"request_type": "suspension", "suspension_days": 14}, format="json")
        self.assertEqual(response.status_code, 201)
        items = self.inbox(self.root)["items"]
        self.assertEqual(items[0]["kind"], "admin.suspension_request")
        self.assertIn("14", items[0]["body"])
        self.assertNotIn("patient-ln", items[0]["body"])

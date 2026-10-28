"""Fiche d'un médecin dans l'équipe de l'établissement : nom, prénoms, métier et âge (jamais la date de naissance)."""
from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.models import AccountContext
from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile
from .models import Establishment, EstablishmentAdministrator, EstablishmentMembership

User = get_user_model()


class MemberDetailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(username="staff-show", password="staff-password", is_staff=True)
        self.admin = User.objects.create_user(username="admin-show", email="admin-show@test", password="admin-password")
        self.other_admin = User.objects.create_user(username="admin-other", email="admin-other@test", password="admin-password")
        self.doctor = User.objects.create_user(username="doctor-show", email="doctor-show@test", password="doctor-password", first_name="Awa", last_name="Kone")
        self.profile = ProfessionalProfile.objects.create(user=self.doctor, professional_title="Médecin", specialty="Gynécologue-obstétricien")
        self.establishment = Establishment.objects.create(name="Clinique affichage", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="show@test", responsible_name="Admin", status="active", logo_url="https://images.example.test/logo.png")
        self.other = Establishment.objects.create(name="Autre clinique", establishment_type="Clinique", city="Bouaké", address="B", phone="1", email="other@test", responsible_name="Autre", status="active")
        EstablishmentAdministrator.objects.create(establishment=self.establishment, user=self.admin, assigned_by=self.staff)
        EstablishmentAdministrator.objects.create(establishment=self.other, user=self.other_admin, assigned_by=self.staff)
        for user, role in ((self.admin, "establishment"), (self.other_admin, "establishment"), (self.doctor, "professional")):
            AccountContext.objects.create(user=user, role=role, is_active=True)

    def rows(self):
        EstablishmentMembership.objects.create(establishment=self.establishment, professional=self.profile, status="active")
        self.client.force_authenticate(self.admin)
        return self.client.get(f"/api/v1/establishments/{self.establishment.id}/memberships/").data["data"]

    def test_member_carries_names_and_job(self):
        row = self.rows()[0]
        self.assertEqual((row["professional_first_name"], row["professional_last_name"]), ("Awa", "Kone"))
        self.assertEqual((row["professional_title"], row["professional_specialty"]), ("Médecin", "Gynécologue-obstétricien"))

    def test_age_comes_from_the_patient_file_and_the_birth_date_is_never_sent(self):
        today = timezone.localdate()
        PatientProfile.objects.create(user=self.doctor, birth_date=date(today.year - 40, 1, 1))
        row = self.rows()[0]
        self.assertEqual(row["professional_age"], 40)  # né un 1er janvier : toujours 40 ans à partir de cette date
        self.assertNotIn("birth_date", row)

    def test_age_is_empty_when_the_doctor_did_not_fill_it(self):
        self.assertIsNone(self.rows()[0]["professional_age"])

    def test_the_administrator_can_end_a_membership(self):
        EstablishmentMembership.objects.create(establishment=self.establishment, professional=self.profile, status="active")
        membership = EstablishmentMembership.objects.get(professional=self.profile)
        self.client.force_authenticate(self.admin)
        response = self.client.post(f"/api/v1/establishments/{self.establishment.id}/memberships/{membership.id}/terminate/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        membership.refresh_from_db()
        self.assertNotEqual(membership.status, "active")

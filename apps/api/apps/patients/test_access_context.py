from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.test import TestCase

from .access import PatientAccess
from .models import PatientProfile, PatientRepresentation
from .views import profile_for


class PatientAccessContextTests(TestCase):
    def test_owner_context_is_attached_to_request(self):
        user = get_user_model().objects.create_user(username="access-owner")
        request = SimpleNamespace(session={})

        profile = profile_for(user, request)

        self.assertEqual(profile.user_id, user.id)
        self.assertEqual(request.patient_access, PatientAccess(mode="owner"))
        self.assertEqual(request.patient_access.scopes, frozenset({"*"}))

    def test_guardian_context_is_attached_without_changing_profile_resolution(self):
        guardian = get_user_model().objects.create_user(username="access-guardian")
        patient = PatientProfile.objects.create(first_name="Enfant")
        PatientRepresentation.objects.create(
            guardian=guardian,
            patient=patient,
            relationship="child",
            status="active",
        )
        request = SimpleNamespace(session={"active_patient_profile_id": str(patient.id)})

        result = profile_for(guardian, request)

        self.assertEqual(result, patient)
        self.assertEqual(request.patient_access, PatientAccess(mode="guardian"))

"""UX-01 : « Aucune allergie connue » et « Je ne sais pas » sont des choix ; le champ libre refuse les phrases de négation."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .allergy_rules import ALLERGY_NONE_LABEL, ALLERGY_UNKNOWN_LABEL, looks_like_allergy_negation
from .models import ClinicalDeclaration

User = get_user_model()
URL = "/api/v1/patient/declarations/"


class AllergyRulesTests(TestCase):
    def test_negation_phrases_are_recognised_including_the_common_typo(self):
        for phrase in ("Je n’es pas", "Je n'ai pas d'allergie", "non", "Aucune", "pas d'allergie", "N'a pas", "rien", "ne sais pas"):
            self.assertTrue(looks_like_allergy_negation(phrase), phrase)

    def test_real_allergies_and_the_two_exact_choices_are_not_negations(self):
        for label in ("Pénicilline", "Arachide", "Ail", "Anti-inflammatoires non stéroïdiens", "Pollen de bouleau", ALLERGY_NONE_LABEL, ALLERGY_UNKNOWN_LABEL):
            self.assertFalse(looks_like_allergy_negation(label), label)


class AllergyStateDeclarationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="allergy-patient", password="local-test-password")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def post(self, label, details=""):
        return self.client.post(URL, {"kind": "allergy", "label": label, "details": details}, format="json")

    def declared(self):
        return sorted(ClinicalDeclaration.objects.filter(kind="allergy", status="declared").values_list("label", flat=True))

    def test_a_negation_typed_as_free_text_is_refused_with_a_clear_message(self):
        refused = self.post("Je n’es pas")
        self.assertEqual(refused.status_code, 400)
        self.assertIn("Aucune allergie connue", refused.json()["label"][0])
        self.assertEqual(self.declared(), [])

    def test_no_known_allergy_is_a_declaration_without_details(self):
        created = self.post(ALLERGY_NONE_LABEL, "texte ignoré")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["data"]["details"], "")
        self.assertEqual(self.declared(), [ALLERGY_NONE_LABEL])

    def test_choosing_the_other_state_replaces_the_first_and_choosing_again_reactivates_it(self):
        self.post(ALLERGY_NONE_LABEL)
        self.assertEqual(self.post(ALLERGY_UNKNOWN_LABEL).status_code, 201)
        self.assertEqual(self.declared(), [ALLERGY_UNKNOWN_LABEL])
        again = self.post(ALLERGY_NONE_LABEL)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(self.declared(), [ALLERGY_NONE_LABEL])

    def test_a_real_allergy_replaces_the_state(self):
        self.post(ALLERGY_NONE_LABEL)
        self.assertEqual(self.post("Pénicilline").status_code, 201)
        self.assertEqual(self.declared(), ["Pénicilline"])

    def test_a_state_cannot_be_declared_next_to_real_allergies(self):
        self.post("Pénicilline")
        refused = self.post(ALLERGY_NONE_LABEL)
        self.assertEqual(refused.status_code, 400)
        self.assertEqual(self.declared(), ["Pénicilline"])

    def test_the_emergency_payload_carries_the_declaration_date_of_each_allergy(self):
        from .models import PatientEmergencyCard, PatientProfile
        from .views import emergency_card_data
        self.post("Pénicilline")
        patient = PatientProfile.objects.get(user=self.user)
        card, _ = PatientEmergencyCard.objects.get_or_create(patient=patient)
        allergies = emergency_card_data(card, public=False)["allergies"]
        self.assertEqual(allergies[0]["label"], "Pénicilline")
        self.assertIn("declared_at", allergies[0])

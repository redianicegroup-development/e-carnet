"""Établissements proches : l'administrateur pose l'épingle une fois, choisit d'apparaître dans la recherche, et les comptes connectés
lisent la liste des partenaires visibles. La position d'un patient n'est jamais envoyée ni stockée : aucune requête ne la porte."""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent

from .geo import InvalidLocation, validate_coordinates
from .models import Establishment, EstablishmentAdministrator, EstablishmentLocationChange

User = get_user_model()
DIRECTORY_URL = "/api/v1/establishments/directory/"
COCODY = {"latitude": 5.3599, "longitude": -4.0083}
PLATEAU = {"latitude": 5.3236, "longitude": -4.0196}
FICHE = {"establishment_type": "Clinique", "city": "Abidjan", "address": "Rue des Jardins", "phone": "+225 07 00 00 00 00"}


def make_user(email):
    return User.objects.create_user(username=email, email=email, password="a-very-long-password-2026")


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def visible_site(name, **overrides):
    """Structure qui remplit toutes les conditions pour figurer dans la recherche."""
    values = {**FICHE, "name": name, "status": "active", "is_listed_in_directory": True, "location_confirmed_at": timezone.now(), **COCODY}
    values.update(overrides)
    return Establishment.objects.create(**values)


class CoordinateValidationTests(SimpleTestCase):
    def refusal(self, latitude, longitude):
        with self.assertRaises(InvalidLocation) as caught:
            validate_coordinates(latitude, longitude)
        return caught.exception.code

    def test_valid_positions_in_cote_d_ivoire_are_accepted_and_rounded(self):
        self.assertEqual(validate_coordinates(5.35991234, -4.00831234), (5.359912, -4.008312))
        self.assertEqual(validate_coordinates("7.69", "-5.03"), (7.69, -5.03))  # Bouaké, valeurs saisies en texte

    def test_swapped_coordinates_are_named_as_such(self):
        self.assertEqual(self.refusal(-4.0083, 5.3599), "location_swapped")

    def test_positions_outside_the_country_zero_and_garbage_are_refused(self):
        self.assertEqual(self.refusal(48.85, 2.35), "location_outside_country")
        self.assertEqual(self.refusal(0, 0), "invalid_location")
        self.assertEqual(self.refusal(95, -4), "invalid_location")
        self.assertEqual(self.refusal("abc", 1), "invalid_location")
        self.assertEqual(self.refusal(float("nan"), -4), "invalid_location")

    def test_both_values_travel_together(self):
        self.assertEqual(self.refusal(5.3, None), "incomplete_location")
        self.assertEqual(self.refusal(None, None), "incomplete_location")


@override_settings(DEBUG=True)
class EstablishmentLocationTests(TestCase):
    def setUp(self):
        cache.clear()  # le compteur de limitation de débit vit dans le cache et les identifiants de test se réutilisent d'un test à l'autre
        self.staff = make_user("location-staff@example.test")
        self.owner = make_user("location-owner@example.test")
        self.other_owner = make_user("location-other@example.test")
        self.patient = make_user("location-patient@example.test")
        self.site = Establishment.objects.create(name="Clinique des Jardins", status="active", **FICHE)
        self.other_site = Establishment.objects.create(name="Clinique voisine", status="active", **FICHE)
        EstablishmentAdministrator.objects.create(establishment=self.site, user=self.owner, assigned_by=self.staff)
        EstablishmentAdministrator.objects.create(establishment=self.other_site, user=self.other_owner, assigned_by=self.staff)
        self.owner_client = client_for(self.owner)
        self.url = f"/api/v1/establishments/{self.site.id}/profile/"

    def patch(self, body, client=None):
        return (client or self.owner_client).patch(self.url, body, format="json")

    def test_a_new_establishment_has_no_position_and_is_not_listed(self):
        body = self.owner_client.get(self.url).data["data"]
        self.assertEqual((body["location_status"], body["latitude"], body["is_listed_in_directory"]), ("missing", None, False))

    def test_position_is_confirmed_once_recorded_and_audited_without_coordinates(self):
        response = self.patch(COCODY)
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data["data"]
        self.assertEqual((data["location_status"], data["latitude"], data["longitude"]), ("confirmed", 5.3599, -4.0083))
        self.assertIsNotNone(data["location_confirmed_at"])
        change = EstablishmentLocationChange.objects.get()
        self.assertEqual((change.changed_by, change.previous_latitude, change.latitude), (self.owner, None, 5.3599))
        event = AuditEvent.objects.get(event_type="establishment.location.confirmed")
        self.assertEqual(event.metadata, {"action": "confirmed", "status": "active"}, "les coordonnées n'entrent pas dans le journal d'audit")
        self.patch(COCODY)
        self.assertEqual(EstablishmentLocationChange.objects.count(), 1, "même épingle reconfirmée : pas de doublon")

    def test_moving_the_pin_keeps_the_previous_position_in_history(self):
        self.patch(COCODY)
        self.patch(PLATEAU)
        newest = EstablishmentLocationChange.objects.order_by("-created_at").first()
        self.assertEqual((newest.previous_latitude, newest.previous_longitude, newest.latitude), (5.3599, -4.0083, 5.3236))

    def test_refused_positions_save_nothing_not_even_the_other_fields(self):
        for body, code in (
            ({"latitude": 48.85, "longitude": 2.35}, "location_outside_country"),
            ({"latitude": -4.0083, "longitude": 5.3599}, "location_swapped"),
            ({"latitude": 0, "longitude": 0}, "invalid_location"),
            ({"latitude": 5.3599}, "incomplete_location"),
        ):
            response = self.patch({"name": "Nom qui ne doit pas passer", **body})
            self.assertEqual((response.status_code, response.data["code"]), (400, code), body)
        self.site.refresh_from_db()
        self.assertEqual((self.site.name, self.site.latitude), ("Clinique des Jardins", None))
        self.assertFalse(EstablishmentLocationChange.objects.exists())

    def test_only_the_administrator_of_this_establishment_can_change_the_position(self):
        for client in (client_for(self.other_owner), client_for(self.patient), APIClient()):
            self.assertIn(self.patch(COCODY, client).status_code, (401, 403))
        self.site.refresh_from_db()
        self.assertIsNone(self.site.latitude)

    def test_listing_is_refused_without_a_confirmed_position(self):
        refused = self.patch({"is_listed_in_directory": True})
        self.assertEqual((refused.status_code, refused.data["code"]), (400, "location_required"))
        self.patch(COCODY)
        accepted = self.patch({"is_listed_in_directory": True})
        self.assertEqual((accepted.status_code, accepted.data["data"]["is_listed_in_directory"]), (200, True))

    def test_listing_is_refused_while_the_profile_is_incomplete(self):
        incomplete = Establishment.objects.create(name="Fiche partielle", status="active", establishment_type="Clinique", city="Abidjan")
        EstablishmentAdministrator.objects.create(establishment=incomplete, user=self.other_owner, assigned_by=self.staff)
        url = f"/api/v1/establishments/{incomplete.id}/profile/"
        client = client_for(self.other_owner)
        self.assertEqual(client.patch(url, COCODY, format="json").status_code, 200)
        refused = client.patch(url, {"is_listed_in_directory": True}, format="json")
        self.assertEqual((refused.status_code, refused.data["code"]), (400, "profile_incomplete"))

    def test_a_laboratory_can_never_be_listed(self):
        lab = Establishment.objects.create(name="Labo des Jardins", status="active", is_laboratory=True, parent=self.site, **{**FICHE, "establishment_type": "Laboratoire"})
        EstablishmentAdministrator.objects.create(establishment=lab, user=self.other_owner, assigned_by=self.staff)
        url = f"/api/v1/establishments/{lab.id}/profile/"
        client = client_for(self.other_owner)
        client.patch(url, COCODY, format="json")
        refused = client.patch(url, {"is_listed_in_directory": True}, format="json")
        self.assertEqual((refused.status_code, refused.data["code"]), (400, "laboratory_not_listed"))
        self.assertFalse(client.get(url).data["data"]["can_be_listed"])

    def test_changing_the_address_asks_for_a_new_confirmation_and_hides_the_structure_meanwhile(self):
        self.patch({**COCODY, "is_listed_in_directory": True})
        reader = client_for(self.patient)
        self.assertEqual([item["name"] for item in reader.get(DIRECTORY_URL).data["data"]["items"]], ["Clinique des Jardins"])

        same = self.patch(FICHE)
        self.assertEqual(same.data["data"]["location_status"], "confirmed", "une fiche réenregistrée sans changement ne remet rien en cause")

        moved = self.patch({"address": "Nouvelle rue, Riviera"})
        self.assertEqual((moved.data["data"]["location_status"], moved.data["data"]["latitude"]), ("to_confirm", 5.3599), "l'ancienne épingle reste affichée pour être déplacée")
        self.assertEqual(reader.get(DIRECTORY_URL).data["data"]["items"], [], "pas de position confirmée, pas de recherche")
        self.assertTrue(moved.data["data"]["is_listed_in_directory"], "le choix de l'établissement est conservé")

        self.patch(PLATEAU)
        self.assertEqual([item["name"] for item in reader.get(DIRECTORY_URL).data["data"]["items"]], ["Clinique des Jardins"])

    def test_removing_the_position_also_removes_the_structure_from_the_search(self):
        self.patch({**COCODY, "is_listed_in_directory": True})
        removed = self.patch({"latitude": None, "longitude": None})
        data = removed.data["data"]
        self.assertEqual((data["location_status"], data["latitude"], data["is_listed_in_directory"]), ("missing", None, False))
        self.assertEqual(client_for(self.patient).get(DIRECTORY_URL).data["data"]["items"], [])
        self.assertTrue(AuditEvent.objects.filter(event_type="establishment.location.removed").exists())


@override_settings(DEBUG=True)
class EstablishmentDirectoryTests(TestCase):
    def setUp(self):
        cache.clear()
        self.reader = client_for(make_user("directory-reader@example.test"))

    def names(self):
        return [item["name"] for item in self.reader.get(DIRECTORY_URL).data["data"]["items"]]

    def test_anonymous_visitors_are_refused(self):
        self.assertIn(APIClient().get(DIRECTORY_URL).status_code, (401, 403))

    def test_only_listed_confirmed_complete_active_non_laboratory_structures_appear(self):
        visible_site("Clinique A")
        visible_site("Pas dans la recherche", is_listed_in_directory=False)
        visible_site("Suspendue", status="suspended")
        visible_site("Fiche incomplète", phone="")
        visible_site("Épingle à reconfirmer", location_confirmed_at=None)
        visible_site("Labo", is_laboratory=True)
        visible_site("Sans position", latitude=None, longitude=None, location_confirmed_at=None)
        self.assertEqual(self.names(), ["Clinique A"])

    def test_items_are_sorted_by_city_then_name_and_expose_nothing_internal(self):
        visible_site("Zeta", city="Abidjan")
        visible_site("Alpha", city="Bouaké", **{"latitude": 7.69, "longitude": -5.03})
        visible_site("Beta", city="Abidjan")
        response = self.reader.get(DIRECTORY_URL)
        items = response.data["data"]["items"]
        self.assertEqual([item["name"] for item in items], ["Beta", "Zeta", "Alpha"])
        self.assertEqual(set(items[0]), {"name", "establishment_type", "city", "address", "phone", "latitude", "longitude", "logo"})
        self.assertIn("no-store", response["Cache-Control"])

    def test_only_the_public_https_logo_is_exposed_never_the_internal_route(self):
        visible_site("Avec logo", logo_url="https://res.cloudinary.com/demo/image/upload/logo.webp")
        visible_site("Logo en base", logo_data="data:image/webp;base64,AAAA")  # développement : route interne avec identifiant
        visible_site("Logo non sûr", logo_url="http://exemple.test/logo.png")
        logos = {item["name"]: item["logo"] for item in self.reader.get(DIRECTORY_URL).data["data"]["items"]}
        self.assertEqual(logos["Avec logo"], "https://res.cloudinary.com/demo/image/upload/logo.webp")
        self.assertEqual((logos["Logo en base"], logos["Logo non sûr"]), ("", ""))

    def test_the_request_carries_no_position_and_query_parameters_change_nothing(self):
        visible_site("Clinique A")
        with_query = self.reader.get(DIRECTORY_URL, {"lat": "5.35", "lng": "-4.0"})
        self.assertEqual([item["name"] for item in with_query.data["data"]["items"]], ["Clinique A"])

    def test_response_is_flagged_when_the_list_is_cut(self):
        for name in ("A", "B", "C"):
            visible_site(f"Clinique {name}")
        with patch("apps.establishments.views.DIRECTORY_LIMIT", 2):
            data = self.reader.get(DIRECTORY_URL).data["data"]
        self.assertEqual((len(data["items"]), data["truncated"]), (2, True))

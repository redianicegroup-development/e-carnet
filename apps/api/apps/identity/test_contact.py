from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import ContactMessage

URL = "/api/v1/identity/contact/"
REAL_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "contact-tests"}}


def payload(**overrides):
    data = {
        "first_name": "Aïcha",
        "last_name": "Koné",
        "contact": "aicha.kone@example.test",
        "subject": "question",
        "message": "Bonjour, comment ouvrir un espace pour notre clinique ?",
        "consent": True,
    }
    data.update(overrides)
    return data


class PublicContactTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def post(self, **overrides):
        return self.client.post(URL, payload(**overrides), format="json")

    def test_valid_email_message_is_stored_without_tracking_data(self):
        response = self.post()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response["Cache-Control"], "no-store")
        contact = ContactMessage.objects.get()
        self.assertEqual((contact.first_name, contact.last_name), ("Aïcha", "Koné"))
        self.assertEqual((contact.contact_kind, contact.contact_value), ("email", "aicha.kone@example.test"))
        self.assertEqual(contact.subject, "question")
        self.assertEqual(contact.status, "new")
        stored_fields = {field.name for field in ContactMessage._meta.fields}
        self.assertFalse(stored_fields & {"ip", "ip_address", "user_agent", "path", "visitor_id"})

    def test_email_is_lowercased_and_phone_is_normalised(self):
        self.assertEqual(self.post(contact="  Aicha.Kone@Example.TEST ").status_code, 201)
        self.assertEqual(self.post(contact="+225 07 01 02 03 04").status_code, 201)
        self.assertEqual(self.post(contact="07.01.02.03.04").status_code, 201)
        values = list(ContactMessage.objects.order_by("submitted_at").values_list("contact_kind", "contact_value"))
        self.assertEqual(values, [("email", "aicha.kone@example.test"), ("phone", "+2250701020304"), ("phone", "0701020304")])

    def test_names_are_trimmed_and_inner_spaces_collapsed(self):
        self.assertEqual(self.post(first_name="  Jean   Marc ").status_code, 201)
        self.assertEqual(ContactMessage.objects.get().first_name, "Jean Marc")

    def test_each_invalid_field_is_reported_with_its_own_message(self):
        cases = {
            "first_name": "A",
            "last_name": "x" * 81,
            "contact": "pas-un-contact",
            "subject": "inconnu",
            "message": "court",
        }
        for field, bad_value in cases.items():
            with self.subTest(field=field):
                response = self.post(**{field: bad_value})
                self.assertEqual(response.status_code, 400)
                self.assertFalse(response.json()["success"])
                self.assertEqual(list(response.json()["errors"]), [field])
        self.assertEqual(ContactMessage.objects.count(), 0)

    def test_all_errors_come_back_together(self):
        response = self.client.post(URL, {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.json()["errors"]), {"first_name", "last_name", "contact", "subject", "message", "consent"})

    def test_consent_is_required_and_nothing_is_stored_without_it(self):
        response = self.client.post(URL, {key: value for key, value in payload().items() if key != "consent"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(list(response.json()["errors"]), ["consent"])
        self.assertEqual(response.json()["message"], "Cochez la case pour envoyer votre message.")
        self.assertEqual(ContactMessage.objects.count(), 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_only_a_json_true_counts_as_consent(self):
        for value in (False, None, "true", "on", "1", 1, 0, [True], {"a": True}):
            with self.subTest(consent=value):
                response = self.post(consent=value)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(list(response.json()["errors"]), ["consent"])
        self.assertEqual(ContactMessage.objects.count(), 0)
        self.assertEqual(self.post(consent=True).status_code, 201)

    def test_contact_rules(self):
        invalid = ["a@", "@example.test", "12345", "1" * 16, "07 01 02 03 0x", "https://exemple.test", "a" * 250 + "@example.test"]
        for value in invalid:
            with self.subTest(contact=value):
                self.assertEqual(self.post(contact=value).status_code, 400)
        self.assertEqual(ContactMessage.objects.count(), 0)

    def test_message_length_limits_and_control_characters(self):
        self.assertEqual(self.post(message="x" * 2001).status_code, 400)
        self.assertEqual(self.post(message="Bonjour\x00 équipe, une question ?").status_code, 400)
        self.assertEqual(self.post(message="x" * 2000).status_code, 201)
        self.assertEqual(self.post(message="Ligne un\nLigne deux\tavec tabulation").status_code, 201)

    def test_non_text_values_are_rejected_not_crashed(self):
        for field in ("first_name", "last_name", "contact", "subject", "message"):
            with self.subTest(field=field):
                self.assertEqual(self.post(**{field: ["liste"]}).status_code, 400)
                self.assertEqual(self.post(**{field: {"a": 1}}).status_code, 400)
                self.assertEqual(self.post(**{field: 123}).status_code, 400)
        self.assertEqual(self.client.post(URL, ["pas", "un", "objet"], format="json").status_code, 400)

    def test_honeypot_looks_like_a_success_but_stores_nothing(self):
        response = self.post(website="https://spam.example.test")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(ContactMessage.objects.count(), 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_form_encoded_body_is_refused(self):
        response = self.client.post(URL, payload())  # multipart : seul le JSON est accepté
        self.assertEqual(response.status_code, 415)

    def test_get_is_not_allowed(self):
        self.assertEqual(self.client.get(URL).status_code, 405)

    @override_settings(ECARNET_CONTACT_NOTIFY_TO="equipe@example.test, suivi@example.test")
    def test_team_notification_never_contains_personal_data(self):
        self.assertEqual(self.post(message="Mon numéro de dossier est 12345, merci.").status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.to, ["equipe@example.test", "suivi@example.test"])
        body = f"{sent.subject}\n{sent.body}"
        for secret in ("Aïcha", "Koné", "aicha.kone@example.test", "12345"):
            self.assertNotIn(secret, body)
        self.assertIn("Une question sur E-Carnet", sent.body)

    def test_no_notification_without_configured_recipient(self):
        self.assertEqual(self.post().status_code, 201)
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(ECARNET_CONTACT_NOTIFY_TO="equipe@example.test", EMAIL_BACKEND="apps.identity.test_contact.BrokenEmailBackend")
    def test_failed_notification_does_not_lose_the_message(self):
        with self.assertLogs("apps.identity.contact_views", level="ERROR"):
            response = self.post()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(ContactMessage.objects.count(), 1)


@override_settings(CACHES=REAL_CACHE)  # les autres tests tournent sans cache : aucune limitation à contourner
class ContactThrottlingTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_requests_are_limited_per_ip_not_per_cookie(self):
        for index in range(5):
            self.client.cookies["ecarnet_visitor"] = f"00000000-0000-0000-0000-00000000000{index}"  # un cookie se fabrique : sans effet
            self.assertEqual(self.client.post(URL, payload(), format="json").status_code, 201)
        self.client.cookies["ecarnet_visitor"] = "11111111-1111-1111-1111-111111111111"
        self.assertEqual(self.client.post(URL, payload(), format="json").status_code, 429)
        self.assertEqual(ContactMessage.objects.count(), 5)

    def test_invalid_submissions_also_count(self):
        statuses = [self.client.post(URL, {}, format="json").status_code for _ in range(6)]
        self.assertEqual(statuses, [400] * 5 + [429])


class BrokenEmailBackend:
    def __init__(self, *args, **kwargs):
        pass

    def send_messages(self, messages):
        raise ConnectionError("SMTP indisponible")

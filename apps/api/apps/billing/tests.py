import hashlib
import hmac
import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.establishments.models import Establishment, EstablishmentAdministrator, EstablishmentNotification

from . import services
from .models import BillingEvent, Invoice, Payment, Subscription

User = get_user_model()
BASE = "/api/v1/billing/"


def make_establishment(name="Clinique Test", status="active"):
    return Establishment.objects.create(name=name, establishment_type="Clinique", city="Abidjan", address="A", phone="0", email=f"{name[:4]}@test", responsible_name="R", status=status)


class BillingBase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(username="staff@test", email="staff@test", password="pw-staff-12345", is_staff=True)
        self.admin = User.objects.create_user(username="admin@test", email="admin@test", password="pw-admin-12345")
        self.other_admin = User.objects.create_user(username="other@test", email="other@test", password="pw-other-12345")
        self.establishment = make_establishment()
        self.other = make_establishment("Autre Centre")
        EstablishmentAdministrator.objects.create(establishment=self.establishment, user=self.admin, assigned_by=self.staff)
        EstablishmentAdministrator.objects.create(establishment=self.other, user=self.other_admin, assigned_by=self.staff)

    def as_admin(self):
        self.client.force_authenticate(self.admin)
        return self.client

    def subscribe(self, offer="essentiel"):
        response = self.as_admin().post(BASE + "establishment/subscribe/", {"offer": offer}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        return Invoice.objects.filter(establishment=self.establishment, status="pending").first()

    def paid_subscription(self, offer="essentiel", reference="TX-1"):
        invoice = self.subscribe(offer)
        services.confirm_payment(invoice.id, method="wave", provider="manual", provider_reference=reference, amount_fcfa=invoice.amount_fcfa, confirmed_by=self.staff)
        return Subscription.objects.get(establishment=self.establishment)


class SubscriptionFlowTests(BillingBase):
    def test_offers_prices_and_capacity_match_the_business_plan(self):
        data = self.as_admin().get(BASE + "establishment/").json()["data"]
        offers = {offer["code"]: offer for offer in data["offers"]}
        self.assertEqual((offers["essentiel"]["price_fcfa"], offers["essentiel"]["max_practitioners"]), (20000, 3))
        self.assertEqual((offers["professionnel"]["price_fcfa"], offers["professionnel"]["max_practitioners"]), (50000, 10))
        self.assertIsNone(offers["institutionnel"]["price_fcfa"])
        self.assertFalse(offers["institutionnel"]["self_service"])
        self.assertIsNone(data["subscription"])

    def test_subscribing_issues_a_numbered_invoice_and_waits_for_payment(self):
        invoice = self.subscribe()
        self.assertEqual((invoice.amount_fcfa, invoice.status), (20000, "pending"))
        self.assertRegex(invoice.number, r"^FAC-\d{4}-000001$")
        self.assertEqual(Subscription.objects.get().status, "pending_payment")

    def test_changing_offer_before_first_payment_replaces_the_pending_invoice(self):
        first = self.subscribe("essentiel")
        second = self.subscribe("professionnel")
        first.refresh_from_db()
        self.assertEqual((first.status, second.amount_fcfa), ("void", 50000))

    def test_institutional_offer_is_quote_only_and_unknown_offer_is_refused(self):
        self.as_admin()
        self.assertEqual(self.client.post(BASE + "establishment/subscribe/", {"offer": "institutionnel"}, format="json").status_code, 400)
        self.assertEqual(self.client.post(BASE + "establishment/subscribe/", {"offer": "gratuit"}, format="json").status_code, 400)

    def test_capacity_is_checked_against_active_practitioners(self):
        self.as_admin()
        with patch("apps.billing.services.practitioner_count", return_value=5):
            self.assertEqual(self.client.post(BASE + "establishment/subscribe/", {"offer": "essentiel"}, format="json").status_code, 400)
            self.assertEqual(self.client.post(BASE + "establishment/subscribe/", {"offer": "professionnel"}, format="json").status_code, 201)

    def test_only_the_administrator_of_that_establishment_sees_its_billing(self):
        self.subscribe()
        invoice = Invoice.objects.get()
        self.client.force_authenticate(self.other_admin)
        self.assertEqual(self.client.get(BASE + "establishment/", {"establishment": str(self.establishment.id)}).status_code, 403)
        self.assertEqual(self.client.post(BASE + f"invoices/{invoice.id}/pay/", {"method": "wave"}, format="json").status_code, 404)
        self.assertEqual(self.client.get(BASE + f"invoices/{invoice.id}/document/").status_code, 404)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(BASE + "establishment/").status_code, (401, 403))

    def test_plan_change_on_an_active_subscription_applies_to_the_next_period(self):
        subscription = self.paid_subscription("essentiel")
        self.as_admin().post(BASE + "establishment/subscribe/", {"offer": "professionnel"}, format="json")
        subscription.refresh_from_db()
        self.assertEqual((subscription.offer_code, subscription.next_offer_code), ("essentiel", "professionnel"))
        subscription.billed_through = timezone.localdate() + timedelta(days=3)
        subscription.save()
        self.assertEqual(services.generate_renewals(), 1)
        self.assertEqual(Invoice.objects.filter(status="pending").get().amount_fcfa, 50000)
        self.assertEqual(services.generate_renewals(), 0)


class PaymentTests(BillingBase):
    def test_pay_gives_instructions_with_the_invoice_reference_and_never_marks_paid(self):
        invoice = self.subscribe()
        response = self.as_admin().post(BASE + f"invoices/{invoice.id}/pay/", {"method": "orange_money"}, format="json")
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertIn(invoice.number, data["instructions"])
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, "pending")
        self.assertEqual(Payment.objects.get().status, "initiated")
        self.assertEqual(self.client.post(BASE + f"invoices/{invoice.id}/pay/", {"method": "bitcoin"}, format="json").status_code, 400)

    def test_the_browser_cannot_confirm_a_payment(self):
        invoice = self.subscribe()
        self.assertIn(self.client.post(BASE + f"staff/invoices/{invoice.id}/confirm-payment/", {"method": "wave", "provider_reference": "TX-9"}, format="json").status_code, (401, 403))
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, "pending")

    def test_staff_confirmation_activates_the_subscription_and_is_idempotent(self):
        invoice = self.subscribe()
        self.client.force_authenticate(self.staff)
        url = BASE + f"staff/invoices/{invoice.id}/confirm-payment/"
        self.assertEqual(self.client.post(url, {"method": "wave", "provider_reference": ""}, format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {"method": "wave", "provider_reference": "TX-1", "amount_fcfa": 15000}, format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {"method": "wave", "provider_reference": "TX-1"}, format="json").status_code, 200)
        self.assertEqual(self.client.post(url, {"method": "wave", "provider_reference": "TX-1"}, format="json").status_code, 200)
        invoice.refresh_from_db()
        subscription = Subscription.objects.get()
        self.assertEqual((invoice.status, subscription.status), ("paid", "active"))
        self.assertEqual(Payment.objects.filter(status="confirmed").count(), 1)
        self.assertEqual(subscription.current_period_end, invoice.period_end)
        self.assertTrue(BillingEvent.objects.filter(kind="payment_confirmed").exists())

    def test_a_transaction_reference_cannot_pay_two_invoices(self):
        first = self.subscribe()
        services.confirm_payment(first.id, method="wave", provider="manual", provider_reference="TX-SAME", amount_fcfa=20000, confirmed_by=self.staff)
        self.client.force_authenticate(self.other_admin)
        self.client.post(BASE + "establishment/subscribe/", {"offer": "essentiel"}, format="json")
        second = Invoice.objects.get(establishment=self.other)
        with self.assertRaises(services.BillingError):
            services.confirm_payment(second.id, method="wave", provider="manual", provider_reference="TX-SAME", amount_fcfa=20000)

    def sign(self, body, secret="s3cret"):
        return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    @override_settings(BILLING_WEBHOOK_SECRET="s3cret")
    def test_webhook_requires_a_valid_signature_and_is_replayable(self):
        invoice = self.subscribe()
        body = json.dumps({"invoice_number": invoice.number, "status": "succeeded", "method": "orange_money", "provider_reference": "OM-77", "amount_fcfa": 20000}).encode()
        url = BASE + "webhook/aggregator/"
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(url, body, content_type="application/json", HTTP_X_SIGNATURE="deadbeef").status_code, 401)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, "pending")
        good = self.client.post(url, body, content_type="application/json", HTTP_X_SIGNATURE=self.sign(body))
        self.assertEqual((good.status_code, good.json()["data"]["changed"]), (200, True))
        replay = self.client.post(url, body, content_type="application/json", HTTP_X_SIGNATURE=self.sign(body))
        self.assertEqual((replay.status_code, replay.json()["data"]["changed"]), (200, False))
        self.assertEqual(Payment.objects.filter(status="confirmed").count(), 1)

    @override_settings(BILLING_WEBHOOK_SECRET="s3cret")
    def test_webhook_rejects_a_wrong_amount(self):
        invoice = self.subscribe()
        body = json.dumps({"invoice_number": invoice.number, "status": "succeeded", "method": "wave", "provider_reference": "W-1", "amount_fcfa": 100}).encode()
        response = self.client.post(BASE + "webhook/aggregator/", body, content_type="application/json", HTTP_X_SIGNATURE=self.sign(body))
        self.assertEqual(response.status_code, 422)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, "pending")

    @override_settings(BILLING_WEBHOOK_SECRET="")
    def test_webhook_is_closed_until_a_secret_is_configured(self):
        self.assertEqual(self.client.post(BASE + "webhook/aggregator/", b"{}", content_type="application/json").status_code, 503)

    def test_invoice_document_is_escaped_and_staff_can_open_it(self):
        self.establishment.name = "<script>x</script>"
        self.establishment.save()
        invoice = self.subscribe()
        html = self.as_admin().get(BASE + f"invoices/{invoice.id}/document/").content.decode()
        self.assertIn(invoice.number, html)
        self.assertNotIn("<script>x</script>", html)
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get(BASE + f"invoices/{invoice.id}/document/").status_code, 200)


class DunningTests(BillingBase):
    def overdue(self, days):
        subscription = self.paid_subscription()
        Invoice.objects.filter(subscription=subscription, status="pending").delete()
        invoice = Invoice.objects.create(number=f"FAC-T-{days}", establishment=self.establishment, subscription=subscription, offer_code="essentiel", label="t", amount_fcfa=20000,
                                         period_start=timezone.localdate(), period_end=timezone.localdate(), due_date=timezone.localdate() - timedelta(days=days))
        return subscription, invoice

    def test_states_follow_the_age_of_the_oldest_unpaid_invoice(self):
        today = timezone.localdate()
        subscription, invoice = self.overdue(0)
        for days, expected in ((0, "active"), (1, "past_due"), (29, "past_due"), (30, "unpaid"), (59, "unpaid")):
            Invoice.objects.filter(pk=invoice.pk).update(due_date=today - timedelta(days=days))
            self.assertEqual(services.refresh_status(subscription, today), expected, f"{days} jours")
            self.establishment.refresh_from_db()
            self.assertEqual(self.establishment.status, "active", f"pas de suspension à {days} jours")

    def test_two_months_unpaid_suspends_the_establishment_and_payment_reactivates_it(self):
        subscription, invoice = self.overdue(60)
        self.assertEqual(services.refresh_status(subscription, timezone.localdate()), "suspended")
        self.establishment.refresh_from_db()
        self.assertEqual((self.establishment.status, self.establishment.suspension_reason), ("suspended", services.NON_PAYMENT_REASON))
        # l'administrateur suspendu peut encore ouvrir sa facturation pour régulariser
        data = self.as_admin().get(BASE + "establishment/").json()["data"]
        self.assertEqual(data["notice"]["level"], "danger")
        self.assertIn("patients gardent leur carnet", data["notice"]["message"])
        services.confirm_payment(invoice.id, method="wave", provider="manual", provider_reference="TX-REACT", amount_fcfa=20000, confirmed_by=self.staff)
        self.establishment.refresh_from_db()
        self.assertEqual((self.establishment.status, self.establishment.suspension_reason), ("active", ""))
        self.assertEqual(Subscription.objects.get().status, "active")
        kinds = set(BillingEvent.objects.values_list("kind", flat=True))
        self.assertTrue({"suspended", "reactivated"} <= kinds)

    def test_a_suspension_decided_by_the_team_is_never_lifted_by_a_payment(self):
        subscription, invoice = self.overdue(5)
        Establishment.objects.filter(pk=self.establishment.pk).update(status="suspended", suspension_reason="Vérification administrative")
        Subscription.objects.filter(pk=subscription.pk).update(status="suspended")
        services.confirm_payment(invoice.id, method="wave", provider="manual", provider_reference="TX-2", amount_fcfa=20000, confirmed_by=self.staff)
        self.establishment.refresh_from_db()
        self.assertEqual((self.establishment.status, self.establishment.suspension_reason), ("suspended", "Vérification administrative"))

    def test_notifications_are_sent_once_per_step_to_the_administrator(self):
        subscription, _ = self.overdue(3)
        services.refresh_status(subscription, timezone.localdate())
        services.refresh_status(subscription, timezone.localdate())
        self.assertEqual(EstablishmentNotification.objects.filter(recipient=self.admin, kind="billing.past_due").count(), 1)

    def test_never_paid_first_invoice_is_not_dunned_but_expires(self):
        invoice = self.subscribe()
        subscription = Subscription.objects.get()
        Invoice.objects.filter(pk=invoice.pk).update(due_date=timezone.localdate() - timedelta(days=90))
        self.assertEqual(services.refresh_status(subscription, timezone.localdate()), "pending_payment")
        Subscription.objects.filter(pk=subscription.pk).update(created_at=timezone.now() - timedelta(days=31))
        self.assertEqual(services.void_stale_first_invoices(), 1)
        self.assertEqual(Subscription.objects.get().status, "cancelled")
        self.assertEqual(Invoice.objects.get().status, "void")

    def test_no_new_invoice_is_issued_during_a_suspension(self):
        subscription, _ = self.overdue(70)
        Subscription.objects.filter(pk=subscription.pk).update(status="suspended", billed_through=timezone.localdate())
        self.assertEqual(services.generate_renewals(), 0)

    def test_staff_dashboard_lists_pending_amounts_and_days_overdue(self):
        self.overdue(12)
        self.client.force_authenticate(self.staff)
        rows = {row["name"]: row for row in self.client.get(BASE + "staff/subscriptions/").json()["data"]}
        self.assertEqual((rows["Clinique Test"]["pending_total_fcfa"], rows["Clinique Test"]["days_overdue"]), (20000, 12))
        self.assertEqual(rows["Autre Centre"]["subscription_status"], "none")
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(BASE + "staff/subscriptions/").status_code, 403)

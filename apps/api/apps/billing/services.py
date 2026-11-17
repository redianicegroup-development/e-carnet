"""Règles de facturation. Principe : le navigateur ne déclare jamais un paiement ; seul confirm_payment() le fait, appelé par le
webhook signé du prestataire ou par l'équipe E-Carnet. La suspension ne touche que l'espace professionnel de l'établissement :
aucune donnée patient n'est lue, supprimée ni bloquée ici."""
from calendar import monthrange
from datetime import date, timedelta

from django.db import transaction
from django.utils import timezone

from apps.establishments.models import Establishment, EstablishmentAdministrator, EstablishmentMembership, EstablishmentNotification

from .models import BillingEvent, Invoice, InvoiceSequence, Payment, Subscription
from .offers import CONDITIONS, METHODS, OFFERS, available_methods, conf, conf_int

NON_PAYMENT_REASON = "Impayé : abonnement non réglé (suspension automatique)"


class BillingError(Exception):
    """Message affichable tel quel."""


def thresholds():
    return {"due_days": conf_int("BILLING_DUE_DAYS", 7), "lead_days": conf_int("BILLING_RENEWAL_LEAD_DAYS", 7), "unpaid_after": conf_int("BILLING_UNPAID_AFTER_DAYS", 30), "suspend_after": conf_int("BILLING_SUSPEND_AFTER_DAYS", 60), "stale_first_invoice_days": conf_int("BILLING_STALE_FIRST_INVOICE_DAYS", 30)}


def add_months(day, months=1):
    index = day.month - 1 + months
    year, month = day.year + index // 12, index % 12 + 1
    return date(year, month, min(day.day, monthrange(year, month)[1]))


def practitioner_count(establishment):
    return EstablishmentMembership.objects.filter(establishment=establishment, status="active").count()


def log(establishment, kind, detail="", actor=None):
    return BillingEvent.objects.create(establishment=establishment, kind=kind, detail=detail[:300], actor=actor)


def notify(establishment, kind, title, body, key):
    for admin in EstablishmentAdministrator.objects.filter(establishment=establishment, status="active").select_related("user"):
        EstablishmentNotification.objects.get_or_create(recipient=admin.user, event_key=key, defaults={"establishment": establishment, "kind": kind, "title": title[:180], "body": body[:500]})


def next_invoice_number(year):
    InvoiceSequence.objects.get_or_create(year=year)
    sequence = InvoiceSequence.objects.select_for_update().get(year=year)
    sequence.last_number += 1
    sequence.save(update_fields=["last_number"])
    return f"FAC-{year}-{sequence.last_number:06d}"


def issue_invoice(subscription, *, offer_code, period_start, due_date, setup_fee=0):
    offer = OFFERS[offer_code]
    period_end = add_months(period_start, 1)
    with transaction.atomic():
        invoice = Invoice.objects.create(
            number=next_invoice_number(period_start.year), establishment=subscription.establishment, subscription=subscription, offer_code=offer_code,
            label=f"Abonnement {offer['name']} du {period_start:%d/%m/%Y} au {period_end:%d/%m/%Y}", setup_fee_fcfa=setup_fee, amount_fcfa=offer["price_fcfa"] + setup_fee,
            period_start=period_start, period_end=period_end, due_date=due_date)
        subscription.billed_through = period_end
        subscription.save(update_fields=["billed_through", "updated_at"])
        log(subscription.establishment, "invoice_issued", f"{invoice.number}, {invoice.amount_fcfa} FCFA, échéance {due_date:%d/%m/%Y}")
    notify(subscription.establishment, "billing.invoice", f"Nouvelle facture {invoice.number}", f"{invoice.amount_fcfa} FCFA à régler avant le {due_date:%d/%m/%Y}.", f"billing:invoice:{invoice.number}")
    return invoice


@transaction.atomic
def subscribe(establishment, offer_code, actor=None):
    offer = OFFERS.get(offer_code)
    if offer is None:
        raise BillingError("Offre inconnue.")
    if not offer["self_service"]:
        raise BillingError("Cette offre se souscrit sur devis : contactez l’équipe Mon E‑Carnet.")
    if offer["max_practitioners"] and practitioner_count(establishment) > offer["max_practitioners"]:
        raise BillingError(f"Votre établissement compte {practitioner_count(establishment)} praticiens actifs : l’offre {offer['name']} en accepte {offer['max_practitioners']} au plus.")
    today = timezone.localdate()
    setup_fee = conf_int("BILLING_SETUP_FEE_FCFA", 0)
    due = today + timedelta(days=thresholds()["due_days"])
    subscription = Subscription.objects.select_for_update().filter(establishment=establishment).first()
    if subscription is None:
        subscription = Subscription.objects.create(establishment=establishment, offer_code=offer_code)
        log(establishment, "subscribed", f"Offre {offer['name']}", actor)
        issue_invoice(subscription, offer_code=offer_code, period_start=today, due_date=due, setup_fee=setup_fee)
    elif subscription.status in ("pending_payment", "cancelled"):
        Invoice.objects.filter(subscription=subscription, status="pending").update(status="void")
        subscription.offer_code, subscription.next_offer_code, subscription.status = offer_code, "", "pending_payment"
        subscription.billed_through, subscription.current_period_end = None, None
        subscription.save()
        log(establishment, "subscribed", f"Offre {offer['name']}", actor)
        issue_invoice(subscription, offer_code=offer_code, period_start=today, due_date=due, setup_fee=setup_fee)
    else:
        if offer_code == subscription.offer_code and not subscription.next_offer_code:
            raise BillingError("C’est déjà votre offre.")
        subscription.next_offer_code = "" if offer_code == subscription.offer_code else offer_code
        subscription.save(update_fields=["next_offer_code", "updated_at"])
        log(establishment, "plan_changed", f"Offre {offer['name']} à la prochaine période", actor)
    return subscription


def initiate_payment(invoice, method):
    if invoice.status != "pending":
        raise BillingError("Cette facture n’est plus à régler.")
    if method not in available_methods():
        raise BillingError("Moyen de paiement indisponible.")
    payment = Payment.objects.filter(invoice=invoice, method=method, status="initiated").first()
    if payment is None:
        payment = Payment.objects.create(invoice=invoice, method=method, provider=conf("BILLING_PROVIDER", "manual"), reference=invoice.number, amount_fcfa=invoice.amount_fcfa)
    accounts = conf("BILLING_PAYMENT_ACCOUNTS", {})
    destination = accounts.get(method, "") if isinstance(accounts, dict) else ""
    where = f" au {destination}" if destination else " aux coordonnées communiquées par l’équipe Mon E‑Carnet"
    text = f"Réglez {invoice.amount_fcfa} FCFA par {METHODS[method]}{where}, en indiquant la référence {invoice.number}. Le paiement est confirmé par notre équipe dès réception, puis votre abonnement est mis à jour."
    return payment, text


@transaction.atomic
def confirm_payment(invoice_id, *, method, provider, provider_reference, amount_fcfa, confirmed_by=None):
    invoice = Invoice.objects.select_for_update().select_related("subscription", "establishment").get(pk=invoice_id)
    if invoice.status == "paid":
        return invoice, False  # idempotent : un webhook rejoué ne paie pas deux fois
    if invoice.status == "void":
        raise BillingError("Cette facture est annulée.")
    if int(amount_fcfa) != invoice.amount_fcfa:
        raise BillingError(f"Montant reçu ({amount_fcfa} FCFA) différent du montant dû ({invoice.amount_fcfa} FCFA).")
    if provider_reference and Payment.objects.filter(provider=provider, provider_reference=provider_reference).exclude(invoice=invoice).exists():
        raise BillingError("Cette référence de paiement est déjà utilisée pour une autre facture.")
    now = timezone.now()
    payment = Payment.objects.filter(invoice=invoice, status="initiated", method=method).first() or Payment(invoice=invoice, method=method, reference=invoice.number)
    payment.provider, payment.provider_reference, payment.amount_fcfa, payment.status, payment.confirmed_at, payment.confirmed_by = provider, provider_reference, invoice.amount_fcfa, "confirmed", now, confirmed_by
    payment.save()
    invoice.status, invoice.paid_at = "paid", now
    invoice.save(update_fields=["status", "paid_at"])
    subscription = Subscription.objects.select_for_update().get(pk=invoice.subscription_id)
    subscription.offer_code = invoice.offer_code
    if subscription.next_offer_code == invoice.offer_code:
        subscription.next_offer_code = ""
    if subscription.current_period_end is None or invoice.period_end > subscription.current_period_end:
        subscription.current_period_end = invoice.period_end
    subscription.save()
    log(invoice.establishment, "payment_confirmed", f"{invoice.number}, {METHODS.get(method, method)}", confirmed_by)
    notify(invoice.establishment, "billing.paid", f"Paiement reçu : {invoice.number}", "Merci. Votre abonnement est à jour pour cette période.", f"billing:paid:{invoice.number}")
    refresh_status(subscription)
    return invoice, True


def oldest_pending(subscription):
    return subscription.invoices.filter(status="pending").order_by("due_date").first()


def overdue_days(subscription, today):
    oldest = oldest_pending(subscription)
    return (today - oldest.due_date).days if oldest and oldest.due_date < today else 0


def refresh_status(subscription, today=None):
    """Recalcule l'état d'après la plus ancienne facture impayée, suspend ou réactive l'établissement au besoin. Retourne le nouvel état."""
    today = today or timezone.localdate()
    with transaction.atomic():
        subscription = Subscription.objects.select_for_update().get(pk=subscription.pk)
        if subscription.status == "cancelled" or subscription.current_period_end is None:
            return subscription.status  # jamais payée : pas de relance ni de suspension (voir void_stale_first_invoices)
        days, limits = overdue_days(subscription, today), thresholds()
        new = "suspended" if days >= limits["suspend_after"] else "unpaid" if days >= limits["unpaid_after"] else "past_due" if days >= 1 else "active"
        if new != subscription.status:
            _transition(subscription, new, days)
        return new


def _transition(subscription, new, days):
    old, establishment = subscription.status, subscription.establishment
    subscription.status = new
    subscription.save(update_fields=["status", "updated_at"])
    oldest = oldest_pending(subscription)
    key = oldest.number if oldest else "none"
    if new == "past_due":
        log(establishment, "past_due", f"Facture {key} en retard de {days} jour(s)")
        notify(establishment, "billing.past_due", "Facture en retard", f"La facture {key} est en retard. Votre accès est maintenu : réglez-la depuis Paramètres, Facturation.", f"billing:past_due:{key}")
    elif new == "unpaid":
        log(establishment, "unpaid", f"Facture {key} impayée depuis {days} jour(s)")
        notify(establishment, "billing.unpaid", "Facture impayée", f"La facture {key} reste impayée. L’accès professionnel sera suspendu en cas de nouveau retard.", f"billing:unpaid:{key}")
    elif new == "suspended":
        record = Establishment.objects.select_for_update().get(pk=establishment.pk)
        if record.status == "active":
            record.status, record.suspended_at, record.suspended_by, record.suspension_reason = "suspended", timezone.now(), None, NON_PAYMENT_REASON
            record.save(update_fields=["status", "suspended_at", "suspended_by", "suspension_reason"])
        log(establishment, "suspended", f"Suspension après {days} jour(s) d’impayé (facture {key})")
        notify(establishment, "billing.suspended", "Accès professionnel suspendu", "Faute de règlement, l’accès professionnel est suspendu. Vos patients gardent leur carnet. Réglez vos factures pour réactiver.", f"billing:suspended:{key}")
    if old == "suspended" and new != "suspended":
        record = Establishment.objects.select_for_update().get(pk=establishment.pk)
        if record.status == "suspended" and record.suspension_reason == NON_PAYMENT_REASON:  # jamais une suspension décidée par l'équipe pour un autre motif
            record.status, record.suspended_at, record.suspension_reason = "active", None, ""
            record.save(update_fields=["status", "suspended_at", "suspension_reason"])
            log(establishment, "reactivated", "Réactivation après règlement")
            notify(establishment, "billing.reactivated", "Accès professionnel rétabli", "Votre règlement est confirmé : l’accès professionnel est rétabli.", f"billing:reactivated:{timezone.now():%Y%m%d%H%M%S}")


def generate_renewals(today=None):
    today, created = today or timezone.localdate(), 0
    lead = timedelta(days=thresholds()["lead_days"])
    for subscription in Subscription.objects.filter(status__in=("active", "past_due", "unpaid"), billed_through__isnull=False).select_related("establishment"):
        if today >= subscription.billed_through - lead:
            offer_code = subscription.next_offer_code or subscription.offer_code
            issue_invoice(subscription, offer_code=offer_code, period_start=subscription.billed_through, due_date=max(subscription.billed_through, today))
            created += 1
    return created


def void_stale_first_invoices(today=None):
    today, cancelled = today or timezone.localdate(), 0
    limit = timezone.now() - timedelta(days=thresholds()["stale_first_invoice_days"])
    for subscription in Subscription.objects.filter(status="pending_payment", created_at__lt=limit).select_related("establishment"):
        Invoice.objects.filter(subscription=subscription, status="pending").update(status="void")
        subscription.status = "cancelled"
        subscription.save(update_fields=["status", "updated_at"])
        log(subscription.establishment, "cancelled", "Première facture non réglée : souscription annulée")
        cancelled += 1
    return cancelled


def process_all(today=None):
    """Tâche quotidienne : renouvellements, états, suspensions."""
    today = today or timezone.localdate()
    summary = {"renewals": generate_renewals(today), "cancelled": void_stale_first_invoices(today), "refreshed": 0}
    for subscription in Subscription.objects.exclude(status="cancelled"):
        refresh_status(subscription, today)
        summary["refreshed"] += 1
    return summary


def void_invoice(invoice, actor, reason=""):
    if invoice.status != "pending":
        raise BillingError("Seule une facture en attente peut être annulée.")
    invoice.status = "void"
    invoice.save(update_fields=["status"])
    log(invoice.establishment, "invoice_void", f"{invoice.number} annulée. {reason}", actor)
    refresh_status(invoice.subscription)
    return invoice


def display_status(invoice, today):
    if invoice.status == "pending" and invoice.due_date < today:
        return "overdue"
    return invoice.status


STATUS_LABELS = {"pending_payment": "En attente de paiement", "active": "Active", "past_due": "En retard", "unpaid": "Impayée", "suspended": "Suspendue", "cancelled": "Résiliée"}

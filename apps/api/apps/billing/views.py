import hashlib
import hmac
import json
import uuid

from django.http import HttpResponse
from django.utils import timezone
from django.utils.html import escape
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event
from apps.establishments.models import Establishment, EstablishmentAdministrator

from . import services
from .models import Invoice, Payment
from .offers import CONDITIONS, METHODS, OFFERS, available_methods, conf, conf_int
from .services import BillingError, display_status


class IsBillingStaff(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


def fail(message, status=400):
    return Response({"success": False, "message": message}, status=status)


def ok(data, status=200):
    return Response({"success": True, "data": data}, status=status)


def billing_administrator(user, establishment_id=None):
    """Administrateur actif d'un établissement ACTIF OU SUSPENDU : un établissement suspendu pour impayé doit pouvoir ouvrir
    sa facturation pour régulariser (le reste de l'espace établissement, lui, suit le statut de l'établissement)."""
    query = EstablishmentAdministrator.objects.filter(user=user, status="active", establishment__status__in=("active", "suspended")).select_related("establishment")
    if establishment_id:
        try:
            query = query.filter(establishment_id=uuid.UUID(str(establishment_id)))
        except ValueError:
            return None
    return query.order_by("establishment__name").first()


def offer_row(offer):
    return {"code": offer["code"], "name": offer["name"], "price_fcfa": offer["price_fcfa"], "capacity_label": offer["capacity_label"], "max_practitioners": offer["max_practitioners"], "self_service": offer["self_service"], "includes": offer["includes"]}


def invoice_row(invoice, today):
    return {"id": str(invoice.id), "number": invoice.number, "label": invoice.label, "offer_code": invoice.offer_code, "setup_fee_fcfa": invoice.setup_fee_fcfa, "amount_fcfa": invoice.amount_fcfa,
            "period_start": invoice.period_start, "period_end": invoice.period_end, "due_date": invoice.due_date, "status": display_status(invoice, today), "paid_at": invoice.paid_at,
            "document_url": f"/api/v1/billing/invoices/{invoice.id}/document/"}


def payment_row(payment):
    return {"id": str(payment.id), "invoice_number": payment.invoice.number, "method": payment.method, "method_label": METHODS.get(payment.method, payment.method), "status": payment.status, "amount_fcfa": payment.amount_fcfa, "created_at": payment.created_at, "confirmed_at": payment.confirmed_at}


def notice_for(subscription, today):
    if subscription is None:
        return None
    limits = services.thresholds()
    if subscription.status == "pending_payment":
        return {"level": "info", "message": "Votre première facture attend son règlement. L’abonnement démarre dès que le paiement est confirmé."}
    if subscription.status in ("past_due", "unpaid"):
        days = services.overdue_days(subscription, today)
        left = max(0, limits["suspend_after"] - days)
        return {"level": "warning", "message": f"Une facture est en retard de {days} jour(s). Votre accès est maintenu ; sans règlement, il sera suspendu dans {left} jour(s). Vos patients ne sont pas concernés."}
    if subscription.status == "suspended":
        return {"level": "danger", "message": "L’accès professionnel est suspendu faute de règlement. Vos patients gardent leur carnet, leurs accès et leur export. Réglez vos factures pour réactiver."}
    return None


def overview(establishment):
    today = timezone.localdate()
    subscription = getattr(establishment, "subscription", None)
    invoices = list(Invoice.objects.filter(establishment=establishment).exclude(status="void")[:60])
    payments = list(Payment.objects.filter(invoice__establishment=establishment).select_related("invoice")[:60])
    events = list(establishment.billing_events.all()[:40])
    sub_row = None
    if subscription:
        offer = OFFERS.get(subscription.offer_code, {})
        sub_row = {"id": str(subscription.id), "offer_code": subscription.offer_code, "offer_name": offer.get("name", subscription.offer_code), "next_offer_code": subscription.next_offer_code, "status": subscription.status, "status_label": services.STATUS_LABELS[subscription.status], "current_period_end": subscription.current_period_end, "billed_through": subscription.billed_through}
    return {"establishment": {"id": str(establishment.id), "name": establishment.name, "status": establishment.status},
            "offers": [offer_row(offer) for offer in OFFERS.values()], "conditions": CONDITIONS, "setup_fee_fcfa": conf_int("BILLING_SETUP_FEE_FCFA", 0),
            "payment_methods": [{"code": code, "label": METHODS[code]} for code in available_methods()], "practitioners": services.practitioner_count(establishment),
            "subscription": sub_row, "notice": notice_for(subscription, today), "invoices": [invoice_row(invoice, today) for invoice in invoices], "payments": [payment_row(payment) for payment in payments],
            "events": [{"kind": event.kind, "detail": event.detail, "created_at": event.created_at} for event in events]}


class EstablishmentBillingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        admin = billing_administrator(request.user, request.query_params.get("establishment"))
        if admin is None:
            return fail("Accès réservé à l’administrateur de l’établissement.", 403)
        return ok(overview(admin.establishment))


class SubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        admin = billing_administrator(request.user, request.data.get("establishment"))
        if admin is None:
            return fail("Accès réservé à l’administrateur de l’établissement.", 403)
        try:
            subscription = services.subscribe(admin.establishment, str(request.data.get("offer", "")), request.user)
        except BillingError as error:
            return fail(str(error))
        record_event(event_type="billing.subscription_changed", actor=request.user, actor_role="establishment_admin", establishment=admin.establishment, metadata={"resource_type": "subscription", "resource_id": str(subscription.id)})
        return ok(overview(admin.establishment), 201)


class PayInvoiceView(APIView):
    """Prépare le paiement et donne les instructions. Cette route ne marque JAMAIS une facture payée."""
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        invoice = Invoice.objects.filter(pk=invoice_id).select_related("establishment").first()
        admin = billing_administrator(request.user, invoice.establishment_id) if invoice else None
        if invoice is None or admin is None:
            return fail("Facture introuvable.", 404)
        try:
            payment, instructions = services.initiate_payment(invoice, str(request.data.get("method", "")))
        except BillingError as error:
            return fail(str(error))
        return ok({"payment": payment_row(payment), "reference": invoice.number, "amount_fcfa": invoice.amount_fcfa, "instructions": instructions, "confirmation": "Le paiement est confirmé côté serveur par notre équipe ou par le prestataire de paiement."})


class InvoiceDocumentView(APIView):
    """Facture imprimable (à enregistrer en PDF depuis le navigateur). Mentions légales de l'émetteur : à compléter avant usage comptable."""
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id):
        invoice = Invoice.objects.filter(pk=invoice_id).select_related("establishment").first()
        staff = request.user.is_staff or request.user.is_superuser
        if invoice is None or not (staff or billing_administrator(request.user, invoice.establishment_id)):
            return fail("Facture introuvable.", 404)
        today = timezone.localdate()
        status = {"paid": "Payée", "pending": "En attente", "overdue": "En retard", "void": "Annulée"}[display_status(invoice, today)]
        setup_row = f'<tr><td>Frais de mise en service</td><td class="r">{invoice.setup_fee_fcfa} FCFA</td></tr>' if invoice.setup_fee_fcfa else ""
        issuer = escape(str(conf("BILLING_ISSUER", "Mon E‑Carnet")))
        footer = escape(str(conf("BILLING_INVOICE_FOOTER", "")))
        html = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Facture {escape(invoice.number)}</title>
<style>body{{font:15px/1.5 system-ui,sans-serif;max-width:680px;margin:32px auto;padding:0 16px;color:#1E3A34}}table{{width:100%;border-collapse:collapse;margin:16px 0}}td,th{{padding:8px;border-bottom:1px solid #ddd;text-align:left}}.r{{text-align:right}}</style></head>
<body><h1>Facture {escape(invoice.number)}</h1><p><strong>{issuer}</strong></p>
<p>Facturée à : <strong>{escape(invoice.establishment.name)}</strong>, {escape(invoice.establishment.city)}<br>Émise le {invoice.created_at:%d/%m/%Y}. Échéance : {invoice.due_date:%d/%m/%Y}. Statut : {status}.</p>
<table><tr><th>Désignation</th><th class="r">Montant</th></tr><tr><td>{escape(invoice.label)}</td><td class="r">{invoice.amount_fcfa - invoice.setup_fee_fcfa} FCFA</td></tr>
{setup_row}
<tr><th>Total</th><th class="r">{invoice.amount_fcfa} FCFA</th></tr></table>
<p>Référence à indiquer lors du paiement : <strong>{escape(invoice.number)}</strong>.</p><p>{footer}</p></body></html>"""
        response = HttpResponse(html, content_type="text/html; charset=utf-8")
        response["Cache-Control"] = "private, no-store"
        return response


class StaffSubscriptionsView(APIView):
    permission_classes = [IsAuthenticated, IsBillingStaff]

    def get(self, request):
        today = timezone.localdate()
        establishments = list(Establishment.objects.filter(status__in=("active", "suspended"), is_laboratory=False).select_related("subscription").order_by("name")[:300])
        pending = {}
        for invoice in Invoice.objects.filter(status="pending", establishment__in=establishments).order_by("due_date"):
            pending.setdefault(invoice.establishment_id, []).append(invoice)
        rows = []
        for establishment in establishments:
            subscription, invoices = getattr(establishment, "subscription", None), pending.get(establishment.id, [])
            oldest = invoices[0] if invoices else None
            rows.append({"id": str(establishment.id), "name": establishment.name, "city": establishment.city, "establishment_status": establishment.status, "suspension_reason": establishment.suspension_reason,
                         "offer_name": OFFERS.get(subscription.offer_code, {}).get("name", "") if subscription else "", "subscription_status": subscription.status if subscription else "none",
                         "status_label": services.STATUS_LABELS[subscription.status] if subscription else "Aucun abonnement", "pending_count": len(invoices), "pending_total_fcfa": sum(invoice.amount_fcfa for invoice in invoices),
                         "oldest_due_date": oldest.due_date if oldest else None, "days_overdue": max(0, (today - oldest.due_date).days) if oldest else 0})
        return ok(rows)


class StaffEstablishmentBillingView(APIView):
    permission_classes = [IsAuthenticated, IsBillingStaff]

    def get(self, request, establishment_id):
        establishment = Establishment.objects.filter(pk=establishment_id).first()
        if establishment is None:
            return fail("Établissement introuvable.", 404)
        data = overview(establishment)
        data["establishment"]["suspension_reason"] = establishment.suspension_reason
        return ok(data)


class StaffConfirmPaymentView(APIView):
    """L'équipe confirme la réception d'un paiement hors ligne (virement, mobile money). Référence de transaction obligatoire."""
    permission_classes = [IsAuthenticated, IsBillingStaff]

    def post(self, request, invoice_id):
        invoice = Invoice.objects.filter(pk=invoice_id).select_related("establishment").first()
        if invoice is None:
            return fail("Facture introuvable.", 404)
        method, reference = str(request.data.get("method", "")), str(request.data.get("provider_reference", "")).strip()
        if method not in METHODS:
            return fail("Choisissez un moyen de paiement.")
        if len(reference) < 3:
            return fail("Saisissez la référence de la transaction.")
        try:
            invoice, changed = services.confirm_payment(invoice.id, method=method, provider="manual", provider_reference=reference, amount_fcfa=request.data.get("amount_fcfa", invoice.amount_fcfa), confirmed_by=request.user)
        except (BillingError, ValueError, TypeError) as error:
            return fail(str(error) if isinstance(error, BillingError) else "Montant invalide.")
        if changed:
            record_event(event_type="billing.payment_confirmed", actor=request.user, actor_role="ecarnet_staff", establishment=invoice.establishment, metadata={"resource_type": "invoice", "resource_id": str(invoice.id)})
        data = overview(invoice.establishment)
        return ok(data)


class StaffVoidInvoiceView(APIView):
    permission_classes = [IsAuthenticated, IsBillingStaff]

    def post(self, request, invoice_id):
        invoice = Invoice.objects.filter(pk=invoice_id).select_related("establishment", "subscription").first()
        if invoice is None:
            return fail("Facture introuvable.", 404)
        try:
            services.void_invoice(invoice, request.user, str(request.data.get("reason", ""))[:200])
        except BillingError as error:
            return fail(str(error))
        record_event(event_type="billing.invoice_void", actor=request.user, actor_role="ecarnet_staff", establishment=invoice.establishment, metadata={"resource_type": "invoice", "resource_id": str(invoice.id)})
        return ok(overview(invoice.establishment))


class PaymentWebhookView(APIView):
    """Point d'entrée du prestataire de paiement (V3). Signature HMAC-SHA256 du corps brut dans X-Signature ; rejouable sans effet."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, provider):
        secret = str(conf("BILLING_WEBHOOK_SECRET", ""))
        if not secret:
            return fail("Webhook non configuré.", 503)
        expected = hmac.new(secret.encode(), request.body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(request.headers.get("X-Signature", ""), expected):
            return fail("Signature invalide.", 401)
        try:
            payload = json.loads(request.body)
            invoice = Invoice.objects.filter(number=str(payload.get("invoice_number", ""))).first()
        except (ValueError, AttributeError):
            return fail("Corps invalide.")
        if payload.get("status") != "succeeded":
            return ok({"ignored": True})
        method = str(payload.get("method", ""))
        if invoice is None or method not in METHODS:
            return fail("Facture ou moyen de paiement inconnu.", 404 if invoice is None else 400)
        try:
            invoice, changed = services.confirm_payment(invoice.id, method=method, provider=provider[:24], provider_reference=str(payload.get("provider_reference", ""))[:120], amount_fcfa=payload.get("amount_fcfa", -1))
        except (BillingError, ValueError, TypeError) as error:
            return fail(str(error) if isinstance(error, BillingError) else "Montant invalide.", 422)
        return ok({"invoice": invoice.number, "status": invoice.status, "changed": changed})

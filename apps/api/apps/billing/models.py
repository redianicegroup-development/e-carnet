import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class Subscription(models.Model):
    """Abonnement d'un établissement. Le patient ne paie jamais : seul l'établissement est facturé."""
    STATUS_CHOICES = (("pending_payment", "En attente de paiement"), ("active", "Active"), ("past_due", "En retard"), ("unpaid", "Impayée"), ("suspended", "Suspendue"), ("cancelled", "Résiliée"))

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    establishment = models.OneToOneField("establishments.Establishment", on_delete=models.PROTECT, related_name="subscription")
    offer_code = models.CharField(max_length=24)
    next_offer_code = models.CharField(max_length=24, blank=True, default="")  # changement d'offre : effectif à la prochaine période
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default="pending_payment")
    billed_through = models.DateField(null=True, blank=True)  # fin de la dernière période facturée
    current_period_end = models.DateField(null=True, blank=True)  # fin de la dernière période payée
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class InvoiceSequence(models.Model):
    """Numérotation continue par année : FAC-2026-000001, FAC-2026-000002…"""
    year = models.PositiveIntegerField(primary_key=True)
    last_number = models.PositiveIntegerField(default=0)


class Invoice(models.Model):
    STATUS_CHOICES = (("pending", "En attente"), ("paid", "Payée"), ("void", "Annulée"))

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    number = models.CharField(max_length=24, unique=True)
    establishment = models.ForeignKey("establishments.Establishment", on_delete=models.PROTECT, related_name="invoices")
    subscription = models.ForeignKey(Subscription, on_delete=models.PROTECT, related_name="invoices")
    offer_code = models.CharField(max_length=24)
    label = models.CharField(max_length=160)
    setup_fee_fcfa = models.PositiveIntegerField(default=0)
    amount_fcfa = models.PositiveIntegerField()
    period_start = models.DateField()
    period_end = models.DateField()
    due_date = models.DateField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="pending")
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)


class Payment(models.Model):
    """Transaction. Elle n'est « confirmée » que par le serveur : webhook signé du prestataire ou saisie de l'équipe."""
    STATUS_CHOICES = (("initiated", "Initié"), ("confirmed", "Confirmé"), ("failed", "Échoué"))

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="payments")
    method = models.CharField(max_length=24)
    provider = models.CharField(max_length=24, default="manual")
    reference = models.CharField(max_length=64)  # à indiquer lors du paiement (numéro de facture)
    provider_reference = models.CharField(max_length=120, blank=True, default="")
    amount_fcfa = models.PositiveIntegerField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="initiated")
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="confirmed_payments")

    class Meta:
        ordering = ("-created_at",)
        constraints = [models.UniqueConstraint(fields=("provider", "provider_reference"), condition=~Q(provider_reference=""), name="unique_payment_provider_reference")]


class BillingEvent(models.Model):
    """Historique en ajout seul : souscriptions, factures, paiements, retards, suspensions, réactivations."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    establishment = models.ForeignKey("establishments.Establishment", on_delete=models.PROTECT, related_name="billing_events")
    kind = models.CharField(max_length=32)
    detail = models.CharField(max_length=300, blank=True, default="")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [("establishments", "0017_establishment_laboratory"), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(name="InvoiceSequence", fields=[("year", models.PositiveIntegerField(primary_key=True, serialize=False)), ("last_number", models.PositiveIntegerField(default=0))]),
        migrations.CreateModel(
            name="Subscription",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("offer_code", models.CharField(max_length=24)),
                ("next_offer_code", models.CharField(blank=True, default="", max_length=24)),
                ("status", models.CharField(choices=[("pending_payment", "En attente de paiement"), ("active", "Active"), ("past_due", "En retard"), ("unpaid", "Impayée"), ("suspended", "Suspendue"), ("cancelled", "Résiliée")], default="pending_payment", max_length=24)),
                ("billed_through", models.DateField(blank=True, null=True)),
                ("current_period_end", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("establishment", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="subscription", to="establishments.establishment")),
            ],
        ),
        migrations.CreateModel(
            name="Invoice",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("number", models.CharField(max_length=24, unique=True)),
                ("offer_code", models.CharField(max_length=24)),
                ("label", models.CharField(max_length=160)),
                ("setup_fee_fcfa", models.PositiveIntegerField(default=0)),
                ("amount_fcfa", models.PositiveIntegerField()),
                ("period_start", models.DateField()),
                ("period_end", models.DateField()),
                ("due_date", models.DateField()),
                ("status", models.CharField(choices=[("pending", "En attente"), ("paid", "Payée"), ("void", "Annulée")], default="pending", max_length=12)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("establishment", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="invoices", to="establishments.establishment")),
                ("subscription", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="invoices", to="billing.subscription")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.CreateModel(
            name="Payment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("method", models.CharField(max_length=24)),
                ("provider", models.CharField(default="manual", max_length=24)),
                ("reference", models.CharField(max_length=64)),
                ("provider_reference", models.CharField(blank=True, default="", max_length=120)),
                ("amount_fcfa", models.PositiveIntegerField()),
                ("status", models.CharField(choices=[("initiated", "Initié"), ("confirmed", "Confirmé"), ("failed", "Échoué")], default="initiated", max_length=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("confirmed_at", models.DateTimeField(blank=True, null=True)),
                ("confirmed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="confirmed_payments", to=settings.AUTH_USER_MODEL)),
                ("invoice", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="payments", to="billing.invoice")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddConstraint(model_name="payment", constraint=models.UniqueConstraint(condition=models.Q(("provider_reference", ""), _negated=True), fields=("provider", "provider_reference"), name="unique_payment_provider_reference")),
        migrations.CreateModel(
            name="BillingEvent",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("kind", models.CharField(max_length=32)),
                ("detail", models.CharField(blank=True, default="", max_length=300)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("establishment", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="billing_events", to="establishments.establishment")),
            ],
            options={"ordering": ("-created_at",)},
        ),
    ]

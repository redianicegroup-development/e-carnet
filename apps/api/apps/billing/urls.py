from django.urls import path

from .views import (EstablishmentBillingView, InvoiceDocumentView, PayInvoiceView, PaymentWebhookView, StaffConfirmPaymentView, StaffEstablishmentBillingView,
                    StaffSubscriptionsView, StaffVoidInvoiceView, SubscribeView)

urlpatterns = [
    path("establishment/", EstablishmentBillingView.as_view()),
    path("establishment/subscribe/", SubscribeView.as_view()),
    path("invoices/<uuid:invoice_id>/pay/", PayInvoiceView.as_view()),
    path("invoices/<uuid:invoice_id>/document/", InvoiceDocumentView.as_view()),
    path("staff/subscriptions/", StaffSubscriptionsView.as_view()),
    path("staff/establishments/<uuid:establishment_id>/", StaffEstablishmentBillingView.as_view()),
    path("staff/invoices/<uuid:invoice_id>/confirm-payment/", StaffConfirmPaymentView.as_view()),
    path("staff/invoices/<uuid:invoice_id>/void/", StaffVoidInvoiceView.as_view()),
    path("webhook/<slug:provider>/", PaymentWebhookView.as_view()),
]

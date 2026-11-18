from django.urls import path

from .views import (PatientAttachmentView, PatientDeclarationsView, PatientEstablishmentsView, PatientReportErrorView, PatientRevokeShareView, PatientShareDeclarationView,
                    ProfessionalAttachmentView, ProfessionalAttestView, ProfessionalDeclarationsView, ProfessionalReminderView, ProfessionalRequestInfoView, ProfessionalSummaryView)

urlpatterns = [
    path("patient/declarations/", PatientDeclarationsView.as_view()),
    path("patient/declarations/<uuid:declaration_id>/share/", PatientShareDeclarationView.as_view()),
    path("patient/shares/<uuid:share_id>/revoke/", PatientRevokeShareView.as_view()),
    path("patient/shares/<uuid:share_id>/report-error/", PatientReportErrorView.as_view()),
    path("patient/establishments/", PatientEstablishmentsView.as_view()),
    path("patient/attachments/<uuid:attachment_id>/", PatientAttachmentView.as_view()),
    path("professional/summary/", ProfessionalSummaryView.as_view()),
    path("professional/declarations/", ProfessionalDeclarationsView.as_view()),
    path("professional/reminders/", ProfessionalReminderView.as_view()),
    path("professional/shares/<uuid:share_id>/attest/", ProfessionalAttestView.as_view()),
    path("professional/shares/<uuid:share_id>/request-info/", ProfessionalRequestInfoView.as_view()),
    path("professional/attachments/<uuid:attachment_id>/", ProfessionalAttachmentView.as_view()),
]

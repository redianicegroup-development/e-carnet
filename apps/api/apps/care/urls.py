from django.urls import path
from .views import EncounterDetailView, EncounterListCreateView, PatientAccessAuditView, PatientAccessGrantActionView, PatientAccessGrantListView, PatientAccessQrCreateView, PatientConsultationListView, ProfessionalAccessGrantListCreateView, ProfessionalAuthorizedEncounterListView, ProfessionalConsultationListCreateView
urlpatterns = [
    path("encounters/", EncounterListCreateView.as_view()), path("encounters/<uuid:pk>/", EncounterDetailView.as_view()),
    path("access-grants/", PatientAccessGrantListView.as_view()), path("access-grants/<uuid:pk>/<str:action>/", PatientAccessGrantActionView.as_view()),
    path("access-qr/", PatientAccessQrCreateView.as_view()),
    path("access-audit/", PatientAccessAuditView.as_view()),
    path("consultations/", PatientConsultationListView.as_view()),
    path("professional/access-grants/", ProfessionalAccessGrantListCreateView.as_view()),
    path("professional/consultations/", ProfessionalConsultationListCreateView.as_view()),
    path("professional/access-grants/<uuid:pk>/encounters/", ProfessionalAuthorizedEncounterListView.as_view()),
]

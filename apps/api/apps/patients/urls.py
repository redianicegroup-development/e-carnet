from django.urls import path
from .views import (
    DeclarationDetailView,
    DeclarationListCreateView,
    EmergencyCardQrView,
    PatientEmergencyCardView,
    PatientOfflineEmergencyCardView,
    PatientProfileView,
    PatientRepresentationActiveView,
    PatientRepresentationDetailView,
    PatientRepresentationListCreateView,
    RepresentationTransferRequestView,
    RepresentationTransferReviewView,
)

urlpatterns = [
    path("profile/", PatientProfileView.as_view()),
    path("declarations/", DeclarationListCreateView.as_view()),
    path("declarations/<uuid:pk>/", DeclarationDetailView.as_view()),
    path("emergency-card/", PatientEmergencyCardView.as_view()),
    path("emergency-card/offline/", PatientOfflineEmergencyCardView.as_view()),
    path("emergency-card/qr/<str:token>/", EmergencyCardQrView.as_view()),
    path("representations/", PatientRepresentationListCreateView.as_view()),
    path("representations/active/", PatientRepresentationActiveView.as_view()),
    path("representations/<uuid:pk>/", PatientRepresentationDetailView.as_view()),
    path("representations/transfers/", RepresentationTransferRequestView.as_view()),
    path("representations/transfers/review/", RepresentationTransferReviewView.as_view()),
    path("representations/transfers/<uuid:pk>/review/", RepresentationTransferReviewView.as_view()),
]

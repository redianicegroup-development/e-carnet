from django.urls import path
from .views import (
    DeclarationDetailView,
    DeclarationListCreateView,
    EmergencyCardQrView,
    PatientEmergencyCardView,
    PatientProfileView,
    PatientRecordViewsView,
    PatientRepresentationActiveView,
    PatientRepresentationDetailView,
    PatientRepresentationListCreateView,
    RepresentationTransferRequestView,
    RepresentationTransferReviewView,
)
from .delegation_views import (
    DelegationJoinCodeRedeemView,
    MyDelegationsView,
    PatientDelegationActionView,
    PatientDelegationListCreateView,
    SelectDelegationView,
)

urlpatterns = [
    path("profile/", PatientProfileView.as_view()),
    path("record-views/", PatientRecordViewsView.as_view()),
    path("declarations/", DeclarationListCreateView.as_view()),
    path("declarations/<uuid:pk>/", DeclarationDetailView.as_view()),
    path("emergency-card/", PatientEmergencyCardView.as_view()),
    path("emergency-card/qr/<str:token>/", EmergencyCardQrView.as_view()),
    path("representations/", PatientRepresentationListCreateView.as_view()),
    path("representations/active/", PatientRepresentationActiveView.as_view()),
    path("representations/<uuid:pk>/", PatientRepresentationDetailView.as_view()),
    path("representations/transfers/", RepresentationTransferRequestView.as_view()),
    path("representations/transfers/review/", RepresentationTransferReviewView.as_view()),
    path("representations/transfers/<uuid:pk>/review/", RepresentationTransferReviewView.as_view()),
    path("delegations/", PatientDelegationListCreateView.as_view()),
    path("delegations/redeem/", DelegationJoinCodeRedeemView.as_view()),
    path("delegations/mine/", MyDelegationsView.as_view()),
    path("delegations/<uuid:pk>/select/", SelectDelegationView.as_view()),
    path("delegations/<uuid:pk>/<str:action>/", PatientDelegationActionView.as_view()),
]

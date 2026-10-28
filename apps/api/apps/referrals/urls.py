from django.urls import path
from .views import (
    PatientReferralDecisionView, PatientReferralListView, ReferralAcknowledgeView,
    ReferralActionView, ReferralCreateView, ReferralInboxView, ReferralOpenView, ReferralSnapshotView,
)

urlpatterns = [
    path("", ReferralCreateView.as_view()),
    path("patient/", PatientReferralListView.as_view()),
    path("patient/<uuid:pk>/<str:action>/", PatientReferralDecisionView.as_view()),
    path("establishments/<uuid:establishment_id>/inbox/", ReferralInboxView.as_view()),
    path("<uuid:pk>/open/", ReferralOpenView.as_view()),
    path("<uuid:pk>/snapshot/", ReferralSnapshotView.as_view()),
    path("<uuid:pk>/acknowledge/", ReferralAcknowledgeView.as_view()),
    path("<uuid:pk>/<str:action>/", ReferralActionView.as_view()),
]

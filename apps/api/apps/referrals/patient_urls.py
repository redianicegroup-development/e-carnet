from django.urls import path
from .views import PatientReferralDecisionView, PatientReferralListView

urlpatterns = [
    path("", PatientReferralListView.as_view()),
    path("<uuid:pk>/<str:action>/", PatientReferralDecisionView.as_view()),
]

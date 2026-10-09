from django.urls import path

from .views import ProfessionalMeView, ProfessionalOnboardingView, ProfessionalSpecialtyListView

urlpatterns = [
    path("specialties/", ProfessionalSpecialtyListView.as_view()),
    path("me/", ProfessionalMeView.as_view()),
    path("onboarding/", ProfessionalOnboardingView.as_view()),
]

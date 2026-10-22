from django.urls import path

from .views import ProfessionalCredentialAssetView, ProfessionalCredentialsView, ProfessionalMeView, ProfessionalOnboardingView, ProfessionalSpecialtyListView

urlpatterns = [
    path("specialties/", ProfessionalSpecialtyListView.as_view()),
    path("me/", ProfessionalMeView.as_view()),
    path("credentials/", ProfessionalCredentialsView.as_view()),
    path("credentials/<slug:kind>/", ProfessionalCredentialAssetView.as_view()),
    path("onboarding/", ProfessionalOnboardingView.as_view()),
]

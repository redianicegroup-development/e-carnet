from django.urls import path
from .views import DeclarationDetailView, DeclarationListCreateView, EmergencyCardQrView, PatientEmergencyCardView, PatientProfileView
urlpatterns = [path("profile/", PatientProfileView.as_view()), path("declarations/", DeclarationListCreateView.as_view()), path("declarations/<uuid:pk>/", DeclarationDetailView.as_view()), path("emergency-card/", PatientEmergencyCardView.as_view()), path("emergency-card/qr/<str:token>/", EmergencyCardQrView.as_view())]

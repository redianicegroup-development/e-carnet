from django.urls import path
from .views import DeclarationDetailView, DeclarationListCreateView, PatientProfileView
urlpatterns = [path("profile/", PatientProfileView.as_view()), path("declarations/", DeclarationListCreateView.as_view()), path("declarations/<uuid:pk>/", DeclarationDetailView.as_view())]

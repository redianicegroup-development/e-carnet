from django.urls import path
from .views import ReferralInboxView

urlpatterns = [
    path("inbox/", ReferralInboxView.as_view()),
]

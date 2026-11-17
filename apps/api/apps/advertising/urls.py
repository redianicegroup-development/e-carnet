from django.urls import path

from .views import AdminBannerListCreateView, AdminBannerWithdrawView, BannerClickView, BannerImageView, PatientBannerView

urlpatterns = [
    path("admin/banners/", AdminBannerListCreateView.as_view()),
    path("admin/banners/<uuid:banner_id>/withdraw/", AdminBannerWithdrawView.as_view()),
    path("banner/", PatientBannerView.as_view()),
    path("banners/<uuid:banner_id>/image/<str:variant>/", BannerImageView.as_view()),
    path("banners/<uuid:banner_id>/click/", BannerClickView.as_view()),
]

from django.urls import path
from .auth_views import AccountAvatarView, ContextSelectView, CurrentAccountView, IdentityProfileView, LoginView, LogoutView, OAuthIdentityListView, OAuthIdentityUnlinkView, PatientOnboardingView, RecoverySetupView, RegisterView
from .oauth_views import OAuthCallbackView, OAuthStartView
from .contact_views import PublicContactView
from .views import CurrentAccountThemeView
from .visitor_views import AnonymousClickView, AnonymousVisitView, ProductActionSurveyTriggerView, ProductExperienceSurveySubmitView, ProductSurveySubmitView, ProductSurveySummaryView, PublicFeedbackView
from .admin_views import AdminDashboardView, AdminFeedbackStatusView
from .account_action_views import AdminAccountActionRequestStatusView, AdminAccountActionRequestsView, AdminDeleteRequestedAccountView, CurrentAccountActionRequestsView
urlpatterns = [
    path("register/", RegisterView.as_view()), path("login/", LoginView.as_view()), path("logout/", LogoutView.as_view()),
    path("analytics/visits/", AnonymousVisitView.as_view(), name="anonymous-visitor-visit"),
    path("analytics/clicks/", AnonymousClickView.as_view(), name="anonymous-visitor-click"),
    path("feedback/", PublicFeedbackView.as_view(), name="public-feedback"),
    path("contact/", PublicContactView.as_view(), name="public-contact"),
    path("feedback2/summary/", ProductSurveySummaryView.as_view(), name="product-survey-summary"),
    path("feedback2/", ProductSurveySubmitView.as_view(), name="product-survey-submit"),
    path("analytics/product-action/", ProductActionSurveyTriggerView.as_view(), name="product-action-survey-trigger"),
    path("feedback2/product/", ProductExperienceSurveySubmitView.as_view(), name="product-experience-survey-submit"),
    path("admin/dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("admin/feedback/<uuid:feedback_id>/", AdminFeedbackStatusView.as_view(), name="admin-feedback-status"),
    path("admin/account-requests/", AdminAccountActionRequestsView.as_view(), name="admin-account-action-requests"),
    path("admin/account-requests/<uuid:request_id>/", AdminAccountActionRequestStatusView.as_view(), name="admin-account-action-request-status"),
    path("admin/account-requests/<uuid:request_id>/delete/", AdminDeleteRequestedAccountView.as_view(), name="admin-delete-requested-account"),
    path("me/", CurrentAccountView.as_view()), path("me/profile/", IdentityProfileView.as_view()), path("me/avatar/", AccountAvatarView.as_view()), path("me/theme/", CurrentAccountThemeView.as_view(), name="current-account-theme"),
    path("me/account-requests/", CurrentAccountActionRequestsView.as_view(), name="current-account-action-requests"),
    path("oauth/identities/", OAuthIdentityListView.as_view()), path("oauth/identities/<str:provider>/", OAuthIdentityUnlinkView.as_view()),
    path("contexts/select/", ContextSelectView.as_view()), path("onboarding/patient/", PatientOnboardingView.as_view()), path("me/recovery/", RecoverySetupView.as_view()),
    path("oauth/<str:provider>/start/", OAuthStartView.as_view()), path("oauth/<str:provider>/callback/", OAuthCallbackView.as_view()),
]

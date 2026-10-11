from django.urls import path
from .auth_views import AccountAvatarView, ContextSelectView, CurrentAccountView, IdentityProfileView, LoginView, LogoutView, OAuthIdentityListView, OAuthIdentityUnlinkView, PatientOnboardingView, RegisterView
from .oauth_views import OAuthCallbackView, OAuthStartView
from .views import CurrentAccountThemeView
from .visitor_views import AnonymousClickView, AnonymousVisitView, ProductSurveySubmitView, ProductSurveySummaryView, PublicFeedbackView
from .admin_views import AdminDashboardView, AdminFeedbackStatusView
urlpatterns = [
    path("register/", RegisterView.as_view()), path("login/", LoginView.as_view()), path("logout/", LogoutView.as_view()),
    path("analytics/visits/", AnonymousVisitView.as_view(), name="anonymous-visitor-visit"),
    path("analytics/clicks/", AnonymousClickView.as_view(), name="anonymous-visitor-click"),
    path("feedback/", PublicFeedbackView.as_view(), name="public-feedback"),
    path("feedback2/summary/", ProductSurveySummaryView.as_view(), name="product-survey-summary"),
    path("feedback2/", ProductSurveySubmitView.as_view(), name="product-survey-submit"),
    path("admin/dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("admin/feedback/<uuid:feedback_id>/", AdminFeedbackStatusView.as_view(), name="admin-feedback-status"),
    path("me/", CurrentAccountView.as_view()), path("me/profile/", IdentityProfileView.as_view()), path("me/avatar/", AccountAvatarView.as_view()), path("me/theme/", CurrentAccountThemeView.as_view(), name="current-account-theme"),
    path("oauth/identities/", OAuthIdentityListView.as_view()), path("oauth/identities/<str:provider>/", OAuthIdentityUnlinkView.as_view()),
    path("contexts/select/", ContextSelectView.as_view()), path("onboarding/patient/", PatientOnboardingView.as_view()),
    path("oauth/<str:provider>/start/", OAuthStartView.as_view()), path("oauth/<str:provider>/callback/", OAuthCallbackView.as_view()),
]

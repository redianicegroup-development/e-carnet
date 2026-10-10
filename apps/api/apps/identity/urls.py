from django.urls import path
from .auth_views import AccountAvatarView, ContextSelectView, CurrentAccountView, IdentityProfileView, LoginView, LogoutView, OAuthIdentityListView, OAuthIdentityUnlinkView, PatientOnboardingView, RegisterView
from .oauth_views import OAuthCallbackView, OAuthStartView
from .views import CurrentAccountThemeView
urlpatterns = [
    path("register/", RegisterView.as_view()), path("login/", LoginView.as_view()), path("logout/", LogoutView.as_view()),
    path("me/", CurrentAccountView.as_view()), path("me/profile/", IdentityProfileView.as_view()), path("me/avatar/", AccountAvatarView.as_view()), path("me/theme/", CurrentAccountThemeView.as_view(), name="current-account-theme"),
    path("oauth/identities/", OAuthIdentityListView.as_view()), path("oauth/identities/<str:provider>/", OAuthIdentityUnlinkView.as_view()),
    path("contexts/select/", ContextSelectView.as_view()), path("onboarding/patient/", PatientOnboardingView.as_view()),
    path("oauth/<str:provider>/start/", OAuthStartView.as_view()), path("oauth/<str:provider>/callback/", OAuthCallbackView.as_view()),
]

import json
import logging
import os
import secrets
import urllib.parse
import urllib.request
from django.conf import settings
from django.contrib.auth import get_user_model, login
from django.http import HttpResponseRedirect
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from authlib.jose import JsonWebKey, jwt
from apps.audit.services import record_event
from .models import AccountContext, AccountProfile, AuthIdentity
from .visitor_tracking import track_auth_response

logger = logging.getLogger(__name__)
User = get_user_model()
PROVIDERS = {
    "google": {"authorize": "https://accounts.google.com/o/oauth2/v2/auth", "token": "https://oauth2.googleapis.com/token", "userinfo": "https://openidconnect.googleapis.com/v1/userinfo", "scope": "openid email profile", "client_id": "GOOGLE_CLIENT_ID", "client_secret": "GOOGLE_CLIENT_SECRET"},
    "facebook": {"authorize": "https://www.facebook.com/v20.0/dialog/oauth", "token": "https://graph.facebook.com/v20.0/oauth/access_token", "userinfo": "https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture", "scope": "email,public_profile", "client_id": "FACEBOOK_CLIENT_ID", "client_secret": "FACEBOOK_CLIENT_SECRET"},
    "apple": {"authorize": "https://appleid.apple.com/auth/authorize", "token": "https://appleid.apple.com/auth/token", "userinfo": None, "scope": "name email", "client_id": "APPLE_CLIENT_ID", "client_secret": "APPLE_CLIENT_SECRET"},
}

def callback_url(request, provider):
    return f"{settings.WEB_ORIGIN.rstrip('/')}/api/v1/identity/oauth/{provider}/callback/"

def provider_config(provider):
    config = PROVIDERS[provider]; client_id = os.environ.get(config["client_id"], ""); client_secret = os.environ.get(config["client_secret"], "")
    if not client_id or not client_secret: raise ValueError(f"OAuth {provider} n'est pas configuré dans cet environnement.")
    return config, client_id, client_secret

def http_json(url, data=None, headers=None):
    encoded = urllib.parse.urlencode(data or {}).encode("utf-8")
    request = urllib.request.Request(url, data=encoded if data is not None else None, headers=headers or {})
    with urllib.request.urlopen(request, timeout=15) as response: return json.loads(response.read().decode("utf-8"))

def external_profile(provider, token_payload):
    if provider == "apple":
        id_token = token_payload.get("id_token")
        if not id_token: raise ValueError("Apple n'a pas fourni d'identité vérifiable.")
        with urllib.request.urlopen("https://appleid.apple.com/auth/keys", timeout=10) as response: keys = json.loads(response.read().decode("utf-8"))
        claims = jwt.decode(id_token, JsonWebKey.import_key_set(keys)); claims.validate()
        return {"id": claims["sub"], "email": claims.get("email", ""), "name": "", "first_name": claims.get("given_name", ""), "last_name": claims.get("family_name", ""), "avatar": ""}
    data = http_json(PROVIDERS[provider]["userinfo"], headers={"Authorization": f"Bearer {token_payload['access_token']}"})
    if provider == "facebook":
        first_name, last_name = data.get("first_name", ""), data.get("last_name", "")
        name = " ".join(filter(None, [first_name, last_name])); avatar = ((data.get("picture") or {}).get("data") or {}).get("url", "")
    else:
        first_name, last_name = data.get("given_name", ""), data.get("family_name", "")
        name, avatar = data.get("name", ""), data.get("picture", "")
    return {"id": str(data.get("sub") or data.get("id")), "email": (data.get("email") or "").lower(), "name": name, "first_name": first_name, "last_name": last_name, "avatar": avatar}

def split_name(name):
    parts = (name or "Utilisateur").strip().split(); return (parts[0], " ".join(parts[1:]) or "")

def ui_redirect(provider, **params):
    query = urllib.parse.urlencode({"oauth": provider, **params})
    return HttpResponseRedirect(f"{settings.WEB_ORIGIN}/connexion?{query}")

def account_destination(user):
    context = (
        user.account_contexts.filter(is_active=True).first()
        or user.account_contexts.filter(role="patient").first()
        or user.account_contexts.first()
    )
    if context is None:
        return "/patient"
    profile = getattr(user, "account_profile", None)
    if context.onboarding_completed and not (
        profile and profile.recovery_question and profile.recovery_answer_hash
    ):
        return "/onboarding/securite"
    if context.role == "patient":
        return "/patient" if context.onboarding_completed else "/onboarding/identite"
    if context.role == "professional":
        return "/professionnel" if context.onboarding_completed else "/professionnel/onboarding"
    return "/etablissement"

def oauth_success_redirect(destination):
    return HttpResponseRedirect(f"{settings.WEB_ORIGIN}{safe_next_path(destination, '/patient')}")

def safe_next_path(value, fallback):
    value = value or ""
    parsed = urllib.parse.urlsplit(value)
    if (
        value.startswith("/")
        and not value.startswith("//")
        and "\\" not in value
        and not any(ord(character) < 32 for character in value)
        and not parsed.scheme
        and not parsed.netloc
    ):
        return value
    return fallback

class OAuthStartView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, provider):
        if provider not in PROVIDERS: return Response({"success": False, "message": "Fournisseur OAuth inconnu."}, status=404)
        try: config, client_id, _secret = provider_config(provider)
        except ValueError as exc: return ui_redirect(provider, status="error", message=str(exc))
        state = secrets.token_urlsafe(32)
        request.session[f"oauth_state_{provider}"] = state
        request.session["oauth_link_user_id"] = (
            str(request.user.pk)
            if request.user.is_authenticated and request.GET.get("intent") != "login"
            else ""
        )
        request.session["oauth_next"] = request.GET.get("next", "")
        query = urllib.parse.urlencode({"client_id": client_id, "redirect_uri": callback_url(request, provider), "response_type": "code", "scope": config["scope"], "state": state, **({"response_mode": "form_post"} if provider == "apple" else {})})
        return HttpResponseRedirect(f"{config['authorize']}?{query}")

class OAuthCallbackView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, provider): return self._complete(request, provider, request.GET)
    def post(self, request, provider): return self._complete(request, provider, request.POST)
    def _complete(self, request, provider, params):
        if provider not in PROVIDERS or not secrets.compare_digest(request.session.pop(f"oauth_state_{provider}", ""), params.get("state", "")):
            return ui_redirect(provider, status="error", message="Connexion OAuth invalide ou expirée.")
        stage = "configuration"
        try:
            config, client_id, client_secret = provider_config(provider)
            stage = "token_exchange"
            token = http_json(config["token"], {"code": params.get("code", ""), "client_id": client_id, "client_secret": client_secret, "redirect_uri": callback_url(request, provider), "grant_type": "authorization_code"})
            stage = "profile_verification"
            profile = external_profile(provider, token)
        except Exception:
            logger.exception("OAuth callback failed during %s (provider=%s)", stage, provider)
            return ui_redirect(provider, status="error", message="Impossible de vérifier cette identité OAuth.")
        stage = "identity_lookup"
        try:
            existing = AuthIdentity.objects.filter(provider=provider, provider_user_id=profile["id"]).select_related("user").first()
            link_user_id = request.session.pop("oauth_link_user_id", "")
            next_path = request.session.pop("oauth_next", "")
            if existing:
                if link_user_id and str(existing.user_id) != link_user_id: return ui_redirect(provider, status="conflict", message="Cette méthode est déjà liée à un autre compte.")
                stage = "existing_identity_login"
                user = existing.user
                first_name, last_name = split_name(profile.get("name"))
                changed = []
                if not user.first_name and (profile.get("first_name") or first_name):
                    user.first_name = profile.get("first_name") or first_name; changed.append("first_name")
                if not user.last_name and (profile.get("last_name") or last_name):
                    user.last_name = profile.get("last_name") or last_name; changed.append("last_name")
                if changed: user.save(update_fields=changed)
                account_profile, _ = AccountProfile.objects.get_or_create(user=user)
                if not account_profile.avatar_data and not account_profile.avatar_url and profile.get("avatar", "").startswith("https://"):
                    account_profile.avatar_url = profile["avatar"]
                    account_profile.save(update_fields=("avatar_url", "updated_at"))
                login(request, user); existing.last_seen_at = timezone.now(); existing.save(update_fields=("last_seen_at",))
                fallback = "/patient/parametres" if link_user_id else account_destination(existing.user)
                destination = fallback if fallback == "/onboarding/securite" else safe_next_path(next_path, fallback)
                response = oauth_success_redirect(destination)
                return track_auth_response(request, response, "oauth_link" if link_user_id else "oauth_success")
            if link_user_id:
                stage = "linked_user_lookup"
                user = User.objects.filter(pk=link_user_id).first()
                if not user: return ui_redirect(provider, status="error", message="Session de liaison expirée.")
                if AuthIdentity.objects.filter(user=user, provider=provider).exists():
                    return ui_redirect(
                        provider,
                        status="conflict",
                        message=f"Une identité {provider.capitalize()} est déjà liée à votre compte. Déliez-la avant d'en associer une autre.",
                    )
                linked = True
            else:
                email = profile.get("email", "")
                stage = "email_lookup"
                user = User.objects.filter(email__iexact=email).first() if email else None
                if user: return ui_redirect(provider, status="conflict", message="Un compte existe déjà. Connectez-vous d'abord pour lier ce fournisseur.")
                fallback_first, fallback_last = split_name(profile.get("name"))
                first_name = profile.get("first_name") or fallback_first
                last_name = profile.get("last_name") or fallback_last
                username = email or f"{provider}_{profile['id']}"
                stage = "account_creation"
                user = User.objects.create_user(username=username, email=email, first_name=first_name, last_name=last_name)
                avatar = profile.get("avatar", "")
                AccountProfile.objects.create(user=user, avatar_url=avatar if avatar.startswith("https://") else "")
                AccountContext.objects.create(user=user, role="patient", is_active=True)
                linked = False
            stage = "identity_creation"
            AuthIdentity.objects.create(user=user, provider=provider, provider_user_id=profile["id"], email=profile.get("email", ""), display_name=profile.get("name", ""), avatar_url=profile.get("avatar", ""))
            if not getattr(user, "account_profile", None): AccountProfile.objects.create(user=user, avatar_url=profile.get("avatar", ""))
            stage = "session_login"
            login(request, user)
            stage = "audit_event"
            record_event(event_type="oauth.identity_linked" if linked else "oauth.account_created", actor=user, actor_role="account", metadata={"action": "linked" if linked else "created", "provider": provider})
            fallback = "/patient/parametres" if linked else account_destination(user)
            destination = fallback if fallback == "/onboarding/securite" else safe_next_path(next_path, fallback)
            response = oauth_success_redirect(destination)
            return track_auth_response(request, response, "oauth_link" if linked else "oauth_success")
        except Exception:
            logger.exception("OAuth callback failed during %s (provider=%s)", stage, provider)
            raise

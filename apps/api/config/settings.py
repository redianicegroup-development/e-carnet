import os
import sys
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent
# Sûr par défaut : un hébergeur dont la variable manque ne doit jamais démarrer en mode debug.
DEBUG = os.environ.get("DJANGO_DEBUG", "false").lower() == "true"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set when DEBUG is false.")
    SECRET_KEY = "dev-only-insecure-key-change-before-deploy"
ALLOWED_HOSTS = [host.strip() for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(",") if host.strip()]

INSTALLED_APPS = [
    "django.contrib.admin", "django.contrib.auth", "django.contrib.contenttypes",
    "django.contrib.sessions", "django.contrib.messages", "django.contrib.staticfiles",
    "corsheaders", "rest_framework", "apps.identity", "apps.patients", "apps.care",
    "apps.establishments", "apps.professionals", "apps.audit", "apps.referrals",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware", "whitenoise.middleware.WhiteNoiseMiddleware", "apps.identity.middleware.AdminLoginThrottleMiddleware", "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware", "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware", "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.identity.middleware.ForcePasswordChangeMiddleware", "apps.identity.middleware.ApiPrivateNoStoreMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware", "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [], "APP_DIRS": True, "OPTIONS": {"context_processors": ["django.template.context_processors.request", "django.contrib.auth.context_processors.auth", "django.contrib.messages.context_processors.messages"]}}]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"
DATABASE_URL = os.environ.get("DATABASE_URL")
DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=60) if DATABASE_URL else {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
AUTH_PASSWORD_VALIDATORS = [{"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"}, {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"}, {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"}, {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"}]
PASSWORD_HASHERS = ["django.contrib.auth.hashers.Argon2PasswordHasher", "django.contrib.auth.hashers.PBKDF2PasswordHasher"]
LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = Path(os.environ.get("DJANGO_MEDIA_ROOT", str(BASE_DIR / "private-media")))
MEDIA_URL = "/media/"  # Les documents ne sont jamais servis par cette URL ; téléchargement via endpoint authentifié.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    # Limitation des tentatives (force brute sur mots de passe, codes, invitations, QR).
    "DEFAULT_THROTTLE_RATES": {
        "auth_login": os.environ.get("ECARNET_RATE_LOGIN", "20/hour"),
        "auth_login_email": os.environ.get("ECARNET_RATE_LOGIN_EMAIL", "8/hour"),
        "auth_register": os.environ.get("ECARNET_RATE_REGISTER", "10/hour"),
        "auth_recovery": os.environ.get("ECARNET_RATE_RECOVERY", "12/hour"),
        "auth_recovery_email": os.environ.get("ECARNET_RATE_RECOVERY_EMAIL", "8/hour"),
        "representation_changes": os.environ.get("ECARNET_RATE_REPRESENTATION", "20/hour"),
        "representation_transfer": os.environ.get("ECARNET_RATE_REPRESENTATION_TRANSFER", "5/hour"),
        "trusted_contact_changes": os.environ.get("ECARNET_RATE_TRUSTED_CONTACT", "10/hour"),
        "trusted_contact_accept": os.environ.get("ECARNET_RATE_TRUSTED_CONTACT_ACCEPT", "5/minute"),
        "referral_changes": os.environ.get("ECARNET_RATE_REFERRAL_CHANGES", "30/hour"),
        "referral_reads": os.environ.get("ECARNET_RATE_REFERRAL_READS", "60/hour"),
        "code_redeem": os.environ.get("ECARNET_RATE_CODE", "10/hour"),
        "grant_request": os.environ.get("ECARNET_RATE_GRANT", "60/hour"),
        "qr_create": os.environ.get("ECARNET_RATE_QR_CREATE", "30/hour"),
        "emergency_card_public": os.environ.get("ECARNET_RATE_EMERGENCY_CARD", "120/hour"),
        "visitor_analytics": os.environ.get("ECARNET_RATE_VISITOR", "1200/hour"),
        "visitor_clicks": os.environ.get("ECARNET_RATE_CLICKS", "2400/hour"),
        "visitor_feedback": os.environ.get("ECARNET_RATE_FEEDBACK", "5/hour"),
        "visitor_survey": os.environ.get("ECARNET_RATE_SURVEY", "5/hour"),
        "contact": os.environ.get("ECARNET_RATE_CONTACT", "5/hour"),
        "documents_upload": os.environ.get("ECARNET_RATE_DOCUMENTS_UPLOAD", "20/hour"),
        "establishment_record_open": os.environ.get("ECARNET_RATE_ESTABLISHMENT_RECORD_OPEN", "30/hour"),
        "push_subscription": os.environ.get("ECARNET_RATE_PUSH_SUBSCRIPTION", "30/hour"),
    },
    # Nombre de proxys de confiance devant l'API (Render, Vercel rewrite…). Mal réglé, l'IP client est falsifiable.
    "NUM_PROXIES": int(os.environ["DRF_NUM_PROXIES"]) if os.environ.get("DRF_NUM_PROXIES", "").isdigit() else (None if DEBUG else 1),
}
WEB_ORIGIN = os.environ.get("WEB_ORIGIN", "http://localhost:3000")
ECARNET_QR_TTL_SECONDS = int(os.environ.get("ECARNET_QR_TTL_SECONDS", "300"))
ECARNET_REPRESENTATION_LEGAL_AGE = (
    int(os.environ["ECARNET_REPRESENTATION_LEGAL_AGE"])
    if os.environ.get("ECARNET_REPRESENTATION_LEGAL_AGE", "").isdigit()
    else None
)
ECARNET_TRUSTED_CONTACTS_ENABLED = os.environ.get("ECARNET_TRUSTED_CONTACTS_ENABLED", "false").lower() == "true"
ECARNET_REFERRALS_ENABLED = os.environ.get("ECARNET_REFERRALS_ENABLED", "false").lower() == "true"
ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ = os.environ.get("ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ", "true").lower() == "true"
ECARNET_OPERATIONS_ADMIN_EMAILS = tuple(
    email.strip().lower()
    for email in os.environ.get("ECARNET_OPERATIONS_ADMIN_EMAILS", "").split(",")
    if email.strip()
)
ECARNET_MONITOR_WEBHOOK_SECRET = os.environ.get("ECARNET_MONITOR_WEBHOOK_SECRET", "")

# --- Web Push (VAPID) ---------------------------------------------------------------------------------------------
# Sans clés, le push est simplement désactivé : les notifications dans l'application restent la source de vérité.
# Générer une paire : voir docs/WEB-PUSH.md. La clé privée ne doit jamais quitter le serveur.
ECARNET_VAPID_PUBLIC_KEY = os.environ.get("ECARNET_VAPID_PUBLIC_KEY", "")
ECARNET_VAPID_PRIVATE_KEY = os.environ.get("ECARNET_VAPID_PRIVATE_KEY", "")
ECARNET_VAPID_SUBJECT = os.environ.get("ECARNET_VAPID_SUBJECT", "")  # ex. mailto:contact@votre-domaine
# Santé : par défaut, la notification affichée sur l'écran verrouillé ne contient ni nom de médicament ni dose.
ECARNET_PUSH_SHOW_DETAILS = os.environ.get("ECARNET_PUSH_SHOW_DETAILS", "").lower() in {"1", "true", "yes"}
# Durée pendant laquelle le service de push garde un message si l'appareil est éteint ou hors ligne (secondes).
ECARNET_PUSH_TTL_SECONDS = int(os.environ["ECARNET_PUSH_TTL_SECONDS"]) if os.environ.get("ECARNET_PUSH_TTL_SECONDS", "").isdigit() else 3600
# Anti-SSRF : le serveur n'appelle que les services de push connus (le navigateur fournit l'adresse, pas nous).
ECARNET_PUSH_ALLOWED_HOSTS = tuple(
    host.strip().lower()
    for host in os.environ.get(
        "ECARNET_PUSH_ALLOWED_HOSTS",
        "fcm.googleapis.com,android.googleapis.com,updates.push.services.mozilla.com,push.services.mozilla.com,web.push.apple.com,push.apple.com,notify.windows.com",
    ).split(",")
    if host.strip()
)
# Rappels de prise : fuseau dans lequel les horaires « HH:MM » saisis par les patients sont interprétés.
# TIME_ZONE reste UTC : seul send_due_reminders lit ce réglage.
ECARNET_REMINDER_TIMEZONE = os.environ.get("ECARNET_REMINDER_TIMEZONE", "Africa/Abidjan")
# Rattrapage : si une exécution du planificateur est manquée, les rappels dus depuis moins de N minutes partent encore.
ECARNET_REMINDER_CATCHUP_MINUTES = int(os.environ["ECARNET_REMINDER_CATCHUP_MINUTES"]) if os.environ.get("ECARNET_REMINDER_CATCHUP_MINUTES", "").isdigit() else 10
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in os.environ.get("CORS_ALLOWED_ORIGINS", WEB_ORIGIN).split(",") if origin.strip()]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.environ.get("CSRF_TRUSTED_ORIGINS", ",".join(CORS_ALLOWED_ORIGINS)).split(",") if origin.strip()]
CSRF_COOKIE_HTTPONLY = False
SESSION_COOKIE_HTTPONLY = True
# En production, `None; Secure` reste nécessaire pour le callback OAuth Apple (POST cross-site).
# Avec app.<domaine> et api.<domaine>, les requêtes restent same-site : Safari/iOS accepte alors la session.
SESSION_COOKIE_SAMESITE = os.environ.get("SESSION_COOKIE_SAMESITE", "None" if not DEBUG else "Lax")
CSRF_COOKIE_SAMESITE = os.environ.get("CSRF_COOKIE_SAMESITE", "None" if not DEBUG else "Lax")
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_AGE = int(os.environ.get("ECARNET_SESSION_AGE_SECONDS", str(60 * 60 * 8)))
SESSION_EXPIRE_AT_BROWSER_CLOSE = False
SESSION_SAVE_EVERY_REQUEST = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend" if DEBUG else "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = os.environ.get("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "25"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "false").lower() == "true"
EMAIL_USE_SSL = os.environ.get("EMAIL_USE_SSL", "false").lower() == "true"
EMAIL_TIMEOUT = float(os.environ.get("EMAIL_TIMEOUT", "10"))
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "no-reply@e-carnet.local")
# Destinataires (séparés par des virgules) prévenus d'un nouveau message de contact. Vide = aucune notification ; l'e-mail ne contient aucune donnée personnelle.
ECARNET_CONTACT_NOTIFY_TO = os.environ.get("ECARNET_CONTACT_NOTIFY_TO", "")
ECARNET_INVITATION_BASE_URL = os.environ.get("ECARNET_INVITATION_BASE_URL", f"{WEB_ORIGIN}/etablissement/activation")


# --- Durcissement production (actif dès que DJANGO_DEBUG n'est pas « true ») ---------------------------------------
# Laisser vide en production : cookie host-only sur api.<domaine>, suffisant pour les appels same-site
# depuis app.<domaine> et plus sûr qu'un cookie partagé avec tous les sous-domaines.
SESSION_COOKIE_DOMAIN = os.environ.get("SESSION_COOKIE_DOMAIN") or None
CSRF_COOKIE_DOMAIN = os.environ.get("CSRF_COOKIE_DOMAIN") or None
ADMIN_URL = (os.environ.get("DJANGO_ADMIN_PATH", "admin/").strip("/") + "/")
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")  # l'hébergeur termine TLS et transmet l'en-tête
    SECURE_SSL_REDIRECT = os.environ.get("DJANGO_SSL_REDIRECT", "true").lower() == "true"
    SECURE_REDIRECT_EXEMPT = [r"^api/v1/health/"]  # sondes internes en HTTP simple
    # Montée en charge prudente : 1 jour par défaut, à relever (puis préchargement) une fois HTTPS stabilisé.
    SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_HSTS_SECONDS", "86400"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = os.environ.get("DJANGO_HSTS_INCLUDE_SUBDOMAINS", "false").lower() == "true"
    SECURE_REFERRER_POLICY = "same-origin"

# Compteurs de limitation partagés entre workers : table de cache en base (créée par post_migrate).
RUNNING_TESTS = "test" in sys.argv
if RUNNING_TESTS:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.dummy.DummyCache"}}
elif DEBUG:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "ecarnet-local"}}
else:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.db.DatabaseCache", "LOCATION": "ecarnet_cache"}}

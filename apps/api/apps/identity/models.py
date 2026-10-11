import uuid

from django.conf import settings
from django.db import models
from .theme import default_theme


class ThemePreference(models.Model):
    """Préférences d'apparence privées à un compte, jamais à un carnet partagé."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="theme_preference")
    theme = models.JSONField(default=default_theme)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        verbose_name = "préférence de thème"
        verbose_name_plural = "préférences de thème"
    def __str__(self):
        return f"Thème du compte {self.user_id}"


class AccountProfile(models.Model):
    """Identité de présentation privée et éditable au niveau du compte."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="account_profile")
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    avatar_url = models.URLField(max_length=500, blank=True)
    avatar_data = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class AccountContext(models.Model):
    """Contexte d’usage sélectionné par un compte, sans créer de doublon d’identité."""
    ROLE_CHOICES = (("patient", "Patient"), ("professional", "Professionnel"), ("establishment", "Établissement"))
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="account_contexts")
    role = models.CharField(max_length=24, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=False)
    onboarding_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=("user", "role"), name="unique_user_context_role")]
        ordering = ("role",)


class AuthIdentity(models.Model):
    """Identité fournie par Google, Facebook ou Apple, rattachée à un compte interne."""
    PROVIDER_CHOICES = (("google", "Google"), ("facebook", "Facebook"), ("apple", "Apple"))
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="auth_identities")
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    provider_user_id = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    display_name = models.CharField(max_length=180, blank=True)
    avatar_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("provider", "provider_user_id"), name="unique_provider_identity"),
            models.UniqueConstraint(fields=("user", "provider"), name="unique_user_provider_identity"),
        ]
        indexes = [models.Index(fields=("provider", "email"))]


class AnonymousVisitor(models.Model):
    """Compteur agrégé associé à un UUID aléatoire, sans données directement identifiantes."""
    PAGE_CATEGORIES = (
        ("landing", "Accueil"), ("public", "Page publique"), ("auth", "Connexion / inscription"),
        ("patient", "Espace patient"), ("professional", "Espace professionnel"),
        ("establishment", "Espace établissement"), ("other", "Autre page"),
    )
    AUTH_EVENTS = (
        ("auth_page", "Page de connexion consultée"), ("login_success", "Connexion réussie"),
        ("login_failure", "Échec de connexion"), ("registration", "Inscription"),
        ("oauth_success", "Connexion OAuth réussie"), ("oauth_link", "Fournisseur OAuth lié"),
    )
    CLICK_CATEGORIES = tuple((value, label) for value, label in (
        ("signup", "Inscription"), ("professional_signup", "Inscription professionnel"),
        ("login", "Connexion"), ("establishment_contact", "Contact établissement"),
        ("faq", "FAQ"), ("security", "Sécurité"), ("about", "À propos"),
        ("navigation", "Navigation interne"), ("external", "Lien externe"),
        ("feedback_open", "Ouverture feedback"), ("action", "Action"), ("other", "Autre"),
    ))
    visitor_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(db_index=True)
    page_view_count = models.PositiveBigIntegerField(default=0)
    public_page_view_count = models.PositiveBigIntegerField(default=0)
    auth_page_view_count = models.PositiveBigIntegerField(default=0)
    login_success_count = models.PositiveIntegerField(default=0)
    login_failure_count = models.PositiveIntegerField(default=0)
    registration_count = models.PositiveIntegerField(default=0)
    oauth_success_count = models.PositiveIntegerField(default=0)
    oauth_link_count = models.PositiveIntegerField(default=0)
    last_page_category = models.CharField(max_length=24, choices=PAGE_CATEGORIES, default="other")
    last_auth_event = models.CharField(max_length=24, choices=AUTH_EVENTS, blank=True)
    last_auth_event_at = models.DateTimeField(null=True, blank=True)
    click_count = models.PositiveBigIntegerField(default=0)
    last_click_category = models.CharField(max_length=32, choices=CLICK_CATEGORIES, blank=True)
    last_click_page_category = models.CharField(max_length=24, choices=PAGE_CATEGORIES, default="other")
    last_click_at = models.DateTimeField(null=True, blank=True)
    survey_prompted_at = models.DateTimeField(null=True, blank=True)
    survey_completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "visiteur anonyme"
        verbose_name_plural = "visiteurs anonymes"
        ordering = ("-last_seen",)

    def __str__(self):
        return f"Visiteur anonyme {self.visitor_id}"


class SiteFeedback(models.Model):
    CATEGORY_CHOICES = (("bug", "Problème"), ("idea", "Suggestion"), ("question", "Question"), ("other", "Autre"))
    STATUS_CHOICES = (("new", "Nouveau"), ("in_progress", "En cours"), ("resolved", "Traité"))

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="idea")
    message = models.TextField(max_length=2000)
    page_category = models.CharField(max_length=24, choices=AnonymousVisitor.PAGE_CATEGORIES, default="landing")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="new", db_index=True)
    submitted_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-submitted_at",)
        verbose_name = "retour utilisateur"
        verbose_name_plural = "retours utilisateurs"

    def __str__(self):
        return f"Feedback {self.category} · {self.submitted_at:%Y-%m-%d %H:%M}"


class ProductSurveyResponse(models.Model):
    APPRECIATED_CHOICES = (
        ("organized_carnet", "Carnet clair et bien organisé"),
        ("consultation_preparation", "Préparation des consultations"),
        ("access_control", "Contrôle des accès et confidentialité"),
        ("history_traceability", "Historique et traçabilité"),
        ("design", "Interface et design"),
        ("health_content", "Qualité des informations du carnet"),
    )
    PAIN_POINT_CHOICES = (
        ("navigation", "Navigation / ergonomie"),
        ("form_fields", "Champs trop nombreux ou manquants"),
        ("features", "Fonctionnalités difficiles à utiliser"),
        ("clarity", "Consignes ou libellés peu clairs"),
        ("performance", "Lenteur ou problèmes techniques"),
        ("none", "Rien pour le moment"),
    )

    visitor = models.OneToOneField(AnonymousVisitor, on_delete=models.CASCADE, related_name="product_survey")
    rating = models.PositiveSmallIntegerField()
    appreciated = models.JSONField(default=list)
    pain_points = models.JSONField(default=list)
    improvement_suggestion = models.TextField(max_length=1200, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-submitted_at",)
        verbose_name = "réponse au questionnaire produit"
        verbose_name_plural = "réponses au questionnaire produit"

    def __str__(self):
        return f"Avis produit {self.rating}/5 · {self.submitted_at:%Y-%m-%d %H:%M}"

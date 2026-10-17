import hashlib
import secrets
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


# Alphabet sans caractères ambigus (0/O, 1/I) : le code se dicte au téléphone et se recopie à la main.
INTERNAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
# Informations que l'établissement renseigne lui‑même après activation (le nom et le responsable restent vérifiés par l'équipe).
PROFILE_FIELDS = ("establishment_type", "city", "address", "phone", "email")


def generate_internal_code():
    """Code interne lisible (ETB-XXXXXX) attribué par l'équipe Mon E‑Carnet pour distinguer deux structures homonymes."""
    for _ in range(12):
        code = "ETB-" + "".join(secrets.choice(INTERNAL_CODE_ALPHABET) for _ in range(6))
        if not Establishment.objects.filter(internal_code=code).exists():
            return code
    raise RuntimeError("Impossible de générer un code interne unique pour l'établissement.")


class Establishment(models.Model):
    STATUS_CHOICES = (("pending", "En attente"), ("active", "Active"), ("rejected", "Refusée"))

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=180)
    # Renseignés par l'établissement lui‑même (fiche d'onboarding) : vides à la création par l'équipe Mon E‑Carnet.
    establishment_type = models.CharField(max_length=100, blank=True, default="")
    city = models.CharField(max_length=120, blank=True, default="")
    address = models.CharField(max_length=240, blank=True, default="")
    phone = models.CharField(max_length=32, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    responsible_name = models.CharField(max_length=160, blank=True, default="")
    # Conservé nullable pour migrer les anciennes données; l'autorité est désormais
    # EstablishmentAdministrator, jamais ce champ historique.
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_establishments", null=True, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    internal_code = models.CharField(max_length=24, unique=True, null=True, blank=True)
    activated_at = models.DateTimeField(null=True, blank=True)
    # Date de première complétion de la fiche (information). La complétude elle‑même se lit sur les champs : tant que la
    # fiche est incomplète, la structure n'apparaît pas dans le catalogue des médecins et ne peut pas émettre de code.
    profile_completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    @property
    def is_profile_complete(self):
        return all(getattr(self, field) for field in PROFILE_FIELDS)

    @classmethod
    def with_complete_profile(cls):
        """Structures dont tous les champs de la fiche sont renseignés."""
        missing = models.Q()
        for field in PROFILE_FIELDS:
            missing |= models.Q(**{field: ""})
        return cls.objects.exclude(missing)


class EstablishmentAdministrator(models.Model):
    STATUS_CHOICES = (("active", "Actif"), ("revoked", "Révoqué"), ("ended", "Terminé"))

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    establishment = models.ForeignKey(Establishment, on_delete=models.PROTECT, related_name="administrator_history")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="establishment_administrator_roles")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="active")
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="assigned_establishment_administrators")
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-started_at",)
        constraints = [models.UniqueConstraint(fields=("establishment", "user", "started_at"), name="unique_establishment_admin_assignment")]
        indexes = [models.Index(fields=("establishment", "status")), models.Index(fields=("user", "status"))]


class EstablishmentAdminInvitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    establishment = models.ForeignKey(Establishment, on_delete=models.PROTECT, related_name="admin_invitations")
    email = models.EmailField()
    first_name = models.CharField(max_length=120, blank=True, default="")
    last_name = models.CharField(max_length=120, blank=True, default="")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    consumed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="consumed_establishment_invitations")
    # Suivi de l'envoi du courriel : le jeton n'existe qu'en clair dans le message, l'équipe doit donc voir s'il est parti.
    email_sent_at = models.DateTimeField(null=True, blank=True)
    email_error = models.CharField(max_length=40, blank=True, default="")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_establishment_invitations")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("establishment", "email", "created_at"))]

    @staticmethod
    def digest(raw_token):
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    @property
    def is_usable(self):
        return not self.consumed_at and not self.revoked_at and self.expires_at > timezone.now()


class EstablishmentJoinCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    establishment = models.ForeignKey(Establishment, on_delete=models.PROTECT, related_name="join_codes")
    code_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_establishment_join_codes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("establishment", "expires_at"))]

    @staticmethod
    def digest(raw_code):
        return hashlib.sha256(raw_code.encode("utf-8")).hexdigest()

    @property
    def is_usable(self):
        return not self.consumed_at and not self.revoked_at and self.expires_at > timezone.now()


class EstablishmentMembership(models.Model):
    STATUS_CHOICES = (("pending", "En attente"), ("active", "Active"), ("refused", "Refusée"), ("suspended", "Suspendue"), ("terminated", "Terminée"))

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    establishment = models.ForeignKey(Establishment, on_delete=models.PROTECT, related_name="memberships")
    professional = models.ForeignKey("professionals.ProfessionalProfile", on_delete=models.PROTECT, related_name="memberships")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    left_at = models.DateTimeField(null=True, blank=True)
    agreement_version = models.CharField(max_length=40, blank=True)
    agreement_accepted_at = models.DateTimeField(null=True, blank=True)
    agreement_accepted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="accepted_establishment_membership_agreements")

    class Meta:
        ordering = ("-requested_at",)
        constraints = [models.UniqueConstraint(fields=("establishment", "professional"), name="unique_establishment_professional_membership")]

import uuid

from django.conf import settings
from django.db import models


class PatientProfile(models.Model):
    """Dossier patient, détenu par un compte ou géré par un représentant."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="patient_profile")
    first_name = models.CharField(max_length=80, blank=True)
    last_name = models.CharField(max_length=80, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=24, blank=True, default="", choices=(("female", "Femme"), ("male", "Homme"), ("other", "Autre"), ("prefer_not_to_say", "Préfère ne pas préciser")))
    address = models.CharField(max_length=240, blank=True)
    # Facultative : reprise de la couverture du carnet papier. Aucune ethnie : donnée sensible sans utilité clinique ici.
    profession = models.CharField(max_length=120, blank=True)
    coverage_provider = models.CharField(max_length=160, blank=True)
    coverage_number = models.CharField(max_length=80, blank=True)
    coverage_expiry = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("created_at",)

    def display_first_name(self):
        return self.first_name or (self.user.first_name if self.user_id else "")

    def display_last_name(self):
        return self.last_name or (self.user.last_name if self.user_id else "")


class PatientRepresentation(models.Model):
    """Lien explicite et révocable entre un compte représentant et un dossier patient."""
    RELATION_CHOICES = (
        ("child", "Enfant"),
        ("parent", "Parent"),
        ("grandparent", "Grand-parent"),
        ("other", "Autre proche"),
    )
    STATUS_CHOICES = (
        ("active", "Actif"),
        ("revoked", "Révoqué"),
        ("transferred", "Transféré au titulaire"),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    guardian = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="patient_representations")
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name="representations")
    relationship = models.CharField(max_length=20, choices=RELATION_CHOICES)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("guardian", "patient"), name="unique_guardian_patient_representation"),
            models.UniqueConstraint(
                fields=("patient",),
                condition=models.Q(status="active"),
                name="unique_active_patient_representation",
            ),
        ]
        ordering = ("created_at",)


class RepresentationTransferRequest(models.Model):
    """Demande de transfert de titulaire, avec examen humain avant tout changement."""
    STATUS_CHOICES = (("pending", "En attente"), ("approved", "Approuvée"), ("rejected", "Refusée"))
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    representation = models.ForeignKey(PatientRepresentation, on_delete=models.PROTECT, related_name="transfer_requests")
    applicant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="representation_transfer_requests")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    age_verified = models.BooleanField(default=False)
    identity_verified = models.BooleanField(default=False)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="reviewed_representation_transfers")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("representation",),
                condition=models.Q(status="pending"),
                name="unique_pending_representation_transfer",
            ),
        ]
        ordering = ("-created_at",)


class ClinicalDeclaration(models.Model):
    """Déclaration patient dont la provenance initiale reste visible."""
    KIND_CHOICES = (("antecedent", "Antécédent"), ("allergy", "Allergie"), ("treatment", "Traitement"), ("blood_group", "Groupe sanguin"), ("city", "Ville"), ("emergency_contact", "Contact d’urgence"), ("height", "Taille"), ("weight", "Poids"))
    # Une seule valeur active à la fois : la nouvelle remplace l’ancienne (qui reste dans l’historique, annulée).
    SINGLETON_KINDS = ("blood_group", "city", "emergency_contact", "height", "weight")
    STATUS_CHOICES = (("declared", "Déclaré par le patient"), ("cancelled", "Annulé avec historique"))
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="declarations")
    kind = models.CharField(max_length=24, choices=KIND_CHOICES)
    label = models.CharField(max_length=160)
    details = models.TextField(blank=True, max_length=2000)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default="declared")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)
        constraints = [models.UniqueConstraint(fields=("patient", "kind", "label"), name="unique_patient_declaration")]


class PatientEmergencyCard(models.Model):
    """Carte d’urgence facultative, publiée uniquement par QR à la demande du patient.

    Le QR est unique et statique : il ne change jamais (`qr_version` n’est plus incrémenté). Il ne contient aucune donnée,
    seulement l’identifiant de la carte signé ; ce que le scan affiche est lu en direct dans le carnet, donc toute mise à
    jour est immédiate. La ville et le contact d’urgence sont des déclarations du carnet (`city`, `emergency_contact`) ;
    `city`, `contact_name`, `contact_phone` et `offline_declaration_ids` ci-dessous sont des colonnes héritées, conservées
    pour pouvoir revenir en arrière et à retirer dans une migration ultérieure."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.OneToOneField(PatientProfile, on_delete=models.CASCADE, related_name="emergency_card")
    city = models.CharField(max_length=120, blank=True)
    contact_name = models.CharField(max_length=120, blank=True)
    contact_phone = models.CharField(max_length=32, blank=True)
    offline_declaration_ids = models.JSONField(default=list)
    qr_enabled = models.BooleanField(default=False)
    qr_version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

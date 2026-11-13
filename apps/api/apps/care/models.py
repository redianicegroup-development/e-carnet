import uuid
import hashlib
from datetime import timedelta

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone
from apps.patients.models import PatientProfile


class CareEncounter(models.Model):
    """Pré-consultation patient explicitement cloisonnée par établissement destinataire."""
    STATUS_CHOICES = (("draft", "Brouillon"), ("closed", "Clôturée"))
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="encounters")
    establishment = models.ForeignKey("establishments.Establishment", null=True, blank=True, on_delete=models.PROTECT, related_name="preconsultations")
    facility_label = models.CharField(max_length=180, blank=True)
    reason = models.CharField(max_length=240, blank=True)
    observations = models.TextField(blank=True, max_length=4000)
    recorded_with_help = models.CharField(max_length=160, blank=True)
    # Constantes relevées avant la consultation (voir vitals.py) : {"weight_kg": 61.0, "systolic": 110, ...}, clés absentes si non mesurées.
    vitals = models.JSONField(default=dict, blank=True)
    preconsultation_template = models.ForeignKey("care.PreconsultationTemplate", null=True, blank=True, on_delete=models.PROTECT, related_name="encounters")
    template_responses = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="draft")
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)


class PreConsultationRevision(models.Model):
    """Trace append-only des clôtures/corrections de pré-consultation."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    encounter = models.ForeignKey(CareEncounter, on_delete=models.CASCADE, related_name="revisions")
    snapshot = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)


class AccessGrant(models.Model):
    """Autorisation temporaire contrôlée par le patient et le serveur."""
    STATUS_CHOICES = (("pending", "En attente"), ("active", "Active"), ("refused", "Refusée"), ("expired", "Expirée"), ("revoked", "Révoquée"))
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="access_grants")
    professional = models.ForeignKey("professionals.ProfessionalProfile", on_delete=models.PROTECT, related_name="access_grants")
    establishment = models.ForeignKey("establishments.Establishment", on_delete=models.PROTECT, related_name="access_grants")
    professional_name = models.CharField(max_length=180)
    facility_label = models.CharField(max_length=180)
    scope = models.JSONField(default=list)
    source_establishments = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    requested_at = models.DateTimeField(auto_now_add=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    extension_count = models.PositiveSmallIntegerField(default=0)
    revoked_at = models.DateTimeField(null=True, blank=True)
    refused_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-requested_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("patient", "professional", "establishment"),
                condition=models.Q(status__in=("pending", "active")),
                name="unique_open_access_grant_target",
            ),
            models.CheckConstraint(
                condition=~models.Q(status__in=("pending", "active"), expires_at__isnull=True),
                name="open_access_grant_has_expiry",
            ),
        ]

    def save(self, *args, **kwargs):
        if self.status == "pending" and self.expires_at is None:
            self.expires_at = timezone.now() + timedelta(days=7)
        return super().save(*args, **kwargs)

    @transaction.atomic
    def refresh_expiration(self):
        if self.status in ("pending", "active") and self.expires_at and self.expires_at <= timezone.now():
            previous_status = self.status
            changed = AccessGrant.objects.filter(
                pk=self.pk, status=previous_status, expires_at__lte=timezone.now()
            ).update(status="expired")
            if changed:
                self.status = "expired"
                from apps.audit.models import AuditEvent

                AuditEvent.objects.create(
                    event_type="access_grant.expired",
                    actor=None,
                    actor_role="system",
                    patient=self.patient,
                    establishment=self.establishment,
                    access_grant=self,
                    metadata={"action": "expired", "status": "expired"},
                )
            else:
                self.refresh_from_db(fields=("status",))
        return self


class PatientAccessQrToken(models.Model):
    """Jeton opaque d’initiation : le QR ne contient jamais le dossier patient."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="access_qr_tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def digest(raw_token):
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


class Consultation(models.Model):
    """Contribution médicale affichée au patient avec sa provenance."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="consultations")
    professional = models.ForeignKey("professionals.ProfessionalProfile", null=True, blank=True, on_delete=models.PROTECT, related_name="consultations")
    establishment = models.ForeignKey("establishments.Establishment", null=True, blank=True, on_delete=models.PROTECT, related_name="consultations")
    access_grant = models.ForeignKey(AccessGrant, null=True, blank=True, on_delete=models.PROTECT, related_name="consultations")
    source_encounter = models.ForeignKey(CareEncounter, null=True, blank=True, on_delete=models.PROTECT, related_name="consultations")
    professional_name = models.CharField(max_length=180)
    facility_label = models.CharField(max_length=180)
    reason = models.CharField(max_length=240)
    observations = models.TextField(blank=True, max_length=4000)
    symptoms = models.TextField(blank=True, max_length=4000)
    clinical_exam = models.TextField(blank=True, max_length=4000)
    diagnosis = models.TextField(blank=True, max_length=2000)
    # {"temperature_c": {"value": 38.5, "source": "preconsultation" | "professional"}, ...} : la provenance de chaque constante est gardée.
    vitals = models.JSONField(default=dict, blank=True)
    conclusion = models.TextField(blank=True, max_length=4000)
    care_plan = models.TextField(blank=True, max_length=4000)
    attestation_svg = models.TextField(blank=True, max_length=20000)
    attestation_svg_hash = models.CharField(max_length=64, blank=True)
    attestation_signed_at = models.DateTimeField(null=True, blank=True)
    # Signature et cachet du professionnel figés à la validation (identifiants Cloudinary privés, jamais exposés) :
    # les remplacer ou les retirer ensuite dans son profil ne change pas ce qui figure sur une consultation déjà signée.
    signature_asset_id = models.CharField(max_length=500, blank=True)
    stamp_asset_id = models.CharField(max_length=500, blank=True)
    validated_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-validated_at",)


class ConsultationRevision(models.Model):
    """Historique append-only de la validation et des corrections traçables."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consultation = models.ForeignKey(Consultation, on_delete=models.PROTECT, related_name="revisions")
    action = models.CharField(max_length=24, default="validated")
    snapshot = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)


class PrescriptionLine(models.Model):
    """Une ligne de l'ordonnance, rattachée à la consultation signée (jamais modifiée ensuite : une correction passe par une révision)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consultation = models.ForeignKey(Consultation, on_delete=models.CASCADE, related_name="prescription_lines")
    position = models.PositiveSmallIntegerField(default=0)
    drug_name = models.CharField(max_length=160)
    dosage = models.CharField(max_length=80, blank=True)
    posology = models.CharField(max_length=160)
    duration = models.CharField(max_length=80, blank=True)
    instructions = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ("position",)


class ExamRequest(models.Model):
    """Examen demandé par le médecin. « Demandé » et « résultat reçu » sont deux états distincts : un résultat n'est jamais supposé."""
    KIND_CHOICES = (("analysis", "Analyse biologique"), ("imaging", "Imagerie"), ("other", "Autre examen"))
    STATUS_CHOICES = (("requested", "Demandé"), ("result_received", "Résultat reçu"))
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consultation = models.ForeignKey(Consultation, on_delete=models.CASCADE, related_name="exam_requests")
    position = models.PositiveSmallIntegerField(default=0)
    kind = models.CharField(max_length=16, choices=KIND_CHOICES)
    label = models.CharField(max_length=160)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="requested")
    # Photo de la demande (ex. le bon d'examen papier), prise par le médecin comme preuve. Ce n'est PAS un résultat :
    # `MedicalDocument.exam_request` reste le seul lien « résultat reçu ».
    proof_document = models.ForeignKey("MedicalDocument", null=True, blank=True, on_delete=models.SET_NULL, related_name="exam_request_proofs")

    class Meta:
        ordering = ("position",)


def medical_document_upload_to(instance, filename):
    """Chemin opaque : les fichiers ne sont jamais exposés directement comme URL publique."""
    safe_name = filename.rsplit("/", 1)[-1].replace("\\", "_")[:120]
    return f"medical-documents/{instance.patient_id}/{uuid.uuid4()}-{safe_name}"


class MedicalDocument(models.Model):
    """Document importé par le patient ou validé par une structure, lisible via l’API authentifiée."""
    KIND_CHOICES = (
        ("prescription", "Ordonnance"),
        ("analysis", "Analyse"),
        ("imaging", "Imagerie"),
        ("certificate", "Certificat"),
        ("report", "Compte rendu"),
        ("other", "Autre"),
        ("vaccination", "Carnet de vaccination"),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="medical_documents")
    establishment = models.ForeignKey("establishments.Establishment", null=True, blank=True, on_delete=models.PROTECT, related_name="medical_documents")
    professional = models.ForeignKey("professionals.ProfessionalProfile", null=True, blank=True, on_delete=models.PROTECT, related_name="medical_documents")
    validated_at = models.DateTimeField(null=True, blank=True)
    exam_request = models.ForeignKey("ExamRequest", null=True, blank=True, on_delete=models.SET_NULL, related_name="result_documents")
    file = models.FileField(upload_to=medical_document_upload_to, blank=True, null=True)
    cloudinary_public_id = models.CharField(max_length=500, blank=True)
    cloudinary_resource_type = models.CharField(max_length=16, blank=True)
    cloudinary_version = models.PositiveBigIntegerField(null=True, blank=True)
    original_name = models.CharField(max_length=180)
    document_type = models.CharField(max_length=24, choices=KIND_CHOICES, default="other")
    document_date = models.DateField(null=True, blank=True)
    issuer = models.CharField(max_length=180, blank=True)
    content_type = models.CharField(max_length=80)
    size_bytes = models.PositiveIntegerField()
    verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.CheckConstraint(
                condition=models.Q(establishment__isnull=True) | (models.Q(professional__isnull=False) & models.Q(validated_at__isnull=False)),
                name="care_md_estab_validator_ck",
            ),
        ]


class Vaccination(models.Model):
    """Vaccination du carnet central ; une donnée ancienne inconnue reste inconnue, jamais « non effectuée »."""
    STATUS_CHOICES = (("declared", "Déclarée"), ("documented", "Documentée"), ("confirmed", "Confirmée par un professionnel"))
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="vaccinations")
    establishment = models.ForeignKey("establishments.Establishment", null=True, blank=True, on_delete=models.PROTECT, related_name="vaccinations")
    document = models.ForeignKey(MedicalDocument, null=True, blank=True, on_delete=models.SET_NULL, related_name="vaccination_records")
    confirmed_by = models.ForeignKey("professionals.ProfessionalProfile", null=True, blank=True, on_delete=models.PROTECT, related_name="confirmed_vaccinations")
    confirmed_access_grant = models.ForeignKey("AccessGrant", null=True, blank=True, on_delete=models.SET_NULL, related_name="confirmed_vaccinations")
    confirmed_at = models.DateTimeField(null=True, blank=True)
    vaccine_name = models.CharField(max_length=180)
    dose_number = models.PositiveSmallIntegerField(null=True, blank=True)
    administered_on = models.DateField(null=True, blank=True)
    batch_number = models.CharField(max_length=100, blank=True)
    facility = models.CharField(max_length=180, blank=True)
    professional = models.CharField(max_length=180, blank=True)
    next_due_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default="declared")
    notes = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-administered_on", "-created_at")


class HealthMeasurement(models.Model):
    KIND_CHOICES = (
        ("blood_pressure", "Tension"), ("glycemia", "Glycémie"), ("weight", "Poids"), ("height", "Taille"),
        ("temperature", "Température"), ("heart_rate", "Pouls"), ("spo2", "Saturation SpO₂"),
        # Types historiques gardés pour les plans de suivi déjà enregistrés; l'API de nouvelles mesures les refuse.
        ("blood_pressure_systolic", "Tension systolique (historique)"),
        ("blood_pressure_diastolic", "Tension diastolique (historique)"),
    )
    SOURCE_CHOICES = (("measured", "Mesuré"), ("declared", "Déclaré"))
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="health_measurements")
    establishment = models.ForeignKey("establishments.Establishment", null=True, blank=True, on_delete=models.PROTECT, related_name="health_measurements")
    professional = models.ForeignKey("professionals.ProfessionalProfile", null=True, blank=True, on_delete=models.PROTECT, related_name="health_measurements")
    validated_at = models.DateTimeField(null=True, blank=True)
    kind = models.CharField(max_length=32, choices=KIND_CHOICES)
    value = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    raw_value = models.CharField(max_length=32, blank=True)
    unit = models.CharField(max_length=16, blank=True)
    source = models.CharField(max_length=12, choices=SOURCE_CHOICES, default="measured")
    measured_at = models.DateTimeField()
    note = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-measured_at", "-created_at")
        indexes = [models.Index(fields=("patient", "kind", "measured_at"))]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(establishment__isnull=True) | (models.Q(professional__isnull=False) & models.Q(validated_at__isnull=False)),
                name="care_hm_estab_validator_ck",
            ),
        ]


class FollowUpPlan(models.Model):
    STATUS_CHOICES = (("active", "Actif"), ("paused", "En pause"), ("completed", "Terminé"), ("cancelled", "Annulé"))
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="follow_up_plans")
    access_grant = models.ForeignKey(AccessGrant, null=True, blank=True, on_delete=models.PROTECT, related_name="follow_up_plans")
    professional = models.ForeignKey("professionals.ProfessionalProfile", null=True, blank=True, on_delete=models.PROTECT, related_name="follow_up_plans")
    establishment = models.ForeignKey("establishments.Establishment", null=True, blank=True, on_delete=models.PROTECT, related_name="follow_up_plans")
    title = models.CharField(max_length=180)
    objective = models.CharField(max_length=500, blank=True)
    instructions = models.TextField(blank=True, max_length=2000)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="active")
    active = models.BooleanField(default=True)
    starts_on = models.DateField(null=True, blank=True)
    ends_on = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-active", "-created_at")


class FollowUpPlanItem(models.Model):
    plan = models.ForeignKey(FollowUpPlan, on_delete=models.CASCADE, related_name="items")
    measurement_kind = models.CharField(max_length=32, choices=HealthMeasurement.KIND_CHOICES)
    frequency = models.CharField(max_length=120)
    target = models.CharField(max_length=160, blank=True)
    notes = models.CharField(max_length=300, blank=True)


class FollowUpPlanRevision(models.Model):
    """Historique append-only des changements d’un plan de suivi."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(FollowUpPlan, on_delete=models.PROTECT, related_name="revisions")
    changed_by = models.ForeignKey("professionals.ProfessionalProfile", on_delete=models.PROTECT, related_name="follow_up_plan_revisions")
    action = models.CharField(max_length=24)
    snapshot = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)


class MedicationReminder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="medication_reminders")
    name = models.CharField(max_length=180)
    dosage = models.CharField(max_length=120, blank=True)
    instructions = models.CharField(max_length=300, blank=True)
    times = models.JSONField(default=list)
    # Jours de prise : 0 = lundi … 6 = dimanche. Liste vide = tous les jours (PAT-14).
    days_of_week = models.JSONField(default=list, blank=True)
    starts_on = models.DateField()
    ends_on = models.DateField(null=True, blank=True)
    stock_remaining = models.PositiveIntegerField(null=True, blank=True)
    refill_threshold = models.PositiveIntegerField(null=True, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-active", "starts_on", "name")


class MedicationIntake(models.Model):
    STATUS_CHOICES = (("taken", "Pris"), ("skipped", "Non pris"))
    reminder = models.ForeignKey(MedicationReminder, on_delete=models.CASCADE, related_name="intakes")
    scheduled_for = models.DateTimeField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES)
    recorded_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("reminder", "scheduled_for"), name="unique_medication_intake_slot")]


class PatientNotification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=40)
    title = models.CharField(max_length=180)
    body = models.CharField(max_length=500)
    metadata = models.JSONField(default=dict, blank=True)
    coalesce_key = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)


class Appointment(models.Model):
    STATUS_CHOICES = (("requested", "Demandé"), ("confirmed", "Confirmé"), ("cancelled", "Annulé"), ("completed", "Terminé"))
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="appointments")
    professional = models.ForeignKey("professionals.ProfessionalProfile", null=True, blank=True, on_delete=models.PROTECT, related_name="appointments")
    establishment = models.ForeignKey("establishments.Establishment", null=True, blank=True, on_delete=models.PROTECT, related_name="appointments")
    reason = models.CharField(max_length=240)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    proposed_starts_at = models.DateTimeField(null=True, blank=True)
    proposed_ends_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="requested")
    notes = models.CharField(max_length=500, blank=True)
    change_reason = models.CharField(max_length=500, blank=True)
    queue_number = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("starts_at",)
        indexes = [models.Index(fields=("patient", "starts_at")), models.Index(fields=("establishment", "starts_at")), models.Index(fields=("professional", "starts_at"))]


class AppointmentReminderDispatch(models.Model):
    """Clé d'idempotence des deux rappels d'un rendez-vous confirmé."""
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name="reminder_dispatches")
    kind = models.CharField(max_length=24)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("appointment", "kind"), name="unique_appointment_reminder_kind")]


class PreconsultationTemplate(models.Model):
    STATUS_CHOICES = (("draft", "Brouillon"), ("active", "Actif"), ("disabled", "Désactivé"))
    establishment = models.ForeignKey("establishments.Establishment", on_delete=models.CASCADE, related_name="preconsultation_templates")
    name = models.CharField(max_length=180)
    # Compatibilité client : le statut reste l'autorité et active est synchronisé en base.
    active = models.BooleanField(default=False)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="draft")
    fields = models.JSONField(default=list)
    approved_by = models.ForeignKey("professionals.ProfessionalProfile", null=True, blank=True, on_delete=models.PROTECT, related_name="approved_preconsultation_templates")
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ("status", "name")
        constraints = [
            models.UniqueConstraint(fields=("establishment", "name"), name="unique_preconsultation_template_name"),
            models.UniqueConstraint(fields=("establishment",), condition=models.Q(status="active"), name="unique_active_preconsult_template"),
            models.CheckConstraint(condition=(models.Q(status="active", active=True, approved_by__isnull=False, approved_at__isnull=False) | models.Q(status__in=("draft", "disabled"), active=False)), name="preconsultation_template_approval_ck"),
        ]
    def save(self, *args, **kwargs):
        self.active = self.status == "active"
        return super().save(*args, **kwargs)


class PushSubscription(models.Model):
    """Abonnement Web Push d'un navigateur ou d'un appareil (plusieurs possibles par utilisateur).

    Les clés ``p256dh`` / ``auth`` servent uniquement à chiffrer la charge utile : elles ne sont jamais exposées par l'API.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint = models.URLField(max_length=600, unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)
    user_agent = models.CharField(max_length=300, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=("user", "active"), name="care_push_user_active_idx")]


class MedicationReminderDispatch(models.Model):
    """Trace d'un créneau de rappel déjà traité : rend ``send_due_reminders`` rejouable sans doublon.

    Séparée de ``MedicationIntake`` pour ne pas fausser l'observance : une ligne ici ne dit rien sur la prise.
    """
    reminder = models.ForeignKey(MedicationReminder, on_delete=models.CASCADE, related_name="dispatches")
    scheduled_for = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("reminder", "scheduled_for"), name="unique_medication_dispatch_slot")]
        indexes = [models.Index(fields=("scheduled_for",), name="care_dispatch_slot_idx")]


class EmergencyAccessRequestQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise TypeError("Les accès d’urgence sont immuables.")

    def delete(self):
        raise TypeError("Les accès d’urgence sont immuables.")

    def bulk_update(self, objs, fields, batch_size=None):
        raise TypeError("Les accès d’urgence sont immuables.")


class EmergencyAccessRequest(models.Model):
    """Accès d’urgence « bris de glace » (ACS-13) : un professionnel lit la seule fiche d’urgence d’un patient, sans son consentement préalable.

    Append-only comme l’audit : la ligne n’est jamais modifiée. La fenêtre d’accès (``expires_at``) est fixée une fois pour
    toutes à la création (1 h au plus, non renouvelable) ; la revue a posteriori vit dans ``EmergencyAccessReview``.
    Le texte libre du motif reste ici : il n’est jamais recopié dans l’audit.
    """
    REASON_UNCONSCIOUS = "unconscious"
    REASON_VITAL_DANGER = "vital_danger"
    REASON_CANNOT_CONSENT = "cannot_consent"
    REASON_CHOICES = (
        (REASON_UNCONSCIOUS, "Patient inconscient"),
        (REASON_VITAL_DANGER, "Danger vital immédiat"),
        (REASON_CANNOT_CONSENT, "Patient dans l’incapacité de consentir, urgence médicale"),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name="emergency_access_requests")
    professional = models.ForeignKey("professionals.ProfessionalProfile", on_delete=models.PROTECT, related_name="emergency_access_requests")
    establishment = models.ForeignKey("establishments.Establishment", on_delete=models.PROTECT, related_name="emergency_access_requests")
    # Photographie au moment des faits : le nom ou l’établissement actif peuvent changer ensuite, pas ce qui s’est passé.
    professional_name = models.CharField(max_length=180)
    facility_label = models.CharField(max_length=180)
    reason_category = models.CharField(max_length=24, choices=REASON_CHOICES)
    reason_note = models.CharField(max_length=280)
    requested_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    review_due_at = models.DateTimeField()

    objects = EmergencyAccessRequestQuerySet.as_manager()

    class Meta:
        ordering = ("-requested_at",)
        indexes = [
            models.Index(fields=("establishment", "requested_at"), name="emg_acc_est_req_idx"),
            models.Index(fields=("patient", "requested_at"), name="emg_acc_pt_req_idx"),
            models.Index(fields=("professional", "patient", "requested_at"), name="emg_acc_pro_pt_req_idx"),
        ]
        constraints = [
            models.CheckConstraint(condition=models.Q(reason_category__in=("unconscious", "vital_danger", "cannot_consent")), name="emg_acc_reason_category_ck"),
            models.CheckConstraint(condition=models.Q(reason_note__gt=""), name="emg_acc_reason_note_required_ck"),
            models.CheckConstraint(condition=models.Q(expires_at__gt=models.F("requested_at")), name="emg_acc_expiry_after_start_ck"),
        ]

    @property
    def is_active_now(self):
        return self.requested_at <= timezone.now() < self.expires_at

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise TypeError("Les accès d’urgence sont immuables.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise TypeError("Les accès d’urgence sont immuables.")


class EmergencyAccessReviewQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise TypeError("Les revues d’accès d’urgence sont immuables.")

    def delete(self):
        raise TypeError("Les revues d’accès d’urgence sont immuables.")

    def bulk_update(self, objs, fields, batch_size=None):
        raise TypeError("Les revues d’accès d’urgence sont immuables.")


class EmergencyAccessReview(models.Model):
    """Revue a posteriori obligatoire (sous 72 h) par l’administrateur de l’établissement. Une seule décision, non modifiable."""
    OUTCOME_JUSTIFIED = "justified"
    OUTCOME_UNJUSTIFIED = "unjustified"
    OUTCOME_CHOICES = (
        (OUTCOME_JUSTIFIED, "Justifié"),
        (OUTCOME_UNJUSTIFIED, "Non justifié : abus à signaler"),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    emergency_access = models.OneToOneField(EmergencyAccessRequest, on_delete=models.PROTECT, related_name="review")
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="emergency_access_reviews")
    outcome = models.CharField(max_length=16, choices=OUTCOME_CHOICES)
    note = models.CharField(max_length=500, blank=True, default="")
    reviewed_at = models.DateTimeField(default=timezone.now)

    objects = EmergencyAccessReviewQuerySet.as_manager()

    class Meta:
        ordering = ("-reviewed_at",)
        constraints = [
            models.CheckConstraint(condition=models.Q(outcome__in=("justified", "unjustified")), name="emg_rev_outcome_ck"),
            # Un abus ne se signale pas sans dire pourquoi.
            models.CheckConstraint(condition=models.Q(outcome="justified") | models.Q(note__gt=""), name="emg_rev_unjustified_note_ck"),
        ]

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise TypeError("Les revues d’accès d’urgence sont immuables.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise TypeError("Les revues d’accès d’urgence sont immuables.")

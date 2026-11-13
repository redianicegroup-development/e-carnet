"""ACS-13 — accès d'urgence « bris de glace ».

Un professionnel vérifié, rattaché à un établissement actif, lit la SEULE fiche d'urgence d'un patient qui n'a pas pu consentir
(inconscient, danger vital). C'est l'exception au principe central du produit (consentement = scan du QR, un professionnel à la
fois) : elle est donc enfermée par construction.

Garde-fous, tous appliqués ici (jamais dans la vue ni dans l'interface) :
- drapeau ``ECARNET_BREAK_GLASS_ENABLED`` (faux par défaut) ;
- professionnel vérifié + rattachement actif ; motif de la liste fermée + texte libre obligatoire, contrôlés AVANT toute recherche ;
- le patient est désigné par son identité exacte (nom, prénom, date de naissance) : aucune recherche libre, réponse uniforme si le
  dossier n'est pas trouvé ou n'est pas unique, échecs tracés sans l'identité saisie (protection contre l'énumération) ;
- 1 h au plus, non renouvelable (même professionnel, même patient : refus pendant 24 h) ;
- périmètre = identité, groupe sanguin, allergies, traitements, antécédents déclarés. Jamais le dossier complet ;
- accès visible : notification immédiate du patient et de ses personnes de confiance actives (si activées), historique d'accès,
  audit renforcé (sévérité critique), notification des administrateurs de l'établissement ;
- revue a posteriori obligatoire par un administrateur de l'établissement (autre que le professionnel) sous 72 h ; un abus est
  signalé à l'équipe Mon E-Carnet (incident de sécurité) et au patient.
"""
import unicodedata
from datetime import date, timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.services import record_event
from apps.establishments.models import EstablishmentAdministrator, EstablishmentNotification
from apps.identity.models import OperationalIncident
from apps.patients.models import ClinicalDeclaration, PatientProfile, TrustedContactDelegation
from apps.professionals.access import professional_clinical_access_error

from .models import AccessGrant, EmergencyAccessRequest, EmergencyAccessReview
from .notifications import notify_patient
from .services import is_own_patient_file

MAX_DURATION = timedelta(hours=1)
REVIEW_WINDOW = timedelta(hours=72)
# « Non renouvelable » : un deuxième accès du même professionnel au même patient n'est pas rouvert avant ce délai.
NOT_RENEWABLE_WINDOW = timedelta(hours=24)
MIN_NOTE_LENGTH = 10
MAX_NOTE_LENGTH = 280
MAX_REVIEW_NOTE_LENGTH = 500
MAX_ANTECEDENTS = 20

# Ce que le professionnel reçoit. Toute extension de cette liste est une décision, pas un détail de code.
EMERGENCY_SCOPE = ("identity", "blood_group", "allergies", "treatments", "antecedents")
PROVENANCE_LABEL = "Déclaré par le patient — non confirmé par un professionnel"

REASON_LABELS = dict(EmergencyAccessRequest.REASON_CHOICES)
OUTCOME_LABELS = dict(EmergencyAccessReview.OUTCOME_CHOICES)

# Événements d'audit visibles du patient dans son historique d'accès (les lectures répétées restent dans l'audit, pas dans sa liste).
PATIENT_VISIBLE_EVENTS = ("break_glass.opened", "break_glass.reviewed", "break_glass.abuse_flagged")


class BreakGlassError(Exception):
    """Refus métier : code stable (consommé par l'interface), message affichable, statut HTTP."""

    def __init__(self, code, message, status=400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def _clip(text, size):
    text = str(text or "")
    return text if len(text) <= size else text[: size - 1].rstrip() + "…"


def feature_enabled():
    return bool(getattr(settings, "ECARNET_BREAK_GLASS_ENABLED", False))


def access_duration():
    """Durée de la fenêtre : celle du réglage, jamais plus d'une heure."""
    minutes = int(getattr(settings, "ECARNET_BREAK_GLASS_DURATION_MINUTES", 60) or 60)
    return min(MAX_DURATION, timedelta(minutes=max(1, minutes)))


# ---------------------------------------------------------------- identification du patient


def _normalize(value):
    """Minuscules, sans accents, tirets et espaces multiples ramenés à une seule espace."""
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii")
    return " ".join(text.casefold().replace("-", " ").replace("'", " ").split())


def _digits(value):
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def find_patient(*, first_name, last_name, birth_date, phone="", professional=None):
    """Retourne le dossier patient correspondant EXACTEMENT, ou None s'il n'y en a aucun ou plusieurs.

    Le téléphone ne sert qu'à départager des homonymes nés le même jour. Le professionnel ne s'ouvre jamais son propre dossier."""
    wanted_first, wanted_last = _normalize(first_name), _normalize(last_name)
    candidates = PatientProfile.objects.filter(birth_date=birth_date).select_related("user")
    matches = [
        patient for patient in candidates
        if _normalize(patient.display_first_name()) == wanted_first
        and _normalize(patient.display_last_name()) == wanted_last
        and not (professional is not None and is_own_patient_file(professional, patient))
    ]
    if len(matches) > 1 and _digits(phone):
        matches = [patient for patient in matches if _digits(patient.phone) == _digits(phone)]
    return matches[0] if len(matches) == 1 else None


# ---------------------------------------------------------------- périmètre d'urgence


def emergency_summary(patient):
    """La fiche d'urgence, rien de plus. Lue en direct dans les déclarations du patient (aucune copie).

    Pas de contact d'urgence, ni de coordonnées, ni de consultations, documents ou mesures : le prévenir est le rôle de la
    notification, pas de cette lecture."""
    declared = ClinicalDeclaration.objects.filter(patient=patient, status="declared")
    blood = declared.filter(kind="blood_group").order_by("-updated_at").first()
    line = lambda item: {"label": item.label, "details": item.details}  # noqa: E731
    return {
        "first_name": patient.display_first_name(),
        "last_name": patient.display_last_name(),
        "blood_group": blood.label if blood else "",
        "allergies": [line(item) for item in declared.filter(kind="allergy").order_by("-updated_at")],
        "treatments": [line(item) for item in declared.filter(kind="treatment").order_by("-updated_at")],
        "antecedents": [line(item) for item in declared.filter(kind="antecedent").order_by("-updated_at")[:MAX_ANTECEDENTS]],
        "scope": list(EMERGENCY_SCOPE),
        "provenance": PROVENANCE_LABEL,
    }


# ---------------------------------------------------------------- présentation


def _patient_label(patient):
    last = patient.display_last_name()
    return f"{patient.display_first_name()} {last[:1]}.".strip() if last else patient.display_first_name()


def _review_data(item):
    review = getattr(item, "review", None)  # relation inverse absente = pas encore revu (RelatedObjectDoesNotExist est un AttributeError)
    if not review:
        return None
    return {"outcome": review.outcome, "outcome_label": OUTCOME_LABELS[review.outcome], "reviewed_at": review.reviewed_at.isoformat()}


def serialize_for_professional(item):
    now = timezone.now()
    return {
        "id": str(item.id),
        "status": "active" if item.requested_at <= now < item.expires_at else "expired",
        "patient_label": _patient_label(item.patient),
        "reason_category": item.reason_category,
        "reason_label": REASON_LABELS[item.reason_category],
        "requested_at": item.requested_at.isoformat(),
        "expires_at": item.expires_at.isoformat(),
        "review": _review_data(item),
    }


def serialize_for_administrator(item, *, administrator_user_id):
    now = timezone.now()
    review = _review_data(item)
    own = item.professional.user_id == administrator_user_id
    if review:
        state = "done"
    else:
        state = "overdue" if now > item.review_due_at else "pending"
    return {
        "id": str(item.id),
        "professional_name": item.professional_name,
        "patient_name": f"{item.patient.display_first_name()} {item.patient.display_last_name()}".strip(),
        "reason_category": item.reason_category,
        "reason_label": REASON_LABELS[item.reason_category],
        "reason_note": item.reason_note,
        "requested_at": item.requested_at.isoformat(),
        "expires_at": item.expires_at.isoformat(),
        "review_due_at": item.review_due_at.isoformat(),
        "review_state": state,
        "review": review,
        "is_own": own,
        # On ne revoit pas un accès encore ouvert (l'urgence n'est pas finie) ni son propre accès.
        "can_review": state != "done" and item.expires_at <= now and not own,
    }


# ---------------------------------------------------------------- ouverture


def _clean_reason(reason_category, reason_note):
    if reason_category not in REASON_LABELS:
        raise BreakGlassError("reason_required", "Choisissez le motif de l’urgence dans la liste.")
    note = " ".join(str(reason_note or "").split())
    if len(note) < MIN_NOTE_LENGTH:
        raise BreakGlassError("reason_required", f"Décrivez la situation en quelques mots ({MIN_NOTE_LENGTH} caractères au moins) : ce texte est relu par votre établissement.")
    if len(note) > MAX_NOTE_LENGTH:
        raise BreakGlassError("reason_too_long", f"Le texte est trop long ({MAX_NOTE_LENGTH} caractères au plus).")
    return reason_category, note


def _clean_birth_date(value):
    try:
        parsed = date.fromisoformat(str(value or "").strip())
    except ValueError as exc:
        raise BreakGlassError("identification_incomplete", "Indiquez le nom, le prénom et la date de naissance du patient (AAAA-MM-JJ).") from exc
    if parsed > timezone.localdate():
        raise BreakGlassError("identification_incomplete", "Indiquez le nom, le prénom et la date de naissance du patient (AAAA-MM-JJ).")
    return parsed


def _eligible_professional(professional):
    """Vérifié + rattachement actif dans un établissement actif, à l'ouverture comme à chaque relecture."""
    error = professional_clinical_access_error(professional)
    if error:
        raise BreakGlassError("not_eligible", error, status=403)
    if professional.verification_status != "verified":
        raise BreakGlassError("not_eligible", "Votre profil professionnel doit être vérifié pour utiliser l’accès d’urgence.", status=403)
    return professional.active_establishment


def _refuse(*, professional, establishment, patient, code, message, status, reason_category):
    record_event(
        event_type="break_glass.refused",
        actor=professional.user,
        actor_role="professional",
        patient=patient,
        establishment=establishment,
        metadata={"action": "refused", "status": "refused", "category": "break_glass", "reason_code": code, "reason_category": reason_category},
    )
    raise BreakGlassError(code, message, status=status)


def open_emergency_access(*, professional, first_name, last_name, birth_date, phone="", reason_category, reason_note):
    """Ouvre (ou retrouve) l'accès d'urgence. Retourne ``(accès, créé)``.

    Rejouer la demande pendant que l'accès est ouvert retrouve le même accès, sans en créer un second ni prolonger la fenêtre."""
    establishment = _eligible_professional(professional)
    reason_category, reason_note = _clean_reason(reason_category, reason_note)
    birth = _clean_birth_date(birth_date)
    if not _normalize(first_name) or not _normalize(last_name):
        raise BreakGlassError("identification_incomplete", "Indiquez le nom, le prénom et la date de naissance du patient (AAAA-MM-JJ).")

    patient = find_patient(first_name=first_name, last_name=last_name, birth_date=birth, phone=phone, professional=professional)
    if patient is None:
        # Aucune identité dans la trace : on garde qui a cherché, où, pour quel motif. Réponse identique que le dossier existe ou non.
        _refuse(professional=professional, establishment=establishment, patient=None, code="patient_not_identified", status=404, reason_category=reason_category,
                message="Aucun dossier unique ne correspond à ces informations. Vérifiez-les, ou utilisez le QR du patient s’il peut le présenter.")

    refusal = None
    with transaction.atomic():
        # Sérialise les demandes simultanées sur ce patient (PostgreSQL) : pas de doublon, pas de double fenêtre.
        PatientProfile.objects.select_for_update().get(pk=patient.pk)
        now = timezone.now()
        mine = EmergencyAccessRequest.objects.filter(patient=patient, professional=professional).order_by("-requested_at")
        current = mine.filter(expires_at__gt=now).first()
        if current:
            return current, False
        if mine.filter(requested_at__gt=now - NOT_RENEWABLE_WINDOW).exists():
            refusal = ("not_renewable", "Votre accès d’urgence à ce patient est terminé et ne se renouvelle pas. Si l’urgence continue, passez par le QR du patient, son représentant ou l’administrateur de votre établissement.", 409)
        elif AccessGrant.objects.filter(patient=patient, professional=professional, status="active", expires_at__gt=now).exists():
            refusal = ("consent_available", "Vous avez déjà un accès ouvert par le patient : l’accès d’urgence n’est pas nécessaire.", 409)
        else:
            duration = access_duration()
            item = EmergencyAccessRequest.objects.create(
                patient=patient,
                professional=professional,
                establishment=establishment,
                professional_name=f"{professional.user.first_name} {professional.user.last_name}".strip() or professional.professional_title,
                facility_label=establishment.name,
                reason_category=reason_category,
                reason_note=reason_note,
                requested_at=now,
                expires_at=now + duration,
                review_due_at=now + REVIEW_WINDOW,
            )
            minutes = int(duration.total_seconds() // 60)
            record_event(
                event_type="break_glass.opened",
                actor=professional.user,
                actor_role="professional",
                patient=patient,
                establishment=establishment,
                metadata={
                    "action": "opened", "category": "break_glass", "severity": "critical", "status": "active", "scope": ["emergency_card"],
                    "reason_category": reason_category, "resource_type": "emergency_access", "resource_id": str(item.id),
                    "authorized_until": item.expires_at.isoformat(), "access_duration_minutes": minutes,
                },
            )
            _notify_opened(item, minutes)
    if refusal:
        code, message, status = refusal
        _refuse(professional=professional, establishment=establishment, patient=patient, code=code, message=message, status=status, reason_category=reason_category)
    return item, True


def _notify_opened(item, minutes):
    patient = item.patient
    # 1. Le patient : immédiat, jamais regroupé (chaque accès d'urgence est un événement à part).
    notify_patient(
        patient,
        kind="break_glass.opened",
        title="Accès d’urgence à votre fiche",
        body=(
            f"{_clip(item.professional_name, 60)} de {_clip(item.facility_label, 80)} a ouvert votre fiche d’urgence "
            f"(groupe sanguin, allergies, traitements, antécédents) pendant {minutes} min, sans votre accord préalable. "
            f"Motif : {REASON_LABELS[item.reason_category].lower()}. Votre carnet complet n’a pas été ouvert."
        ),
        metadata={"emergency_access_id": str(item.id)},
    )
    # 2. Ses personnes de confiance actives, seulement si la fonction est activée.
    if getattr(settings, "ECARNET_TRUSTED_CONTACTS_ENABLED", False):
        delegations = TrustedContactDelegation.objects.filter(patient=patient, status="active", expires_at__gt=item.requested_at).select_related("delegate")
        for delegation in delegations:
            contact_profile = getattr(delegation.delegate, "patient_profile", None) if delegation.delegate_id else None
            if contact_profile is None:
                continue
            notify_patient(
                contact_profile,
                kind="break_glass.trusted_contact",
                title="Accès d’urgence à la fiche d’un proche",
                body=f"La fiche d’urgence de {_clip(patient.display_first_name(), 60) or 'votre proche'} a été ouverte en urgence par un professionnel de {_clip(item.facility_label, 80)}. Vous recevez ce message car vous êtes sa personne de confiance.",
                metadata={"delegation_id": str(delegation.id), "emergency_access_id": str(item.id)},
            )
    # 3. Les administrateurs de l'établissement (sauf le professionnel lui-même : il ne peut pas revoir son propre accès).
    for assignment in EstablishmentAdministrator.objects.filter(establishment=item.establishment, status="active").exclude(user_id=item.professional.user_id):
        EstablishmentNotification.objects.get_or_create(
            recipient=assignment.user,
            event_key=f"break-glass:{item.id}",
            defaults={
                "establishment": item.establishment,
                "kind": "break_glass.review_due",
                "title": "Accès d’urgence à revoir sous 72 h",
                "body": f"{_clip(item.professional_name, 80)} a ouvert un accès d’urgence. Revue attendue avant le {timezone.localtime(item.review_due_at):%d/%m/%Y à %H:%M}.",
                "metadata": {"emergency_access_id": str(item.id)},
            },
        )


# ---------------------------------------------------------------- relecture pendant la fenêtre


def read_emergency_access(*, professional, request_id):
    """Relit la fiche d'urgence tant que la fenêtre est ouverte. Retourne ``(accès, fiche)``. Après l'heure : refus, définitif."""
    item = EmergencyAccessRequest.objects.select_related("patient", "patient__user", "professional__user", "establishment").filter(pk=request_id, professional=professional).first()
    if item is None:
        raise BreakGlassError("not_found", "Accès d’urgence introuvable.", status=404)
    establishment = _eligible_professional(professional)
    if item.establishment_id != establishment.id:
        raise BreakGlassError("wrong_establishment", "Cet accès d’urgence a été ouvert dans un autre établissement.", status=403)
    if not item.is_active_now:
        record_event(
            event_type="break_glass.refused", actor=professional.user, actor_role="professional", patient=item.patient, establishment=item.establishment,
            metadata={"action": "refused", "status": "expired", "category": "break_glass", "reason_code": "expired", "resource_type": "emergency_access", "resource_id": str(item.id)},
        )
        raise BreakGlassError("expired", "Cet accès d’urgence est terminé. Il dure une heure au plus et ne se renouvelle pas.", status=403)
    record_event(
        event_type="break_glass.read", actor=professional.user, actor_role="professional", patient=item.patient, establishment=item.establishment,
        metadata={"action": "read", "category": "break_glass", "severity": "critical", "scope": ["emergency_card"], "resource_type": "emergency_access", "resource_id": str(item.id)},
    )
    return item, emergency_summary(item.patient)


def list_for_professional(professional, limit=30):
    return [serialize_for_professional(item) for item in EmergencyAccessRequest.objects.filter(professional=professional).select_related("patient", "patient__user", "review")[:limit]]


# ---------------------------------------------------------------- revue a posteriori


def administrator_assignment(user, establishment_id):
    return EstablishmentAdministrator.objects.filter(user=user, status="active", establishment__status="active", establishment_id=establishment_id).select_related("establishment").first()


def list_for_administrator(administrator, establishment, limit=100):
    items = EmergencyAccessRequest.objects.filter(establishment=establishment).select_related("patient", "patient__user", "professional__user", "review")[:limit]
    return [serialize_for_administrator(item, administrator_user_id=administrator.id) for item in items]


def review_emergency_access(*, administrator, establishment, request_id, outcome, note=""):
    """Décision unique et définitive d'un administrateur de l'établissement. Un abus est signalé (incident de sécurité + patient)."""
    if outcome not in OUTCOME_LABELS:
        raise BreakGlassError("invalid_outcome", "Choisissez « Justifié » ou « Non justifié ».")
    note = " ".join(str(note or "").split())
    if len(note) > MAX_REVIEW_NOTE_LENGTH:
        raise BreakGlassError("note_too_long", f"La note est trop longue ({MAX_REVIEW_NOTE_LENGTH} caractères au plus).")
    if outcome == EmergencyAccessReview.OUTCOME_UNJUSTIFIED and not note:
        raise BreakGlassError("note_required", "Expliquez pourquoi cet accès n’est pas justifié : ce texte accompagne le signalement.")
    with transaction.atomic():
        item = (
            EmergencyAccessRequest.objects.select_for_update(of=("self",))
            .select_related("patient", "patient__user", "professional__user", "establishment")
            .filter(pk=request_id, establishment=establishment)
            .first()
        )
        if item is None:
            raise BreakGlassError("not_found", "Accès d’urgence introuvable.", status=404)
        if item.professional.user_id == administrator.id:
            raise BreakGlassError("review_conflict", "Vous ne pouvez pas revoir votre propre accès d’urgence : un autre administrateur doit le faire.", status=403)
        if item.expires_at > timezone.now():
            raise BreakGlassError("still_active", "L’accès d’urgence est encore ouvert. La revue se fait une fois la fenêtre terminée.", status=409)
        try:
            with transaction.atomic():
                review = EmergencyAccessReview.objects.create(emergency_access=item, reviewed_by=administrator, outcome=outcome, note=note)
        except IntegrityError as exc:
            raise BreakGlassError("already_reviewed", "Cet accès d’urgence a déjà été revu.", status=409) from exc
        abusive = outcome == EmergencyAccessReview.OUTCOME_UNJUSTIFIED
        record_event(
            event_type="break_glass.reviewed", actor=administrator, actor_role="establishment_admin", patient=item.patient, establishment=item.establishment,
            metadata={"action": "reviewed", "status": outcome, "category": "break_glass", "severity": "critical" if abusive else "info", "resource_type": "emergency_access", "resource_id": str(item.id)},
        )
        if abusive:
            _flag_abuse(item)
    return review


def _flag_abuse(item):
    record_event(
        event_type="break_glass.abuse_flagged", actor=None, actor_role="system", patient=item.patient, establishment=item.establishment,
        metadata={"action": "flagged", "status": "unjustified", "category": "break_glass", "severity": "critical", "resource_type": "emergency_access", "resource_id": str(item.id)},
    )
    # Signalement à l'équipe Mon E-Carnet : un incident de sécurité, sans donnée personnelle dans le résumé.
    OperationalIncident.objects.get_or_create(
        incident_key=f"break-glass-abuse:{item.id}",
        defaults={"severity": "critical", "category": "security", "summary": f"Accès d’urgence jugé injustifié par {item.establishment.name[:120]}. Sanction à décider."},
    )
    notify_patient(
        item.patient,
        kind="break_glass.abuse_flagged",
        title="Un accès d’urgence à votre fiche a été jugé injustifié",
        body=f"{_clip(item.facility_label, 80)} a examiné l’accès d’urgence du {timezone.localtime(item.requested_at):%d/%m/%Y} à votre fiche et l’a jugé injustifié. Il a été signalé à l’équipe Mon E‑Carnet.",
        metadata={"emergency_access_id": str(item.id)},
    )


def escalate_overdue_reviews(now=None):
    """Signale (une seule fois par accès) les revues non faites après 72 h. Retourne le nombre d'accès nouvellement signalés. Rejouable."""
    now = now or timezone.now()
    flagged = 0
    overdue = EmergencyAccessRequest.objects.filter(review_due_at__lt=now, review__isnull=True).select_related("establishment", "professional__user")
    for item in overdue:
        incident, created = OperationalIncident.objects.get_or_create(
            incident_key=f"break-glass-overdue:{item.id}",
            defaults={"severity": "major", "category": "security", "summary": f"Revue d’accès d’urgence en retard de plus de 72 h dans {item.establishment.name[:120]}."},
        )
        if not created:
            continue
        flagged += 1
        record_event(
            event_type="break_glass.review_overdue", actor=None, actor_role="system", patient=item.patient, establishment=item.establishment,
            metadata={"action": "overdue", "status": "pending", "category": "break_glass", "severity": "major", "resource_type": "emergency_access", "resource_id": str(item.id), "incident_key": incident.incident_key},
        )
        for assignment in EstablishmentAdministrator.objects.filter(establishment=item.establishment, status="active").exclude(user_id=item.professional.user_id):
            EstablishmentNotification.objects.get_or_create(
                recipient=assignment.user, event_key=f"break-glass-overdue:{item.id}",
                defaults={"establishment": item.establishment, "kind": "break_glass.review_overdue", "title": "Revue d’accès d’urgence en retard",
                          "body": "Un accès d’urgence attend votre revue depuis plus de 72 h. L’équipe Mon E‑Carnet en a été informée.", "metadata": {"emergency_access_id": str(item.id)}},
            )
    return flagged


"""Mode invité, médecin sans téléphone : la consultation est écrite sur le téléphone du patient, puis confirmée par le médecin sur le sien.

Rien n'entre dans le carnet signé avant la confirmation : la saisie vit dans `GuestConsultation`, sans signature, et le patient la voit
comme « en attente ». Le médecin est prévenu, relit le contenu (il peut le corriger), puis signe : c'est `validate_consultation` qui crée la vraie
`Consultation`. S'il ne reconnaît pas la saisie, il la rejette. Passé le délai, elle expire sans jamais devenir une consultation signée."""
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.services import record_event
from apps.patients.models import PatientProfile
from apps.professionals.access import professional_clinical_access_error

from .guest_access import GUEST_METHOD, GUEST_PRO_ACCESS_MODE
from .models import AccessGrant, CareEncounter, GuestConsultation
from .notifications import notify_patient
from .pending_services import DRAFT_FIELDS, _jsonable

AWAITING = "awaiting_confirmation"
GUEST_CONSULTATION_TTL = timedelta(days=7)
END_REASON_GUEST_WRITTEN = "guest_written"


def expire_overdue(**filters):
    """Passe en « expirée » les saisies que le médecin n'a pas confirmées à temps. Appelé à la lecture : pas de tâche de fond à surveiller."""
    return GuestConsultation.objects.filter(status=AWAITING, expires_at__lte=timezone.now(), **filters).update(status="expired", resolved_at=timezone.now())


def _push_to_professional(professional, *, title, body, item):
    user_id = getattr(professional, "user_id", None)
    if not user_id:
        return
    from .push import send_push_to_user

    transaction.on_commit(lambda: send_push_to_user(user_id, kind="guest_consultation.awaiting", title=title, body=body, url="/professionnel/consultations", data={"guest_consultation_id": str(item.id)}))


@transaction.atomic
def save_guest_consultation(*, patient, actor, actor_role, grant_id, data):
    """Enregistre ce que le médecin a écrit sur le téléphone du patient, SANS signature, et ferme aussitôt sa session.

    La pré-consultation du patient est reprise si elle existe ; sinon elle est créée avec le motif. Une seule consultation peut attendre sur une
    même pré-consultation."""
    now = timezone.now()
    grant = AccessGrant.objects.select_for_update(of=("self",)).select_related("professional__user", "establishment").filter(pk=grant_id, patient=patient, access_mode=GUEST_PRO_ACCESS_MODE).first()
    if not grant:
        raise ValidationError("Accès invité introuvable. Identifiez de nouveau le médecin.")
    grant.refresh_expiration()
    if grant.status != "active":
        raise ValidationError("L’accès invité a expiré. Identifiez de nouveau le médecin.")
    if "preconsultation" not in (grant.scope or []):
        raise ValidationError("Cet accès invité ne couvre pas la consultation.")
    professional = grant.professional
    access_error = professional_clinical_access_error(professional)
    if access_error:
        raise ValidationError(access_error)
    reason = (data.get("reason") or "").strip()
    if not reason:
        raise ValidationError("Le motif de consultation est requis.")
    # Un seul brouillon à la fois (règle du patient) ; le verrou sérialise deux enregistrements simultanés.
    PatientProfile.objects.select_for_update().get(pk=patient.pk)
    encounter = CareEncounter.objects.select_for_update().filter(patient=patient, status="draft").order_by("-updated_at", "-created_at").first()
    if encounter:
        if encounter.establishment_id and encounter.establishment_id != grant.establishment_id:
            raise ValidationError("Une pré-consultation est déjà en préparation pour un autre établissement.")
    else:
        encounter = CareEncounter.objects.create(
            patient=patient, establishment=grant.establishment, facility_label=grant.establishment.name,
            reason=reason, observations=(data.get("observations") or "").strip(), recorded_with_help=grant.professional_name,
        )
        record_event(event_type="preconsultation.created", actor=actor, actor_role=actor_role, patient=patient, establishment=grant.establishment, access_grant=grant, metadata={"action": "created", "encounter_id": str(encounter.id), "status": encounter.status, "resource_type": "preconsultation", "method": GUEST_METHOD})
    if GuestConsultation.objects.filter(source_encounter=encounter, status=AWAITING).exists():
        raise ValidationError("Une consultation est déjà en attente de confirmation pour cette pré-consultation.")
    draft = {key: _jsonable(data[key]) for key in DRAFT_FIELDS if key in data}
    draft["reason"] = reason
    item = GuestConsultation.objects.create(
        patient=patient, professional=professional, establishment=grant.establishment, access_grant=grant, source_encounter=encounter,
        draft=draft, written_on_account=actor, expires_at=now + GUEST_CONSULTATION_TTL,
    )
    # La saisie est faite : la session du médecin sur ce téléphone se ferme tout de suite (elle ne sert plus à rien, et libère le patient).
    AccessGrant.objects.filter(pk=grant.pk, status="active").update(status="expired", expires_at=now)
    grant.status, grant.expires_at = "expired", now
    record_event(event_type="access_grant.ended", actor=actor, actor_role=actor_role, patient=patient, establishment=grant.establishment, access_grant=grant, metadata={"action": "ended", "status": "expired", "reason_code": END_REASON_GUEST_WRITTEN, "method": GUEST_METHOD})
    record_event(event_type="guest_consultation.written", actor=actor, actor_role=actor_role, patient=patient, establishment=grant.establishment, access_grant=grant, metadata={"action": "written", "status": AWAITING, "encounter_id": str(encounter.id), "resource_type": "consultation", "resource_id": str(item.id), "method": GUEST_METHOD})
    patient_name = f"{patient.display_first_name()} {patient.display_last_name()}".strip() or "Un patient"
    _push_to_professional(professional, title="Consultation à confirmer", body=f"{patient_name} : une consultation a été saisie en votre nom sur son téléphone. Relisez-la et confirmez-la, ou rejetez-la si ce n’est pas vous.", item=item)
    return item


@transaction.atomic
def reject_guest_consultation(*, professional, pk, actor):
    """Le médecin ne reconnaît pas (ou n'accepte pas) la saisie : elle est rejetée, jamais signée. La pré-consultation du patient reste un brouillon."""
    expire_overdue(professional=professional)
    item = GuestConsultation.objects.select_for_update(of=("self",)).select_related("patient", "establishment").filter(pk=pk, professional=professional).first()
    if not item:
        raise ValidationError("Consultation à confirmer introuvable.")
    if item.status != AWAITING:
        raise ValidationError("Cette consultation n’est plus à confirmer.")
    now = timezone.now()
    item.status, item.resolved_at = "rejected", now
    item.save(update_fields=("status", "resolved_at", "updated_at"))
    record_event(event_type="guest_consultation.rejected", actor=actor, actor_role="professional", patient=item.patient, establishment=item.establishment, access_grant=item.access_grant, metadata={"action": "rejected", "status": "rejected", "encounter_id": str(item.source_encounter_id), "resource_type": "consultation", "resource_id": str(item.id), "method": GUEST_METHOD})
    who = f"{professional.user.first_name} {professional.user.last_name}".strip() or "Le professionnel"
    notify_patient(item.patient, kind="consultation.not_confirmed", title="Consultation non confirmée", body=f"{who} n’a pas confirmé la consultation saisie sur votre téléphone. Elle n’a pas été ajoutée à votre carnet.", metadata={"guest_consultation_id": str(item.id)})
    return item

"""PRO-21 — le laboratoire interne d'un établissement et ses administrateurs.

Un établissement a UN laboratoire interne (créé au premier rattachement, nommé d'après l'établissement) : l'administrateur de l'établissement
ne saisit donc jamais de nom de laboratoire, seulement le prénom, le nom et l'e‑mail d'un administrateur de ce laboratoire. Il peut en
rattacher plusieurs : chacun reçoit son propre compte, ouvert comme celui d'un responsable d'établissement (mot de passe temporaire révélé
UNE fois, à transmettre hors application) ; il se connecte ensuite et arrive dans l'espace laboratoire. Le laboratoire n'a ni code médecin,
ni dossiers, ni lecture clinique (voir `Establishment.is_laboratory`)."""
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event
from apps.care.pending_services import DISABLED_MESSAGE, lab_enabled

from .models import Establishment, EstablishmentAdministrator, generate_internal_code
from .revocations import clean_reason, notify_revoked
from .provisioning import AccountConflict, provision_administrator
from apps.identity.temporary_password import temporary_password_expired

from .views import access_response_data, account_conflict_response, active_administrator, secret_response

LAB_TYPE_LABEL = "Laboratoire"
# Plafond de comptes administrateurs du laboratoire interne : chaque ajout ouvre un compte avec mot de passe temporaire.
MAX_LAB_ADMINISTRATORS = 10


def internal_laboratory_name(parent):
    """Nom du laboratoire interne, déduit de l'établissement (jamais saisi)."""
    if parent.name.strip().lower().startswith("laboratoire"):
        return parent.name.strip()[:180]
    return f"Laboratoire {parent.name.strip()}"[:180]


def internal_laboratory(parent):
    """Le laboratoire interne d'un établissement : le plus ancien laboratoire rattaché (les premières versions en permettaient plusieurs)."""
    return parent.laboratories.order_by("created_at").first()


def _access_of(admin):
    """État de l'accès d'un administrateur : temporary_password (jamais connecté), expired, activated."""
    profile = getattr(admin.user, "account_profile", None)
    if not (profile and profile.must_change_password):
        return {"email": admin.user.email, "state": "activated", "expires_at": None}
    return {"email": admin.user.email, "state": "expired" if temporary_password_expired(profile) else "temporary_password", "expires_at": profile.temporary_password_expires_at}


def administrators_of(lab):
    """Administrateurs actifs du laboratoire, du plus ancien au plus récent (historique préchargé)."""
    active = sorted((item for item in lab.administrator_history.all() if item.status == "active"), key=lambda item: item.started_at)
    return [
        {
            "id": str(item.id), "first_name": item.user.first_name, "last_name": item.user.last_name,
            "name": f"{item.user.first_name} {item.user.last_name}".strip(), "email": item.user.email, "started_at": item.started_at, "access": _access_of(item),
        }
        for item in active
    ]


class EstablishmentLaboratoriesView(APIView):
    permission_classes = [IsAuthenticated]

    def _parent(self, request, establishment_id):
        admin = active_administrator(request.user, establishment_id)
        if not admin or admin.establishment.is_laboratory:
            return None
        return admin.establishment

    def get(self, request, establishment_id):
        if not lab_enabled():
            return Response({"success": False, "message": DISABLED_MESSAGE}, status=404)
        parent = self._parent(request, establishment_id)
        if not parent:
            return Response({"success": False, "message": "Vous n’êtes pas administrateur de cet établissement actif."}, status=403)
        labs = parent.laboratories.prefetch_related("administrator_history__user__account_profile").order_by("created_at")
        items = []
        for lab in labs:
            administrators = administrators_of(lab)
            items.append({
                "id": str(lab.id), "name": lab.name, "status": lab.status, "created_at": lab.created_at,
                "administrators": administrators, "can_add_administrator": len(administrators) < MAX_LAB_ADMINISTRATORS,
                # Compatibilité avec les clients d'avant la V1.15 (un seul administrateur par laboratoire).
                "administrator": {"name": administrators[0]["name"], "email": administrators[0]["email"]} if administrators else None,
                "access": administrators[0]["access"] if administrators else None,
            })
        return Response({"success": True, "data": items})

    @transaction.atomic
    def post(self, request, establishment_id):
        """Rattache un administrateur au laboratoire interne de l'établissement (créé au premier rattachement). Aucun nom de laboratoire n'est saisi."""
        if not lab_enabled():
            return Response({"success": False, "message": DISABLED_MESSAGE}, status=404)
        parent = self._parent(request, establishment_id)
        if not parent:
            return Response({"success": False, "message": "Vous n’êtes pas administrateur de cet établissement actif."}, status=403)
        email = str(request.data.get("admin_email", "")).strip().lower()
        first_name = " ".join(str(request.data.get("admin_first_name", "")).split())[:120]
        last_name = " ".join(str(request.data.get("admin_last_name", "")).split())[:120]
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({"success": False, "message": "L’e‑mail de l’administrateur du laboratoire est requis : c’est son identifiant de connexion."}, status=400)
        if not first_name or not last_name:
            return Response({"success": False, "message": "Le prénom et le nom de l’administrateur du laboratoire sont requis."}, status=400)
        # Verrou sur l'établissement : deux rattachements simultanés ne créent jamais deux laboratoires internes.
        parent = Establishment.objects.select_for_update().get(pk=parent.pk)
        lab = internal_laboratory(parent)
        created_lab = lab is None
        if lab is not None:
            if lab.status != "active":
                return Response({"success": False, "code": "laboratory_inactive", "message": "Le laboratoire de votre établissement n’est pas actif : écrivez à l’équipe Mon E‑Carnet."}, status=409)
            if lab.administrator_history.filter(status="active").count() >= MAX_LAB_ADMINISTRATORS:
                return Response({"success": False, "code": "too_many_administrators", "message": f"Le laboratoire a déjà {MAX_LAB_ADMINISTRATORS} administrateurs : c’est le maximum."}, status=409)
        try:
            with transaction.atomic():
                if created_lab:
                    lab = Establishment.objects.create(
                        name=internal_laboratory_name(parent), status="active", activated_at=timezone.now(), created_by=request.user, internal_code=generate_internal_code(),
                        is_laboratory=True, parent=parent, establishment_type=LAB_TYPE_LABEL, city=parent.city,
                    )
                # `use_existing_account` n'est JAMAIS passé : un administrateur d'établissement ne peut pas rattacher le compte
                # existant de quelqu'un d'autre (seule l'équipe Mon E‑Carnet le peut). Adresse déjà connue → 409.
                # `replace_current=False` : les administrateurs déjà actifs du laboratoire gardent leur accès.
                access = provision_administrator(establishment=lab, assigned_by=request.user, email=email, first_name=first_name, last_name=last_name, replace_current=False)
        except AccountConflict as conflict:
            return account_conflict_response(conflict)
        if created_lab:
            record_event(event_type="laboratory.created", actor=request.user, actor_role="establishment_admin", establishment=parent, metadata={"action": "created", "resource_type": "establishment", "resource_id": str(lab.id)})
        record_event(event_type="laboratory.administrator.added", actor=request.user, actor_role="establishment_admin", establishment=parent, metadata={"action": "added", "resource_type": "establishment", "resource_id": str(lab.id)})
        data = access_response_data(lab, access)
        data["laboratory"] = {"id": str(lab.id), "name": lab.name}
        data["laboratory_created"] = created_lab
        return secret_response(data, status=201)


class LaboratoryAdministratorRevokeView(APIView):
    """Retire l'accès d'un administrateur du laboratoire interne, avec un motif obligatoire.

    Réservé à l'administrateur de l'établissement parent. L'accès s'arrête aussitôt (l'autorité est la ligne d'historique, relue à chaque
    requête) ; le motif est montré à la personne à sa prochaine connexion et un push l'avertit sans le révéler. L'historique est conservé."""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, establishment_id, laboratory_id, administrator_id):
        if not lab_enabled():
            return Response({"success": False, "message": DISABLED_MESSAGE}, status=404)
        parent_admin = active_administrator(request.user, establishment_id)
        if not parent_admin or parent_admin.establishment.is_laboratory:
            return Response({"success": False, "message": "Vous n’êtes pas administrateur de cet établissement actif."}, status=403)
        record = (
            EstablishmentAdministrator.objects.select_for_update()
            .select_related("user", "establishment")
            .filter(pk=administrator_id, establishment_id=laboratory_id, establishment__parent_id=parent_admin.establishment_id, establishment__is_laboratory=True, status="active")
            .first()
        )
        if not record:
            return Response({"success": False, "message": "Administrateur du laboratoire introuvable ou déjà retiré."}, status=404)
        reason, reason_error = clean_reason(request.data.get("reason"))
        if reason_error:
            return Response({"success": False, "message": reason_error}, status=400)
        record.status = "revoked"
        record.ended_at = timezone.now()
        record.end_reason = reason
        record.ended_by = request.user
        record.end_notice_seen_at = None
        record.save(update_fields=("status", "ended_at", "end_reason", "ended_by", "end_notice_seen_at"))
        record_event(event_type="laboratory.administrator.revoked", actor=request.user, actor_role="establishment_admin", establishment=parent_admin.establishment, metadata={"action": "revoked", "resource_type": "establishment", "resource_id": str(record.establishment_id)})
        notify_revoked(record.user_id, "laboratory.revoked", url="/")
        return Response({"success": True, "data": {"id": str(record.id), "revoked": 1}})

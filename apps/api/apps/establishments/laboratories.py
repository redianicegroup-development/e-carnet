"""PRO-21 — laboratoires rattachés à un établissement.

L'administrateur d'un établissement saisit le nom du laboratoire et l'e‑mail de son administrateur. Le compte est ouvert comme celui
d'un responsable d'établissement (mot de passe temporaire révélé UNE fois, à transmettre hors application) ; il se connecte ensuite
et arrive dans l'espace laboratoire. Le laboratoire n'a ni code médecin, ni dossiers, ni lecture clinique (voir `Establishment.is_laboratory`)."""
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_event
from apps.care.pending_services import DISABLED_MESSAGE, lab_enabled

from .models import Establishment, generate_internal_code
from .provisioning import AccountConflict, provision_administrator
from .views import access_response_data, access_summary, account_conflict_response, active_administrator, administrator_summary, secret_response

LAB_TYPE_LABEL = "Laboratoire"


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
        labs = parent.laboratories.prefetch_related("administrator_history__user__account_profile").order_by("name")
        items = [{"id": str(lab.id), "name": lab.name, "status": lab.status, "administrator": administrator_summary(lab), "access": access_summary(lab), "created_at": lab.created_at} for lab in labs]
        return Response({"success": True, "data": items})

    @transaction.atomic
    def post(self, request, establishment_id):
        if not lab_enabled():
            return Response({"success": False, "message": DISABLED_MESSAGE}, status=404)
        parent = self._parent(request, establishment_id)
        if not parent:
            return Response({"success": False, "message": "Vous n’êtes pas administrateur de cet établissement actif."}, status=403)
        name = " ".join(str(request.data.get("name", "")).split())
        email = str(request.data.get("admin_email", "")).strip().lower()
        first_name = str(request.data.get("admin_first_name", "")).strip()[:120]
        last_name = str(request.data.get("admin_last_name", "")).strip()[:120]
        if not name or len(name) > 180:
            return Response({"success": False, "message": "Le nom du laboratoire est requis (180 caractères maximum)."}, status=400)
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({"success": False, "message": "L’e‑mail de l’administrateur du laboratoire est requis : c’est son identifiant de connexion."}, status=400)
        if parent.laboratories.filter(name__iexact=name).exists():
            return Response({"success": False, "code": "duplicate_name", "message": "Un laboratoire portant ce nom est déjà rattaché à votre établissement."}, status=409)
        try:
            with transaction.atomic():
                lab = Establishment.objects.create(
                    name=name, status="active", activated_at=timezone.now(), created_by=request.user, internal_code=generate_internal_code(),
                    is_laboratory=True, parent=parent, establishment_type=LAB_TYPE_LABEL, city=parent.city,
                )
                # `use_existing_account` n'est JAMAIS passé : un administrateur d'établissement ne peut pas rattacher le compte
                # existant de quelqu'un d'autre (seule l'équipe Mon E‑Carnet le peut). Adresse déjà connue → 409.
                access = provision_administrator(establishment=lab, assigned_by=request.user, email=email, first_name=first_name, last_name=last_name)
        except AccountConflict as conflict:
            return account_conflict_response(conflict)
        record_event(event_type="laboratory.created", actor=request.user, actor_role="establishment_admin", establishment=parent, metadata={"action": "created", "resource_type": "establishment", "resource_id": str(lab.id)})
        return secret_response(access_response_data(lab, access), status=201)

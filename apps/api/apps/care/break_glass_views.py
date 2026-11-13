"""ACS-13 — routes de l'accès d'urgence « bris de glace ». Toute la règle est dans ``break_glass.py`` : ici, seulement HTTP.

Format d'erreur : ``{"success": false, "code": <code stable>, "message": <texte affichable>}``. Le drapeau coupé répond 404 partout."""
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.throttles import WriteScopedThrottle

from . import break_glass as service


def _error(exc):
    return Response({"success": False, "code": exc.code, "message": exc.message}, status=exc.status)


def _disabled():
    return Response({"success": False, "code": "break_glass_disabled", "message": "L’accès d’urgence n’est pas activé."}, status=status.HTTP_404_NOT_FOUND)


def _professional(request):
    return getattr(request.user, "professional_profile", None)


class ProfessionalEmergencyAccessListCreateView(APIView):
    """GET : mes accès d'urgence. POST : en ouvrir un (identité du patient + motif)."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "break_glass_open"

    def get(self, request):
        if not service.feature_enabled():
            return _disabled()
        professional = _professional(request)
        if not professional:
            return Response({"success": False, "code": "not_eligible", "message": "Le profil professionnel n’est pas disponible."}, status=403)
        return Response({"success": True, "data": {
            "enabled": True,
            "duration_minutes": int(service.access_duration().total_seconds() // 60),
            "reasons": [{"code": code, "label": label} for code, label in service.REASON_LABELS.items()],
            "items": service.list_for_professional(professional),
        }})

    @transaction.atomic
    def post(self, request):
        if not service.feature_enabled():
            return _disabled()
        professional = _professional(request)
        if not professional:
            return Response({"success": False, "code": "not_eligible", "message": "Le profil professionnel n’est pas disponible."}, status=403)
        data = request.data
        try:
            item, created = service.open_emergency_access(
                professional=professional,
                first_name=data.get("first_name"),
                last_name=data.get("last_name"),
                birth_date=data.get("birth_date"),
                phone=data.get("phone") or "",
                reason_category=data.get("reason_category"),
                reason_note=data.get("reason_note"),
            )
            # Rejouée pendant que la fenêtre est ouverte, la demande retrouve le même accès : on relit la fiche (et on le trace).
            summary = service.emergency_summary(item.patient) if created else service.read_emergency_access(professional=professional, request_id=item.id)[1]
        except service.BreakGlassError as exc:
            # Le refus est déjà tracé par le service ; on répond sans lever, pour que la trace ne soit pas annulée.
            return _error(exc)
        return Response(
            {"success": True, "data": {"access": service.serialize_for_professional(item), "summary": summary}},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ProfessionalEmergencyAccessDetailView(APIView):
    """Relire la fiche d'urgence tant que la fenêtre est ouverte. Une fois l'heure passée : 403, sans retour."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if not service.feature_enabled():
            return _disabled()
        professional = _professional(request)
        if not professional:
            return Response({"success": False, "code": "not_eligible", "message": "Le profil professionnel n’est pas disponible."}, status=403)
        try:
            item, summary = service.read_emergency_access(professional=professional, request_id=pk)
        except service.BreakGlassError as exc:
            return _error(exc)
        return Response({"success": True, "data": {"access": service.serialize_for_professional(item), "summary": summary}})


class EstablishmentEmergencyAccessListView(APIView):
    """Les accès d'urgence de MON établissement, avec l'état de leur revue. Réservé à ses administrateurs actifs."""
    permission_classes = [IsAuthenticated]

    def get(self, request, establishment_id):
        if not service.feature_enabled():
            return _disabled()
        assignment = service.administrator_assignment(request.user, establishment_id)
        if not assignment:
            return Response({"success": False, "code": "forbidden", "message": "Réservé aux administrateurs de cet établissement."}, status=403)
        return Response({"success": True, "data": {"enabled": True, "items": service.list_for_administrator(request.user, assignment.establishment)}})


class EstablishmentEmergencyAccessReviewView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "break_glass_review"

    @transaction.atomic
    def post(self, request, establishment_id, pk):
        if not service.feature_enabled():
            return _disabled()
        assignment = service.administrator_assignment(request.user, establishment_id)
        if not assignment:
            return Response({"success": False, "code": "forbidden", "message": "Réservé aux administrateurs de cet établissement."}, status=403)
        try:
            review = service.review_emergency_access(
                administrator=request.user,
                establishment=assignment.establishment,
                request_id=pk,
                outcome=request.data.get("outcome"),
                note=request.data.get("note") or "",
            )
        except service.BreakGlassError as exc:
            return _error(exc)
        return Response({"success": True, "data": {"id": str(review.emergency_access_id), "outcome": review.outcome, "outcome_label": service.OUTCOME_LABELS[review.outcome], "reviewed_at": review.reviewed_at.isoformat()}}, status=status.HTTP_201_CREATED)

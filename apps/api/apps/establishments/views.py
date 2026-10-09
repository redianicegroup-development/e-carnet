import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAdminUser, IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from apps.identity.throttles import IpScopedThrottle

from apps.audit.services import record_event
from apps.identity.models import AccountContext
from .email_service import send_establishment_invitation
from .models import Establishment, EstablishmentAdminInvitation, EstablishmentAdministrator, EstablishmentJoinCode, EstablishmentMembership
from .serializers import EstablishmentSerializer, MembershipSerializer

User = get_user_model()
MEMBERSHIP_AGREEMENT_VERSION = "2026-10-08-v1"


def payload(establishment):
    return EstablishmentSerializer(establishment).data


def active_administrator(user, establishment_id=None):
    query = EstablishmentAdministrator.objects.filter(user=user, status="active", establishment__status="active")
    if establishment_id:
        query = query.filter(establishment_id=establishment_id)
    return query.select_related("establishment").first()


def make_invitation(*, establishment, created_by, email, first_name, last_name):
    # Un seul lien actif par adresse et structure; l'ancien reste historisé mais inutilisable.
    EstablishmentAdminInvitation.objects.filter(
        establishment=establishment, email__iexact=email, consumed_at__isnull=True, revoked_at__isnull=True
    ).update(revoked_at=timezone.now())
    raw_token = secrets.token_urlsafe(32)
    invitation = EstablishmentAdminInvitation.objects.create(
        establishment=establishment,
        email=email.lower().strip(),
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        token_hash=EstablishmentAdminInvitation.digest(raw_token),
        expires_at=timezone.now() + timedelta(hours=48),
        created_by=created_by,
    )
    transaction.on_commit(lambda: send_establishment_invitation(
        email=invitation.email,
        first_name=invitation.first_name,
        establishment_name=establishment.name,
        raw_token=raw_token,
        expires_at=invitation.expires_at,
    ))
    record_event(
        event_type="establishment.invitation.created",
        actor=created_by,
        actor_role="ecarnet_staff",
        establishment=establishment,
        metadata={"action": "created", "status": "pending", "invitation_id": str(invitation.id)},
    )
    return invitation


def invitation_response_data(invitation, establishment=None):
    data = {"invitation_id": str(invitation.id), "expires_at": invitation.expires_at}
    if establishment is not None:
        data["establishment"] = payload(establishment)
    return data


class EstablishmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        admin_ids = EstablishmentAdministrator.objects.filter(user=request.user, status="active").values("establishment_id")
        establishments = Establishment.objects.filter(id__in=admin_ids) | Establishment.objects.filter(
            memberships__professional__user=request.user
        )
        return Response({"success": True, "data": EstablishmentSerializer(establishments.distinct(), many=True).data})


class EstablishmentCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = Establishment.objects.filter(status="active").order_by("name").values("id", "name", "city")
        return Response({"success": True, "data": [{"id": str(item["id"]), "name": item["name"], "city": item["city"]} for item in items]})


class EstablishmentCreateView(APIView):
    """Ancienne route publique neutralisée: une structure est créée par le staff."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response(
            {"success": False, "message": "La création d’un établissement est réservée à l’équipe E‑Carnet."},
            status=status.HTTP_403_FORBIDDEN,
        )


class StaffEstablishmentCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    @transaction.atomic
    def post(self, request):
        required = ("name", "establishment_type", "city", "address", "phone", "email", "responsible_name", "responsible_email", "responsible_first_name", "responsible_last_name")
        missing = [field for field in required if not str(request.data.get(field, "")).strip()]
        if missing:
            return Response({"success": False, "message": f"Champs requis : {', '.join(missing)}."}, status=400)
        serializer = EstablishmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        establishment = serializer.save(status="active", activated_at=timezone.now())
        invitation = make_invitation(
            establishment=establishment,
            created_by=request.user,
            email=request.data["responsible_email"],
            first_name=request.data["responsible_first_name"],
            last_name=request.data["responsible_last_name"],
        )
        record_event(event_type="establishment.verified", actor=request.user, actor_role="ecarnet_staff", establishment=establishment, metadata={"action": "verified", "status": "active"})
        return Response({"success": True, "data": invitation_response_data(invitation, establishment)}, status=201)


class StartupEstablishmentQueueView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        items = Establishment.objects.filter(status="pending")
        return Response({"success": True, "data": EstablishmentSerializer(items, many=True).data})

    @transaction.atomic
    def post(self, request, establishment_id):
        establishment = Establishment.objects.select_for_update().filter(id=establishment_id, status="pending").first()
        decision = request.data.get("decision")
        if not establishment or decision not in ("approve", "reject"):
            return Response({"success": False, "message": "Décision de vérification invalide."}, status=400)
        if decision == "reject":
            establishment.status = "rejected"
            establishment.save(update_fields=("status", "updated_at"))
            record_event(event_type="establishment.rejected", actor=request.user, actor_role="ecarnet_staff", establishment=establishment, metadata={"action": "rejected", "status": "rejected"})
            return Response({"success": True, "data": payload(establishment)})
        establishment.status = "active"
        establishment.activated_at = timezone.now()
        establishment.save(update_fields=("status", "activated_at", "updated_at"))
        invitation = make_invitation(establishment=establishment, created_by=request.user, email=establishment.email, first_name=establishment.responsible_name, last_name="")
        record_event(event_type="establishment.approved", actor=request.user, actor_role="ecarnet_staff", establishment=establishment, metadata={"action": "approved", "status": "active"})
        return Response({"success": True, "data": invitation_response_data(invitation, establishment)})


class StaffAdministratorInvitationView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    @transaction.atomic
    def post(self, request, establishment_id):
        establishment = Establishment.objects.filter(id=establishment_id, status="active").first()
        if not establishment:
            return Response({"success": False, "message": "Établissement actif introuvable."}, status=404)
        invitation = make_invitation(
            establishment=establishment,
            created_by=request.user,
            email=request.data.get("email", ""),
            first_name=request.data.get("first_name", ""),
            last_name=request.data.get("last_name", ""),
        ) if all(str(request.data.get(key, "")).strip() for key in ("email", "first_name", "last_name")) else None
        if not invitation:
            return Response({"success": False, "message": "Email, prénom et nom sont requis."}, status=400)
        return Response({"success": True, "data": invitation_response_data(invitation)})


class EstablishmentInvitationAcceptView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [IpScopedThrottle]
    throttle_scope = "code_redeem"

    @transaction.atomic
    def post(self, request):
        raw_token = str(request.data.get("token", ""))
        password = str(request.data.get("password", ""))
        if not raw_token or not password:
            return Response({"success": False, "message": "Le lien et le mot de passe sont requis."}, status=400)
        invitation = EstablishmentAdminInvitation.objects.select_for_update().select_related("establishment").filter(token_hash=EstablishmentAdminInvitation.digest(raw_token)).first()
        if not invitation or not invitation.is_usable:
            return Response({"success": False, "message": "Cette invitation est invalide, expirée ou déjà utilisée."}, status=400)
        try:
            validate_password(password)
        except DjangoValidationError as exc:
            return Response({"success": False, "message": " ".join(exc.messages)}, status=400)
        user, created = User.objects.get_or_create(
            email=invitation.email,
            defaults={"username": invitation.email, "first_name": invitation.first_name, "last_name": invitation.last_name},
        )
        if not created and User.objects.exclude(pk=user.pk).filter(email__iexact=invitation.email).exists():
            return Response({"success": False, "message": "Impossible d’activer cette invitation."}, status=409)
        user.first_name, user.last_name = invitation.first_name, invitation.last_name
        user.set_password(password)
        user.save(update_fields=("first_name", "last_name", "password"))
        EstablishmentAdministrator.objects.filter(establishment=invitation.establishment, status="active").update(status="ended", ended_at=timezone.now())
        EstablishmentAdministrator.objects.create(establishment=invitation.establishment, user=user, assigned_by=invitation.created_by, status="active")
        context, _ = AccountContext.objects.get_or_create(user=user, role="establishment")
        context.is_active = True
        context.onboarding_completed = True
        context.save(update_fields=("is_active", "onboarding_completed", "updated_at"))
        invitation.consumed_at = timezone.now()
        invitation.consumed_by = user
        invitation.save(update_fields=("consumed_at", "consumed_by"))
        record_event(event_type="establishment.invitation.consumed", actor=user, actor_role="establishment_administrator", establishment=invitation.establishment, metadata={"action": "consumed", "status": "active", "invitation_id": str(invitation.id)})
        return Response({"success": True, "data": {"establishment_id": str(invitation.establishment_id), "email": user.email}})


class EstablishmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, establishment_id):
        if active_administrator(request.user, establishment_id) or Establishment.objects.filter(id=establishment_id, memberships__professional__user=request.user).exists():
            establishment = Establishment.objects.get(id=establishment_id)
            return Response({"success": True, "data": payload(establishment)})
        return Response({"success": False, "message": "Établissement indisponible dans votre contexte."}, status=404)


class EstablishmentJoinCodeCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, establishment_id):
        admin = active_administrator(request.user, establishment_id)
        if not admin:
            return Response({"success": False, "message": "Vous n’êtes pas administrateur de cet établissement actif."}, status=403)
        raw_code = f"ECM-{secrets.token_urlsafe(9).upper()}"
        join_code = EstablishmentJoinCode.objects.create(
            establishment=admin.establishment,
            code_hash=EstablishmentJoinCode.digest(raw_code),
            expires_at=timezone.now() + timedelta(hours=48),
            created_by=request.user,
        )
        record_event(event_type="establishment.join_code.created", actor=request.user, actor_role="establishment_administrator", establishment=admin.establishment, metadata={"action": "created", "status": "active", "join_code_id": str(join_code.id)})
        return Response({"success": True, "data": {"code": raw_code, "expires_at": join_code.expires_at, "join_code_id": str(join_code.id)}}, status=201)


class EstablishmentMembershipListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, establishment_id):
        admin = active_administrator(request.user, establishment_id)
        if not admin:
            return Response({"success": False, "message": "Vous n’êtes pas administrateur de cet établissement actif."}, status=403)
        items = EstablishmentMembership.objects.filter(establishment=admin.establishment).select_related("professional__user")
        data = MembershipSerializer(items, many=True).data
        for item, membership in zip(data, items):
            item["professional_name"] = f"{membership.professional.user.first_name} {membership.professional.user.last_name}".strip() or membership.professional.professional_title
            item["professional_email"] = membership.professional.user.email
        return Response({"success": True, "data": data})


class EstablishmentJoinCodeRedeemView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "code_redeem"

    @transaction.atomic
    def post(self, request):
        profile = getattr(request.user, "professional_profile", None)
        raw_code = str(request.data.get("code", "")).strip()
        if not profile or not raw_code:
            return Response({"success": False, "message": "Compte professionnel et code médecin requis."}, status=400)
        if request.data.get("agreement_accepted") is not True or request.data.get("agreement_version") != MEMBERSHIP_AGREEMENT_VERSION:
            return Response({"success": False, "message": "Veuillez accepter les conditions de rattachement à jour avant de valider le code."}, status=400)
        join_code = EstablishmentJoinCode.objects.select_for_update().select_related("establishment").filter(code_hash=EstablishmentJoinCode.digest(raw_code)).first()
        if not join_code or not join_code.is_usable or join_code.establishment.status != "active":
            return Response({"success": False, "message": "Ce code est invalide, expiré, révoqué ou déjà utilisé."}, status=400)
        membership, created = EstablishmentMembership.objects.get_or_create(establishment=join_code.establishment, professional=profile)
        if not created and membership.status in ("pending", "active"):
            return Response({"success": False, "message": "Une demande existe déjà pour ce médecin et cet établissement."}, status=409)
        membership.status = "pending"
        membership.requested_at = timezone.now()
        membership.reviewed_at = None
        membership.left_at = None
        membership.agreement_version = MEMBERSHIP_AGREEMENT_VERSION
        membership.agreement_accepted_at = timezone.now()
        membership.agreement_accepted_by = request.user
        membership.save(update_fields=("status", "requested_at", "reviewed_at", "left_at", "agreement_version", "agreement_accepted_at", "agreement_accepted_by"))
        join_code.consumed_at = timezone.now()
        join_code.save(update_fields=("consumed_at",))
        record_event(event_type="establishment.join_code.consumed", actor=request.user, actor_role="professional", establishment=join_code.establishment, metadata={"action": "consumed", "status": "pending", "join_code_id": str(join_code.id), "membership_id": str(membership.id)})
        record_event(event_type="membership.requested", actor=request.user, actor_role="professional", establishment=join_code.establishment, metadata={"action": "requested", "status": "pending", "membership_id": str(membership.id), "agreement_version": membership.agreement_version, "agreement_accepted_at": membership.agreement_accepted_at.isoformat()})
        return Response({"success": True, "data": MembershipSerializer(membership).data}, status=201 if created else 200)


class MembershipRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, establishment_id):
        return Response({"success": False, "message": "Cette route utilise un ancien code permanent. Saisissez le code médecin temporaire dans /join-codes/redeem/."}, status=410)


class MembershipDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, establishment_id, membership_id):
        admin = active_administrator(request.user, establishment_id)
        establishment = admin.establishment if admin else None
        membership = EstablishmentMembership.objects.filter(id=membership_id, establishment=establishment).first()
        decision = request.data.get("decision")
        if not establishment or not membership or decision not in ("approve", "refuse"):
            return Response({"success": False, "message": "Décision de rattachement invalide."}, status=400)
        if decision == "approve" and (not membership.agreement_accepted_at or not membership.agreement_version):
            return Response({"success": False, "message": "Aucune acceptation des conditions de rattachement enregistrée."}, status=409)
        membership.status = "active" if decision == "approve" else "refused"
        membership.reviewed_at = timezone.now()
        membership.save(update_fields=("status", "reviewed_at"))
        record_event(event_type=f"membership.{decision}", actor=request.user, actor_role="establishment_administrator", establishment=establishment, metadata={"action": decision, "status": membership.status, "membership_id": str(membership.id)})
        return Response({"success": True, "data": MembershipSerializer(membership).data})


class MembershipLeaveView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, establishment_id):
        profile = getattr(request.user, "professional_profile", None)
        membership = EstablishmentMembership.objects.filter(establishment_id=establishment_id, professional=profile, status="active").select_related("establishment").first() if profile else None
        if not membership:
            return Response({"success": False, "message": "Aucun rattachement actif à quitter."}, status=404)
        membership.status = "terminated"
        membership.left_at = timezone.now()
        membership.reviewed_at = membership.left_at
        membership.save(update_fields=("status", "left_at", "reviewed_at"))
        if profile.active_establishment_id == membership.establishment_id:
            profile.active_establishment = None
            profile.save(update_fields=("active_establishment", "updated_at"))
        record_event(event_type="membership.terminated_by_professional", actor=request.user, actor_role="professional", establishment=membership.establishment, metadata={"action": "terminated", "membership_id": str(membership.id), "reason": "professional_initiated"})
        return Response({"success": True, "data": MembershipSerializer(membership).data})


class MembershipTerminateByEstablishmentView(APIView):
    permission_classes = [IsAuthenticated]
    @transaction.atomic
    def post(self, request, establishment_id, membership_id):
        admin = active_administrator(request.user, establishment_id)
        membership = EstablishmentMembership.objects.select_for_update().filter(
            id=membership_id, establishment_id=establishment_id, status="active"
        ).select_related("professional__user").first() if admin else None
        if not membership:
            return Response({"success": False, "message": "Rattachement actif introuvable ou action non autorisée."}, status=404)
        membership.status = "terminated"
        membership.left_at = timezone.now()
        membership.reviewed_at = timezone.now()
        membership.save(update_fields=("status", "left_at", "reviewed_at"))
        profile = membership.professional
        if profile.active_establishment_id == membership.establishment_id:
            profile.active_establishment = None
            profile.save(update_fields=("active_establishment", "updated_at"))
        record_event(event_type="membership.terminated_by_establishment", actor=request.user, actor_role="establishment_administrator", establishment=membership.establishment, metadata={"action": "terminated", "membership_id": str(membership.id), "reason": "establishment_initiated"})
        return Response({"success": True, "data": MembershipSerializer(membership).data})


class SetActiveEstablishmentView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        profile = getattr(request.user, "professional_profile", None)
        membership = EstablishmentMembership.objects.filter(professional=profile, establishment_id=request.data.get("establishment_id"), status="active", establishment__status="active").select_related("establishment").first() if profile else None
        if not membership:
            return Response({"success": False, "message": "Vous n’êtes pas rattaché à cet établissement actif."}, status=403)
        profile.active_establishment = membership.establishment
        profile.save(update_fields=("active_establishment", "updated_at"))
        record_event(event_type="establishment.selected", actor=request.user, actor_role="professional", establishment=membership.establishment, metadata={"action": "selected", "status": membership.status})
        return Response({"success": True, "data": {"active_establishment": str(membership.establishment_id)}})

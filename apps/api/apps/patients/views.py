import hashlib
import hmac
import uuid
from datetime import date
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.audit.services import record_event
from apps.identity.throttles import IpScopedThrottle, WriteScopedThrottle
from .models import ClinicalDeclaration, PatientEmergencyCard, PatientProfile, PatientRepresentation, RepresentationTransferRequest
from .serializers import ClinicalDeclarationSerializer, PatientEmergencyCardSerializer, PatientProfileSerializer


def profile_for(user, request=None):
    selected_id = request.session.get("active_patient_profile_id") if request is not None else None
    if selected_id:
        representation = PatientRepresentation.objects.select_related("patient").filter(
            guardian=user,
            patient_id=selected_id,
            status="active",
            patient__user__isnull=True,
        ).first()
        if not representation:
            raise PermissionDenied("Le lien de représentation n’est plus actif. Sélectionnez un dossier autorisé.")
        if request is not None and not getattr(request, "_represented_profile_audited", False):
            record_event(
                event_type="patient.represented_profile.accessed",
                actor=user,
                actor_role="guardian",
                patient=representation.patient,
                metadata={"action": "accessed", "resource_type": "represented_patient"},
            )
            request._represented_profile_audited = True
        return representation.patient
    profile, _ = PatientProfile.objects.get_or_create(user=user)
    return profile


def age_on(birth_date, today=None):
    today = today or timezone.localdate()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


def require_patient_context(user):
    if not user.account_contexts.filter(role="patient", is_active=True).exists():
        raise PermissionDenied("Cette action est réservée à un compte dans l’espace Patient.")


def patient_actor_role(request):
    return "guardian" if request.session.get("active_patient_profile_id") else "patient"


def relationship_payload(representation, active_id=None):
    patient = representation.patient
    latest_transfer = representation.transfer_requests.order_by("-created_at").first()
    return {
        "id": str(representation.id),
        "patient_id": str(patient.id),
        "first_name": patient.display_first_name(),
        "last_name": patient.display_last_name(),
        "birth_date": patient.birth_date.isoformat() if patient.birth_date else None,
        "relationship": representation.relationship,
        "status": representation.status,
        "transfer_status": latest_transfer.status if latest_transfer else None,
        "is_active": str(patient.id) == str(active_id),
        "created_at": representation.created_at.isoformat(),
    }


class PatientRepresentationListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "representation_changes"

    def get(self, request):
        require_patient_context(request.user)
        items = PatientRepresentation.objects.filter(
            guardian=request.user,
            status__in=("active", "revoked"),
            patient__user__isnull=True,
        ).select_related("patient").prefetch_related("transfer_requests")
        return Response({
            "success": True,
            "data": [relationship_payload(item, request.session.get("active_patient_profile_id")) for item in items],
        })

    @transaction.atomic
    def post(self, request):
        require_patient_context(request.user)
        first_name = str(request.data.get("first_name", "")).strip()
        last_name = str(request.data.get("last_name", "")).strip()
        birth_date_raw = request.data.get("birth_date")
        relationship = request.data.get("relationship")
        if not first_name or len(first_name) > 80 or not last_name or len(last_name) > 80:
            return Response({"success": False, "message": "Saisissez le prénom et le nom (80 caractères maximum)."}, status=400)
        if relationship not in dict(PatientRepresentation.RELATION_CHOICES):
            return Response({"success": False, "message": "Choisissez le lien avec la personne représentée."}, status=400)
        try:
            birth_date = date.fromisoformat(birth_date_raw) if birth_date_raw else None
        except (TypeError, ValueError):
            birth_date = None
        if not birth_date or birth_date > timezone.localdate():
            return Response({"success": False, "message": "Saisissez une date de naissance valide."}, status=400)
        legal_age = getattr(settings, "ECARNET_REPRESENTATION_LEGAL_AGE", None)
        if legal_age is None:
            return Response({"success": False, "message": "Le seuil d’âge légal doit être configuré après validation juridique avant de créer des profils représentés."}, status=503)
        if age_on(birth_date) >= legal_age:
            return Response({"success": False, "message": "Un adulte doit autoriser lui-même une délégation. Cette action ne crée que des profils de personnes mineures."}, status=403)
        if relationship != "child":
            return Response({"success": False, "message": "La délégation à un adulte exige son autorisation explicite; elle n’est pas activée dans cette version."}, status=403)
        if request.data.get("legal_representative_confirmed") is not True:
            return Response({"success": False, "message": "Confirmez être autorisé à représenter légalement cet enfant."}, status=400)
        patient = PatientProfile.objects.create(
            user=None,
            first_name=first_name,
            last_name=last_name,
            birth_date=birth_date,
        )
        representation = PatientRepresentation.objects.create(
            guardian=request.user,
            patient=patient,
            relationship=relationship,
        )
        record_event(
            event_type="patient.representation.created",
            actor=request.user,
            actor_role="guardian",
            patient=patient,
            metadata={"action": "created", "resource_type": "represented_patient", "resource_id": str(patient.id)},
        )
        return Response({"success": True, "data": relationship_payload(representation)}, status=status.HTTP_201_CREATED)


class PatientRepresentationActiveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        require_patient_context(request.user)
        patient_id = serializers.UUIDField().run_validation(request.data.get("patient_id"))
        representation = PatientRepresentation.objects.select_related("patient").filter(
            guardian=request.user,
            patient_id=patient_id,
            status="active",
            patient__user__isnull=True,
        ).first()
        if not representation:
            return Response({"success": False, "message": "Ce profil n’est pas accessible depuis votre compte."}, status=404)
        request.session["active_patient_profile_id"] = str(representation.patient_id)
        record_event(
            event_type="patient.representation.selected",
            actor=request.user,
            actor_role="guardian",
            patient=representation.patient,
            metadata={"action": "selected", "resource_type": "represented_patient"},
        )
        return Response({"success": True, "data": relationship_payload(representation, representation.patient_id)})

    def delete(self, request):
        require_patient_context(request.user)
        previous_id = request.session.pop("active_patient_profile_id", None)
        if previous_id:
            representation = PatientRepresentation.objects.filter(
                guardian=request.user,
                patient_id=previous_id,
                status="active",
            ).select_related("patient").first()
            if representation:
                record_event(
                    event_type="patient.representation.selection_cleared",
                    actor=request.user,
                    actor_role="guardian",
                    patient=representation.patient,
                    metadata={"action": "selection_cleared", "resource_type": "represented_patient"},
                )
        return Response({"success": True, "data": None})


class PatientRepresentationDetailView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "representation_changes"

    @transaction.atomic
    def delete(self, request, pk):
        require_patient_context(request.user)
        representation = PatientRepresentation.objects.select_for_update().filter(
            pk=pk,
            guardian=request.user,
            status="active",
        ).select_related("patient").first()
        if not representation:
            return Response({"success": False, "message": "Ce lien de représentation n’est pas actif."}, status=404)
        representation.status = "revoked"
        representation.save(update_fields=("status", "updated_at"))
        if request.session.get("active_patient_profile_id") == str(representation.patient_id):
            request.session.pop("active_patient_profile_id", None)
        record_event(
            event_type="patient.representation.revoked",
            actor=request.user,
            actor_role="guardian",
            patient=representation.patient,
            metadata={"action": "revoked", "resource_type": "represented_patient"},
        )
        return Response({"success": True, "data": None})

    @transaction.atomic
    def patch(self, request, pk):
        require_patient_context(request.user)
        representation = PatientRepresentation.objects.select_for_update().filter(
            pk=pk,
            guardian=request.user,
            status="revoked",
            patient__user__isnull=True,
        ).select_related("patient").first()
        if not representation:
            return Response({"success": False, "message": "Ce lien ne peut pas être réactivé."}, status=404)
        if PatientRepresentation.objects.filter(patient=representation.patient, status="active").exists():
            return Response({"success": False, "message": "Un autre représentant a déjà un lien actif pour ce dossier."}, status=409)
        representation.status = "active"
        representation.save(update_fields=("status", "updated_at"))
        record_event(
            event_type="patient.representation.reactivated",
            actor=request.user,
            actor_role="guardian",
            patient=representation.patient,
            metadata={"action": "reactivated", "resource_type": "represented_patient"},
        )
        return Response({"success": True, "data": relationship_payload(representation)})


class RepresentationTransferRequestView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [WriteScopedThrottle]
    throttle_scope = "representation_transfer"

    @transaction.atomic
    def post(self, request):
        require_patient_context(request.user)
        patient_id = serializers.UUIDField().run_validation(request.data.get("patient_id"))
        representation = PatientRepresentation.objects.select_for_update().filter(
            patient_id=patient_id,
            status="active",
            patient__user__isnull=True,
            relationship="child",
        ).exclude(guardian=request.user).select_related("patient").first()
        if not representation:
            return Response({"success": False, "message": "Aucun profil représenté correspondant n’est disponible."}, status=404)
        if not representation.patient.birth_date:
            return Response({"success": False, "message": "La date de naissance du profil doit être renseignée avant toute demande."}, status=409)
        if not (request.user.has_usable_password() or request.user.auth_identities.exists()):
            return Response({"success": False, "message": "Configurez d’abord une méthode de connexion sur votre compte."}, status=409)
        if PatientProfile.objects.filter(user=request.user).exists():
            return Response({"success": False, "message": "Ce compte possède déjà un dossier patient. Contactez l’assistance pour éviter toute fusion de dossiers."}, status=409)
        legal_age = getattr(settings, "ECARNET_REPRESENTATION_LEGAL_AGE", None)
        if legal_age is None:
            return Response({"success": False, "message": "Le seuil d’âge légal doit être configuré après validation juridique avant d’ouvrir les demandes."}, status=503)
        if age_on(representation.patient.birth_date) < legal_age:
            return Response({"success": False, "message": "Le seuil d’âge légal configuré n’est pas encore atteint."}, status=403)
        if RepresentationTransferRequest.objects.filter(representation=representation, status="pending").exists():
            return Response({"success": False, "message": "Une demande de transfert est déjà en cours."}, status=409)
        transfer = RepresentationTransferRequest.objects.create(
            representation=representation,
            applicant=request.user,
        )
        record_event(
            event_type="patient.representation.transfer_requested",
            actor=request.user,
            actor_role=patient_actor_role(request),
            patient=representation.patient,
            metadata={"action": "transfer_requested", "resource_type": "represented_patient"},
        )
        return Response({
            "success": True,
            "data": {"id": str(transfer.id), "status": transfer.status},
        }, status=status.HTTP_201_CREATED)


class RepresentationTransferReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_superuser:
            raise PermissionDenied("Accès réservé aux administrateurs autorisés.")
        transfers = RepresentationTransferRequest.objects.filter(status="pending").select_related(
            "applicant",
            "representation__patient",
        )
        record_event(
            event_type="patient.representation.transfer_queue_viewed",
            actor=request.user,
            actor_role="admin",
            metadata={"action": "transfer_queue_viewed"},
        )
        return Response({
            "success": True,
            "data": [{
                "id": str(transfer.id),
                "applicant": {
                    "first_name": transfer.applicant.first_name,
                    "last_name": transfer.applicant.last_name,
                    "email": transfer.applicant.email,
                },
                "patient": {
                    "first_name": transfer.representation.patient.display_first_name(),
                    "last_name": transfer.representation.patient.display_last_name(),
                    "birth_date": transfer.representation.patient.birth_date.isoformat() if transfer.representation.patient.birth_date else None,
                },
                "created_at": transfer.created_at.isoformat(),
            } for transfer in transfers],
        })

    def patch(self, request, pk):
        if not request.user.is_superuser:
            raise PermissionDenied("Accès réservé aux administrateurs autorisés.")
        decision = request.data.get("decision")
        if decision not in ("approve", "reject"):
            return Response({"success": False, "message": "Choisissez approve ou reject."}, status=400)
        if decision == "approve" and request.data.get("age_verified") is not True:
            return Response({"success": False, "message": "Une vérification manuelle de l’âge légal est obligatoire."}, status=400)
        if decision == "approve" and request.data.get("identity_verified") is not True:
            return Response({"success": False, "message": "Une vérification manuelle de l’identité du demandeur est obligatoire."}, status=400)
        with transaction.atomic():
            transfer = RepresentationTransferRequest.objects.select_for_update().select_related(
                "representation__patient",
            ).filter(pk=pk, status="pending").first()
            if not transfer:
                return Response({"success": False, "message": "Demande de transfert introuvable ou déjà traitée."}, status=404)
            representation = transfer.representation
            patient = representation.patient
            if decision == "approve":
                legal_age = getattr(settings, "ECARNET_REPRESENTATION_LEGAL_AGE", None)
                if legal_age is None or not patient.birth_date or age_on(patient.birth_date) < legal_age:
                    return Response({"success": False, "message": "Le seuil d’âge légal n’est pas configuré ou n’est pas atteint."}, status=409)
                if patient.user_id or PatientProfile.objects.filter(user=transfer.applicant).exists():
                    return Response({"success": False, "message": "Le transfert créerait un conflit de dossiers; aucune donnée n’a été modifiée."}, status=409)
                patient.user = transfer.applicant
                patient.save(update_fields=("user", "updated_at"))
                representation.status = "transferred"
                representation.save(update_fields=("status", "updated_at"))
                transfer.status = "approved"
            else:
                transfer.status = "rejected"
            transfer.reviewed_by = request.user
            transfer.reviewed_at = timezone.now()
            transfer.age_verified = decision == "approve"
            transfer.identity_verified = decision == "approve"
            transfer.save(update_fields=("status", "reviewed_by", "reviewed_at", "age_verified", "identity_verified"))
            record_event(
                event_type=f"patient.representation.transfer_{transfer.status}",
                actor=request.user,
                actor_role="admin",
                patient=patient,
                metadata={"action": f"transfer_{transfer.status}", "resource_type": "represented_patient"},
            )
        return Response({"success": True, "data": {"id": str(transfer.id), "status": transfer.status}})


class PatientProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"success": True, "data": PatientProfileSerializer(profile_for(request.user, request)).data})

    def patch(self, request):
        profile = profile_for(request.user, request)
        serializer = PatientProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"success": True, "data": serializer.data})


class DeclarationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = ClinicalDeclaration.objects.filter(patient=profile_for(request.user, request), status="declared")
        return Response({"success": True, "data": ClinicalDeclarationSerializer(items, many=True).data})

    @transaction.atomic
    def post(self, request):
        serializer = ClinicalDeclarationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        kind = serializer.validated_data["kind"]
        if kind in ClinicalDeclaration.SINGLETON_KINDS:
            # Groupe sanguin, ville, contact d’urgence : une seule valeur active, la nouvelle remplace l’ancienne.
            patient = profile_for(request.user, request)
            ClinicalDeclaration.objects.filter(patient=patient, kind=kind, status="declared").update(status="cancelled")
            previous = ClinicalDeclaration.objects.filter(patient=patient, kind=kind, label=serializer.validated_data["label"]).first()
            if previous:
                previous.details = serializer.validated_data.get("details", "")
                previous.status = "declared"
                previous.save(update_fields=("details", "status", "updated_at"))
                record_event(event_type="clinical_declaration.created", actor=request.user, actor_role=patient_actor_role(request), patient=patient, metadata={"action": "created", "declaration_id": str(previous.id), "status": previous.status})
                return Response({"success": True, "data": ClinicalDeclarationSerializer(previous).data}, status=status.HTTP_200_OK)
        try:
            item = ClinicalDeclaration.objects.create(patient=profile_for(request.user, request), **serializer.validated_data)
        except IntegrityError:
            return Response({"success": False, "message": "Cette déclaration existe déjà."}, status=status.HTTP_409_CONFLICT)
        record_event(event_type="clinical_declaration.created", actor=request.user, actor_role=patient_actor_role(request), patient=item.patient, metadata={"action": "created", "declaration_id": str(item.id), "status": item.status})
        return Response({"success": True, "data": ClinicalDeclarationSerializer(item).data}, status=status.HTTP_201_CREATED)


class DeclarationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def delete(self, request, pk):
        item = ClinicalDeclaration.objects.filter(pk=pk, patient=profile_for(request.user, request), status="declared").first()
        if not item:
            return Response({"success": False, "message": "Déclaration introuvable."}, status=status.HTTP_404_NOT_FOUND)
        item.status = "cancelled"
        item.save(update_fields=("status", "updated_at"))
        record_event(event_type="clinical_declaration.cancelled", actor=request.user, actor_role=patient_actor_role(request), patient=item.patient, metadata={"action": "cancelled", "declaration_id": str(item.id), "status": item.status})
        return Response({"success": True, "data": {"id": str(item.id), "status": item.status}})


def qr_signature(card_id, version):
    message = f"ecarnet-emergency-v1:{card_id}:{version}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()


def emergency_card_data(card, *, public=False):
    """Ce que la carte montre, lu en direct dans le carnet : aucune copie, donc aucune mise à jour à pousser."""
    declarations = ClinicalDeclaration.objects.filter(patient=card.patient, status="declared")
    latest = lambda kind: declarations.filter(kind=kind).order_by("-updated_at").first()
    blood, city, contact = latest("blood_group"), latest("city"), latest("emergency_contact")
    data = {
        # Carte d’urgence virtuelle : identité minimale (nom, prénom, ville) choisie par le titulaire, affichée telle quelle au scan.
        "first_name": card.patient.display_first_name(),
        "last_name": card.patient.display_last_name(),
        "city": city.label if city else "",
        "blood_group": blood.label if blood else "",
        "allergies": list(declarations.filter(kind="allergy").values("label", "details")),
        "treatments": list(declarations.filter(kind="treatment").values("label", "details")),
        "contact_name": contact.label if contact else "",
        "contact_phone": contact.details if contact else "",
        "updated_at": max(
            card.updated_at,
            card.patient.updated_at,
            declarations.order_by("-updated_at").values_list("updated_at", flat=True).first() or card.updated_at,
        ).isoformat(),
    }
    if not public:
        data.update({
            "qr_enabled": card.qr_enabled,
            # Unique et statique : la version ne change plus jamais, le jeton non plus.
            "qr_token": f"{card.id}.{card.qr_version}.{qr_signature(card.id, card.qr_version)}" if card.qr_enabled else "",
        })
    return data


class PatientEmergencyCardView(APIView):
    permission_classes = [IsAuthenticated]
    MOVED_TO_CARNET = ("city", "contact_name", "contact_phone", "offline_declaration_ids")

    def get(self, request):
        card, _ = PatientEmergencyCard.objects.get_or_create(patient=profile_for(request.user, request))
        return Response({"success": True, "data": emergency_card_data(card)})

    def patch(self, request):
        # Une ancienne version de l’application (PWA en cache) peut encore envoyer ces champs : mieux vaut refuser que les ignorer en silence.
        if any(key in request.data for key in self.MOVED_TO_CARNET):
            return Response({"success": False, "message": "La ville et le contact d’urgence se modifient maintenant dans votre carnet. Actualisez l’application."}, status=400)
        card, _ = PatientEmergencyCard.objects.get_or_create(patient=profile_for(request.user, request))
        serializer = PatientEmergencyCardSerializer(card, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_event(
            event_type="patient.emergency_card.updated",
            actor=request.user,
            actor_role=patient_actor_role(request),
            patient=card.patient,
            metadata={"action": "updated", "scope": sorted(serializer.validated_data.keys()), "resource_type": "emergency_card", "resource_id": str(card.id)},
        )
        return Response({"success": True, "data": emergency_card_data(card)})


class EmergencyCardQrView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [IpScopedThrottle]
    throttle_scope = "emergency_card_public"

    def get(self, request, token):
        try:
            raw_id, raw_version, signature = token.split(".", 2)
            card_id = uuid.UUID(raw_id)
            version = int(raw_version)
        except (ValueError, AttributeError, TypeError):
            return Response({"success": False, "message": "Cette carte d’urgence n’est pas disponible."}, status=status.HTTP_404_NOT_FOUND)
        card = PatientEmergencyCard.objects.select_related("patient").filter(pk=card_id, qr_enabled=True, qr_version=version).first()
        if not card or not hmac.compare_digest(signature, qr_signature(card.id, version)):
            return Response({"success": False, "message": "Cette carte d’urgence n’est pas disponible."}, status=status.HTTP_404_NOT_FOUND)
        response = Response({"success": True, "data": emergency_card_data(card, public=True)})
        response["Cache-Control"] = "private, no-store, max-age=0"
        response["X-Robots-Tag"] = "noindex, nofollow, noarchive"
        response["Referrer-Policy"] = "no-referrer"
        return response

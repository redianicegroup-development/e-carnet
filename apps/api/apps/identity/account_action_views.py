from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .admin_views import IsSuperuserOnly
from .models import AccountActionRequest


SUSPENSION_DAYS = {1, 7, 14, 30, 60, 90}
OPEN_STATUSES = ("new", "in_review")


class AccountActionRequestInputSerializer(serializers.Serializer):
    request_type = serializers.ChoiceField(choices=("suspension", "deletion"))
    suspension_days = serializers.IntegerField(required=False, min_value=1, max_value=90)
    reason = serializers.ChoiceField(choices=AccountActionRequest.REASONS, required=False, allow_blank=True)
    details = serializers.CharField(required=False, allow_blank=True, max_length=1200, trim_whitespace=True)

    def validate(self, attrs):
        request_type = attrs["request_type"]
        if request_type == "suspension":
            days = attrs.get("suspension_days")
            if days not in SUSPENSION_DAYS:
                raise serializers.ValidationError({"suspension_days": "Choisissez une durée proposée."})
            attrs["reason"] = ""
            attrs["details"] = ""
        else:
            if "suspension_days" in attrs:
                raise serializers.ValidationError({"suspension_days": "La durée concerne uniquement une suspension."})
            if not attrs.get("reason"):
                raise serializers.ValidationError({"reason": "Choisissez un motif."})
            if attrs["reason"] == "other" and not attrs.get("details", "").strip():
                raise serializers.ValidationError({"details": "Précisez votre autre motif."})
            if attrs["reason"] != "other":
                attrs["details"] = ""
        return attrs


def request_payload(item):
    return {
        "id": str(item.id),
        "request_type": item.request_type,
        "suspension_days": item.suspension_days,
        "reason": item.reason,
        "details": item.details,
        "status": item.status,
        "submitted_at": item.submitted_at.isoformat(),
        "reviewed_at": item.reviewed_at.isoformat() if item.reviewed_at else None,
    }


def admin_request_payload(item):
    return {
        **request_payload(item),
        "user_email": item.user.email,
        "user_first_name": item.user.first_name,
        "user_last_name": item.user.last_name,
        "reviewed_by_email": item.reviewed_by.email if item.reviewed_by else None,
    }


class CurrentAccountActionRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        requests = AccountActionRequest.objects.filter(user=request.user)
        return Response({"success": True, "data": [request_payload(item) for item in requests]})

    @transaction.atomic
    def post(self, request):
        serializer = AccountActionRequestInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        # Lock the owning account to prevent concurrent duplicate open requests from separate tabs.
        user = get_user_model().objects.select_for_update().get(pk=request.user.pk)
        if AccountActionRequest.objects.filter(user=user, request_type=values["request_type"], status__in=OPEN_STATUSES).exists():
            return Response({"success": False, "message": "Une demande de ce type est déjà en attente de traitement."}, status=409)
        item = AccountActionRequest.objects.create(user=user, **values)
        return Response({"success": True, "data": request_payload(item)}, status=201)


class AdminAccountActionRequestsView(APIView):
    permission_classes = [IsSuperuserOnly]

    def get(self, request):
        items = AccountActionRequest.objects.select_related("user", "reviewed_by").order_by("-submitted_at")[:250]
        data = [admin_request_payload(item) for item in items]
        return Response({"success": True, "data": data})


class AdminAccountActionRequestStatusView(APIView):
    permission_classes = [IsSuperuserOnly]

    def patch(self, request, request_id):
        status_value = request.data.get("status")
        allowed = {choice[0] for choice in AccountActionRequest.STATUSES}
        if not isinstance(status_value, str) or status_value not in allowed:
            return Response({"success": False, "message": "Statut de demande invalide."}, status=400)
        item = get_object_or_404(AccountActionRequest, pk=request_id)
        item.status = status_value
        item.reviewed_by = request.user
        item.reviewed_at = timezone.now()
        item.save(update_fields=("status", "reviewed_by", "reviewed_at", "updated_at"))
        return Response({"success": True, "data": admin_request_payload(item)})

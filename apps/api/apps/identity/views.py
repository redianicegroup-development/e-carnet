from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import ThemePreference
from .serializers import ThemeSerializer
from .theme import DEFAULT_THEME


class CurrentAccountThemeView(APIView):
    """Lit ou modifie exclusivement le thème du compte porté par la session."""
    permission_classes = [AllowAny]

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"success": True, "data": DEFAULT_THEME, "account_id": None})
        preference, _ = ThemePreference.objects.get_or_create(user=request.user, defaults={"theme": DEFAULT_THEME})
        return Response({"success": True, "data": preference.theme, "account_id": str(request.user.pk)})

    def patch(self, request):
        serializer = ThemeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        preference, _ = ThemePreference.objects.get_or_create(user=request.user, defaults={"theme": DEFAULT_THEME})
        preference.theme = serializer.validated_data
        preference.save(update_fields=["theme", "updated_at"])
        return Response({"success": True, "data": preference.theme, "account_id": str(request.user.pk)})

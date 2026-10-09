from django.contrib import admin
from .models import AccountContext, ThemePreference


@admin.register(ThemePreference)
class ThemePreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "updated_at")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("updated_at",)


@admin.register(AccountContext)
class AccountContextAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "is_active", "onboarding_completed")
    list_filter = ("role", "is_active", "onboarding_completed")

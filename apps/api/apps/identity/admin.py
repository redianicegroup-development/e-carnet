from django.contrib import admin

from .models import AccountContext, AnonymousVisitor, ThemePreference


@admin.register(ThemePreference)
class ThemePreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "updated_at")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("updated_at",)


@admin.register(AccountContext)
class AccountContextAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "is_active", "onboarding_completed")
    list_filter = ("role", "is_active", "onboarding_completed")


@admin.register(AnonymousVisitor)
class AnonymousVisitorAdmin(admin.ModelAdmin):
    list_display = (
        "visitor_id", "first_seen", "last_seen", "page_view_count", "auth_page_view_count",
        "login_success_count", "login_failure_count", "registration_count", "oauth_success_count",
        "oauth_link_count", "last_page_category", "last_auth_event",
    )
    list_filter = ("last_page_category", "last_auth_event")
    date_hierarchy = "last_seen"
    ordering = ("-last_seen",)
    list_per_page = 100
    readonly_fields = tuple(field.name for field in AnonymousVisitor._meta.fields)
    fieldsets = (
        ("Visiteur anonyme", {"fields": ("visitor_id", "first_seen", "last_seen", "last_page_category", "page_view_count", "auth_page_view_count")}),
        ("Activité de connexion", {"fields": ("last_auth_event", "last_auth_event_at", "login_success_count", "login_failure_count", "registration_count", "oauth_success_count", "oauth_link_count")}),
    )
    actions = None

    def has_add_permission(self, request):
        return False

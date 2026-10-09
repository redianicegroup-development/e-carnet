from django.apps import AppConfig
from django.db.models.signals import post_migrate


def create_cache_table(sender, **kwargs):
    """Crée la table de cache utilisée par la limitation des tentatives quand le cache est en base."""
    from django.conf import settings
    from django.core.management import call_command

    default = settings.CACHES.get("default", {})
    if default.get("BACKEND", "").endswith("DatabaseCache") and default.get("LOCATION"):
        call_command("createcachetable", verbosity=0, database=kwargs.get("using", "default"))


class IdentityConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.identity"

    def ready(self):
        post_migrate.connect(create_cache_table, sender=self, dispatch_uid="ecarnet.create_cache_table")

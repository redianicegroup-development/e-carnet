import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction


class Command(BaseCommand):
    help = "Crée une fois un superutilisateur à partir de DJANGO_ADMIN_EMAIL et DJANGO_ADMIN_PASSWORD."

    def add_arguments(self, parser):
        parser.add_argument("--if-configured", action="store_true", help="Ne rien faire si les deux variables admin sont absentes.")

    def handle(self, *args, **options):
        email = os.environ.get("DJANGO_ADMIN_EMAIL", "").strip().lower()
        password = os.environ.get("DJANGO_ADMIN_PASSWORD", "")
        if not email or not password:
            if options.get("if_configured") and not email and not password:
                self.stdout.write("Variables admin absentes : aucun bootstrap nécessaire.")
                return
            raise CommandError("Définissez DJANGO_ADMIN_EMAIL et DJANGO_ADMIN_PASSWORD dans l’environnement du backend.")
        try:
            validate_email(email)
        except ValidationError as exc:
            raise CommandError("DJANGO_ADMIN_EMAIL doit être une adresse email valide.") from exc
        if len(password) < 20:
            raise CommandError("DJANGO_ADMIN_PASSWORD doit contenir au moins 20 caractères.")

        User = get_user_model()
        candidate = User(username=email, email=email)
        try:
            validate_password(password, user=candidate)
        except ValidationError as exc:
            raise CommandError("DJANGO_ADMIN_PASSWORD ne satisfait pas les règles de robustesse Django.") from exc

        try:
            with transaction.atomic():
                existing = User._default_manager.filter(email__iexact=email).first()
                if existing is not None:
                    if existing.is_staff and existing.is_superuser:
                        self.stdout.write(self.style.WARNING(f"Un compte superadmin existe déjà pour {email}; aucune modification effectuée."))
                        return
                    raise CommandError(
                        "Cette adresse email appartient déjà à un compte non-superadmin. "
                        "La commande ne promeut jamais un compte existant. Choisissez une adresse dédiée."
                    )
                User._default_manager.create_superuser(username=email, email=email, password=password)
        except IntegrityError as exc:
            raise CommandError("Un compte concurrent utilise déjà cette adresse ou cet identifiant.") from exc

        self.stdout.write(self.style.SUCCESS(f"Superadmin créé. Identifiant de connexion : {email}"))
        self.stdout.write("Ouvrez le chemin d’administration Django configuré pour ce service.")

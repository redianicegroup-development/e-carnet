import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.establishments.models import Establishment, EstablishmentMembership
from apps.identity.models import AccountContext
from apps.patients.models import PatientProfile
from apps.professionals.models import ProfessionalProfile


DEMO_ACCOUNTS = (
    ("demo-patient@example.test", "Patient", "Démo"),
    ("demo-startup@example.test", "Équipe", "Startup"),
    ("demo-root@example.test", "Responsable", "Démo"),
    ("demo-doctor@example.test", "Médecin", "Vérifié"),
    ("demo-doctor-pending@example.test", "Médecin", "À vérifier"),
    ("demo-org-pending@example.test", "Responsable", "En attente"),
)


class Command(BaseCommand):
    help = "Crée des comptes de démonstration fictifs pour l'environnement local de développement."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Refusé : la seed de démonstration exige DJANGO_DEBUG=true.")
        if os.environ.get("ECARNET_ENVIRONMENT") != "local":
            raise CommandError("Refusé : ECARNET_ENVIRONMENT doit être explicitement défini à 'local'.")
        if os.environ.get("ECARNET_ENABLE_DEMO_SEED") != "1":
            raise CommandError("Refusé : définissez ECARNET_ENABLE_DEMO_SEED=1 pour autoriser explicitement la seed.")

        password = os.environ.get("ECARNET_DEMO_PASSWORD", "")
        if len(password) < 12:
            raise CommandError("Définissez ECARNET_DEMO_PASSWORD avec au moins 12 caractères; aucun mot de passe par défaut n'est fourni.")

        with transaction.atomic():
            users = {
                email: self._user(email, first_name, last_name, password)
                for email, first_name, last_name in DEMO_ACCOUNTS
            }
            startup_user = users["demo-startup@example.test"]
            startup_user.is_staff = True
            startup_user.save(update_fields=("is_staff",))
            self._context(users["demo-patient@example.test"], "patient")
            self._context(users["demo-root@example.test"], "establishment")
            self._context(users["demo-doctor@example.test"], "professional")
            self._context(users["demo-doctor-pending@example.test"], "professional")
            self._context(users["demo-org-pending@example.test"], "establishment")

            PatientProfile.objects.get_or_create(user=users["demo-patient@example.test"])

            active_establishment, _ = Establishment.objects.update_or_create(
                internal_code="DEMO-ETAB-001",
                defaults={
                    "name": "Centre de démonstration fictif",
                    "establishment_type": "Centre de test",
                    "city": "Abidjan",
                    "address": "Adresse fictive — environnement de test",
                    "phone": "+225000000000",
                    "email": "centre-demo@example.test",
                    "responsible_name": "Responsable Démo",
                    "created_by": users["demo-root@example.test"],
                    "status": "active",
                },
            )
            pending_establishment, _ = Establishment.objects.update_or_create(
                name="Centre en attente — démonstration",
                defaults={
                    "establishment_type": "Centre de test",
                    "city": "Abidjan",
                    "address": "Adresse fictive — environnement de test",
                    "phone": "+225000000001",
                    "email": "centre-attente@example.test",
                    "responsible_name": "Responsable En attente",
                    "created_by": users["demo-org-pending@example.test"],
                    "status": "pending",
                    "internal_code": None,
                },
            )

            verified_professional, _ = ProfessionalProfile.objects.update_or_create(
                user=users["demo-doctor@example.test"],
                defaults={
                    "professional_title": "Médecin de démonstration",
                    "specialty": "Scénario fictif",
                    "professional_identifier": "DEMO-PRO-001",
                    "verification_status": "verified",
                    "active_establishment": active_establishment,
                },
            )
            pending_professional, _ = ProfessionalProfile.objects.update_or_create(
                user=users["demo-doctor-pending@example.test"],
                defaults={
                    "professional_title": "Médecin de démonstration",
                    "specialty": "Scénario fictif",
                    "professional_identifier": "DEMO-PRO-PENDING",
                    "verification_status": "pending",
                    "active_establishment": None,
                },
            )
            EstablishmentMembership.objects.update_or_create(
                establishment=active_establishment,
                professional=verified_professional,
                defaults={"status": "active"},
            )
            EstablishmentMembership.objects.update_or_create(
                establishment=active_establishment,
                professional=pending_professional,
                defaults={"status": "pending"},
            )
        self.stdout.write(self.style.SUCCESS("Comptes de démonstration créés/mis à jour (données fictives uniquement) :"))
        for email, _first_name, _last_name in DEMO_ACCOUNTS:
            self.stdout.write(f"- {email}")
        self.stdout.write("Le mot de passe est celui fourni via ECARNET_DEMO_PASSWORD; il n'est jamais affiché.")
        self.stdout.write("Compte startup local staff : demo-startup@example.test (accès réservé aux files d’examen).")
        self.stdout.write(f"Établissement actif de démonstration : {active_establishment.id}")
        self.stdout.write(f"Établissement en attente de démonstration : {pending_establishment.id}")
        self.stdout.write(self.style.WARNING("Ne jamais exécuter cette seed sur staging partagé ou production; elle ne valide aucun professionnel réel."))

    @staticmethod
    def _user(email, first_name, last_name, password):
        User = get_user_model()
        user, _ = User.objects.get_or_create(
            username=email,
            defaults={"email": email, "first_name": first_name, "last_name": last_name},
        )
        user.email = email
        user.first_name = first_name
        user.last_name = last_name
        user.is_staff = False
        user.is_superuser = False
        user.set_password(password)
        user.save()
        return user

    @staticmethod
    def _context(user, role):
        AccountContext.objects.update_or_create(
            user=user,
            role=role,
            defaults={"is_active": True, "onboarding_completed": True},
        )

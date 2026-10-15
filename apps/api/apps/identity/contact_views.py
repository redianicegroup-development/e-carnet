"""Formulaire de contact public de la landing.

Règles de conception :
- validation côté serveur, quelle que soit celle du navigateur ;
- consentement exigé : sans `consent: true`, le message n'est pas enregistré ;
- limitation par adresse IP (jamais par cookie : un cookie se fabrique) ;
- champ leurre « website » : un robot qui le remplit reçoit un succès de façade, rien n'est enregistré ;
- aucune donnée personnelle dans l'e-mail de notification à l'équipe : il renvoie vers l'administration.
"""
import logging
import re
import unicodedata
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ContactMessage
from .throttles import IpScopedThrottle

logger = logging.getLogger(__name__)

NAME_MIN, NAME_MAX = 2, 80
MESSAGE_MIN, MESSAGE_MAX = 10, 2000
EMAIL_MAX = 254
PHONE_DIGITS_MIN, PHONE_DIGITS_MAX = 8, 15
PHONE_ALLOWED = re.compile(r"^\+?[0-9 ().\-]+$")
SUBJECTS = dict(ContactMessage.SUBJECT_CHOICES)
HONEYPOT_FIELD = "website"


def _has_control_characters(value: str, allow: str = "") -> bool:
    return any(unicodedata.category(char).startswith("C") and char not in allow for char in value)


def clean_name(value, label):
    if not isinstance(value, str):
        return None, f"{label} : saisissez du texte."
    value = " ".join(value.split())
    if len(value) < NAME_MIN or len(value) > NAME_MAX:
        return None, f"{label} : entre {NAME_MIN} et {NAME_MAX} caractères."
    if _has_control_characters(value):
        return None, f"{label} : caractères non autorisés."
    return value, None


def clean_contact(value):
    """Renvoie (type, valeur normalisée, erreur) pour une adresse e-mail ou un numéro de téléphone."""
    if not isinstance(value, str) or not value.strip():
        return None, None, "Indiquez une adresse e-mail ou un numéro de téléphone."
    value = value.strip()
    if "@" in value:
        if len(value) > EMAIL_MAX:
            return None, None, "Cette adresse e-mail est trop longue."
        try:
            validate_email(value)
        except ValidationError:
            return None, None, "Cette adresse e-mail n’est pas valide. Exemple : prenom@exemple.com."
        return "email", value.lower(), None
    if not PHONE_ALLOWED.match(value):
        return None, None, "Ce numéro n’est pas valide. Utilisez des chiffres, par exemple 07 00 00 00 00."
    digits = re.sub(r"\D", "", value)
    if not PHONE_DIGITS_MIN <= len(digits) <= PHONE_DIGITS_MAX:
        return None, None, f"Un numéro de téléphone compte entre {PHONE_DIGITS_MIN} et {PHONE_DIGITS_MAX} chiffres."
    return "phone", ("+" if value.startswith("+") else "") + digits, None


def clean_message(value):
    if not isinstance(value, str):
        return None, "Le message doit être du texte."
    value = value.strip()
    if len(value) < MESSAGE_MIN or len(value) > MESSAGE_MAX:
        return None, f"Le message doit contenir entre {MESSAGE_MIN} et {MESSAGE_MAX:,} caractères.".replace(",", "\u202f")
    if _has_control_characters(value, allow="\n\r\t"):
        return None, "Le message contient des caractères non autorisés."
    return value, None


def notify_team(contact: ContactMessage) -> None:
    """Prévient l'équipe sans transmettre de donnée personnelle. Sans destinataire configuré, ne fait rien."""
    recipients = [item.strip() for item in getattr(settings, "ECARNET_CONTACT_NOTIFY_TO", "").split(",") if item.strip()]
    if not recipients:
        return
    try:
        send_mail(
            subject="E-Carnet : nouveau message de contact",
            message=f"Un nouveau message est arrivé (objet : {SUBJECTS[contact.subject]}).\nLisez-le dans l’administration, rubrique « Messages de contact ».",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            fail_silently=False,
        )
    except Exception:  # un e-mail qui échoue ne doit jamais faire perdre le message déjà enregistré
        logger.exception("Notification du message de contact %s impossible", contact.pk)


class PublicContactView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]
    throttle_classes = [IpScopedThrottle]
    throttle_scope = "contact"

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}

        if str(data.get(HONEYPOT_FIELD, "")).strip():
            return self._created(None)

        errors = {}
        first_name, error = clean_name(data.get("first_name"), "Prénom")
        if error:
            errors["first_name"] = error
        last_name, error = clean_name(data.get("last_name"), "Nom")
        if error:
            errors["last_name"] = error
        contact_kind, contact_value, error = clean_contact(data.get("contact"))
        if error:
            errors["contact"] = error
        subject = data.get("subject")
        if not isinstance(subject, str) or subject not in SUBJECTS:
            errors["subject"] = "Choisissez l’objet de votre message."
        message, error = clean_message(data.get("message"))
        if error:
            errors["message"] = error
        # Consentement : booléen JSON `true` uniquement (ni "true", ni 1, ni "on") ; sans lui, rien n'est enregistré.
        if data.get("consent") is not True:
            errors["consent"] = "Cochez la case pour envoyer votre message."

        if errors:
            return self._response({"success": False, "message": next(iter(errors.values())), "errors": errors}, 400)

        contact = ContactMessage.objects.create(
            first_name=first_name,
            last_name=last_name,
            contact_kind=contact_kind,
            contact_value=contact_value,
            subject=subject,
            message=message,
        )
        notify_team(contact)
        return self._created(contact)

    def _created(self, contact):
        return self._response({"success": True, "data": {"id": str(contact.id if contact else uuid.uuid4())}}, 201)

    @staticmethod
    def _response(payload, status_code):
        response = Response(payload, status=status_code)
        response["Cache-Control"] = "no-store"
        return response

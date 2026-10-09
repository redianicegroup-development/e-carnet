from urllib.parse import urlencode

from django.conf import settings
from django.core.mail import send_mail


def invitation_url(raw_token: str) -> str:
    separator = "&" if "?" in settings.ECARNET_INVITATION_BASE_URL else "?"
    return f"{settings.ECARNET_INVITATION_BASE_URL}{separator}{urlencode({'token': raw_token})}"


def send_establishment_invitation(*, email: str, first_name: str, establishment_name: str, raw_token: str, expires_at) -> None:
    url = invitation_url(raw_token)
    send_mail(
        subject="Votre invitation administrateur — Mon Carnet Numérique",
        message=(
            f"Bonjour {first_name},\n\n"
            f"L’équipe E-Carnet vous invite à administrer {establishment_name}.\n"
            "Cette invitation est personnelle, valable 48 heures et à usage unique. "
            "Choisissez votre mot de passe depuis le lien suivant :\n\n"
            f"{url}\n\n"
            f"Expiration : {expires_at.isoformat()}\n\n"
            "Si vous n’êtes pas la personne attendue, ignorez ce message."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )

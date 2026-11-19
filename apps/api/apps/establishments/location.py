"""Position GPS d'un établissement et visibilité dans la recherche « Établissements partenaires ».

Règles (voir docs/IMPLEMENTATION-ETABLISSEMENTS-PROCHES-2026-11-18.md) :
- la position est posée par l'administrateur de l'établissement, une seule fois, puis reste en base ;
- si la ville ou l'adresse change ensuite, la position n'est pas gardée en silence : elle est à reconfirmer, et en attendant la
  structure disparaît de la recherche des patients ;
- figurer dans la recherche est un choix explicite (désactivé par défaut), possible seulement avec une position confirmée ;
- la position d'un PATIENT n'entre jamais ici : le serveur ne la reçoit pas, le téléphone calcule lui-même les distances.
"""
from django.utils import timezone

from apps.audit.services import record_event

from .geo import InvalidLocation, validate_coordinates
from .models import EstablishmentLocationChange

LOCATION_FIELDS = ("latitude", "longitude", "is_listed_in_directory")
# Au-delà, la liste complète n'a plus sa place dans une seule réponse : il faudra alors filtrer côté serveur (voir la doc).
DIRECTORY_LIMIT = 500
_COORDINATES = ("latitude", "longitude")


def location_payload(establishment):
    """État de la position tel que le voit l'administrateur de la structure (fiche d'onboarding et paramètres)."""
    return {
        "latitude": establishment.latitude,
        "longitude": establishment.longitude,
        "location_status": establishment.location_status,
        "location_confirmed_at": establishment.location_confirmed_at,
        "is_listed_in_directory": establishment.is_listed_in_directory,
        "can_be_listed": listing_blocker(establishment) is None,
    }


def directory_item(row):
    """Ce que la personne reçoit : nom, type, lieu, téléphone, coordonnées et logo. Jamais d'identifiant, d'e-mail, de responsable ni de code interne.

    Le logo n'est donné que s'il s'agit de l'adresse publique (https, Cloudinary) : en développement l'image est servie par une route qui porte
    l'identifiant de la structure, qu'on ne divulgue pas ; la carte affiche alors les initiales de la structure à la place."""
    item = {key: row[key] for key in ("name", "establishment_type", "city", "address", "phone", "latitude", "longitude")}
    logo = (row.get("logo_url") or "").strip()
    item["logo"] = logo if logo.startswith("https://") else ""
    return item


def listing_blocker(establishment):
    """Première raison qui empêche la structure d'apparaître dans la recherche, ou None si elle peut y figurer."""
    if establishment.is_laboratory:
        return InvalidLocation("laboratory_not_listed", "Un laboratoire n’apparaît pas dans la recherche des patients.")
    if establishment.location_status != "confirmed":
        return InvalidLocation("location_required", "Confirmez d’abord la position de votre établissement sur la carte.")
    if not establishment.is_profile_complete:
        return InvalidLocation("profile_incomplete", "Complétez d’abord votre fiche : type de structure, ville et téléphone.")
    return None


def apply_location_update(establishment, *, user, changes, place_changed):
    """Applique les champs de position reçus, dans l'ordre : position, puis visibilité. Lève `InvalidLocation` sans rien écrire de
    partiel : l'appelant annule la transaction.

    `changes` ne contient que les clés réellement envoyées. `place_changed` vaut True quand la ville ou l'adresse vient de changer.
    """
    actions = []
    sent = [key for key in _COORDINATES if key in changes]
    if sent:
        if len(sent) == 1:
            raise InvalidLocation("incomplete_location", "Indiquez la latitude et la longitude ensemble.")
        if changes["latitude"] is None and changes["longitude"] is None:
            actions += _remove_location(establishment, user)
        else:
            latitude, longitude = validate_coordinates(changes["latitude"], changes["longitude"])
            actions += _confirm_location(establishment, user, latitude, longitude)
    elif place_changed and establishment.has_location and establishment.location_confirmed_at:
        establishment.location_confirmed_at = None
        actions.append("needs_reconfirmation")

    if "is_listed_in_directory" in changes:
        wanted = bool(changes["is_listed_in_directory"])
        if wanted and not establishment.is_listed_in_directory:
            blocker = listing_blocker(establishment)
            if blocker:
                raise blocker
        if wanted != establishment.is_listed_in_directory:
            establishment.is_listed_in_directory = wanted
            actions.append("listed" if wanted else "unlisted")

    if actions:
        establishment.save(update_fields=("latitude", "longitude", "location_confirmed_at", "is_listed_in_directory", "updated_at"))
        for action in actions:
            record_event(event_type=f"establishment.location.{action}", actor=user, actor_role="establishment_administrator", establishment=establishment, metadata={"action": action, "status": establishment.status})
    return actions


def _confirm_location(establishment, user, latitude, longitude):
    if establishment.location_status == "confirmed" and (establishment.latitude, establishment.longitude) == (latitude, longitude):
        return []  # même épingle déjà confirmée : ni historique ni journal en double
    EstablishmentLocationChange.objects.create(
        establishment=establishment, changed_by=user,
        previous_latitude=establishment.latitude, previous_longitude=establishment.longitude,
        latitude=latitude, longitude=longitude,
    )
    establishment.latitude, establishment.longitude = latitude, longitude
    establishment.location_confirmed_at = timezone.now()
    return ["confirmed"]


def _remove_location(establishment, user):
    if not establishment.has_location:
        return []
    EstablishmentLocationChange.objects.create(
        establishment=establishment, changed_by=user,
        previous_latitude=establishment.latitude, previous_longitude=establishment.longitude,
    )
    establishment.latitude = establishment.longitude = establishment.location_confirmed_at = None
    actions = ["removed"]
    if establishment.is_listed_in_directory:
        establishment.is_listed_in_directory = False  # sans position, la structure ne peut plus figurer dans la recherche
        actions.append("unlisted")
    return actions

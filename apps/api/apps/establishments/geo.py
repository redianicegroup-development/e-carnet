"""Contrôle des coordonnées GPS saisies par un établissement.

Module volontairement sans dépendance Django : il se teste seul et sert de source unique aux règles de validité d'une position.
Aucun calcul de distance ici : la position du patient ne quitte jamais son téléphone, c'est lui qui trie la liste (voir
`apps/web/src/lib/geo.ts`).
"""
import math

# (latitude min, latitude max, longitude min, longitude max) — rectangle englobant la Côte d'Ivoire, avec une marge de quelques
# kilomètres pour les structures frontalières. Il attrape les erreurs grossières (latitude et longitude inversées, GPS d'un PC qui
# se localise à l'étranger, « 0,0 »), pas les erreurs de quelques rues : celles-là se corrigent à l'œil, sur la carte.
COTE_D_IVOIRE_BOUNDS = (4.2, 10.9, -8.7, -2.4)
# 6 décimales ≈ 11 cm : au-delà, la précision n'est qu'une illusion de GPS.
COORDINATE_DECIMALS = 6


class InvalidLocation(ValueError):
    """Position refusée ; `code` est stable (utilisable par le web), `args[0]` est le message affiché à l'établissement."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def _is_inside(latitude, longitude, bounds):
    lat_min, lat_max, lng_min, lng_max = bounds
    return lat_min <= latitude <= lat_max and lng_min <= longitude <= lng_max


def validate_coordinates(latitude, longitude, bounds=COTE_D_IVOIRE_BOUNDS):
    """Renvoie `(latitude, longitude)` arrondies, ou lève `InvalidLocation`.

    Les deux valeurs vont ensemble : une seule fournie est une erreur, jamais une position à moitié enregistrée.
    """
    if latitude is None or longitude is None:
        raise InvalidLocation("incomplete_location", "Indiquez la latitude et la longitude, ou aucune des deux.")
    try:
        latitude, longitude = float(latitude), float(longitude)
    except (TypeError, ValueError):
        raise InvalidLocation("invalid_location", "La position envoyée n’est pas valide.")
    if not (math.isfinite(latitude) and math.isfinite(longitude)) or abs(latitude) > 90 or abs(longitude) > 180:
        raise InvalidLocation("invalid_location", "La position envoyée n’est pas valide.")
    if latitude == 0 and longitude == 0:
        raise InvalidLocation("invalid_location", "Cette position (0, 0) n’est pas un vrai emplacement : placez l’épingle sur votre bâtiment.")
    if _is_inside(latitude, longitude, bounds):
        return round(latitude, COORDINATE_DECIMALS), round(longitude, COORDINATE_DECIMALS)
    if _is_inside(longitude, latitude, bounds):
        raise InvalidLocation("location_swapped", "La latitude et la longitude semblent inversées. Vérifiez-les puis réessayez.")
    raise InvalidLocation("location_outside_country", "Cette position est en dehors de la Côte d’Ivoire. Placez l’épingle sur votre bâtiment.")

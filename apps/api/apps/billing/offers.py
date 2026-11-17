"""Offres et moyens de paiement. Les tarifs viennent du business plan v3 ; Institutionnel est toujours sur devis."""
import os

from django.conf import settings

ESSENTIAL_INCLUDES = ["Espace établissement", "Codes médecin et rattachements", "Consultations et ordonnances PDF", "Journal d’accès"]
OFFERS = {
    "essentiel": {"code": "essentiel", "name": "Essentiel", "price_fcfa": 20000, "min_practitioners": 1, "max_practitioners": 3, "self_service": True, "capacity_label": "Jusqu’à 3 praticiens", "includes": ESSENTIAL_INCLUDES},
    "professionnel": {"code": "professionnel", "name": "Professionnel", "price_fcfa": 50000, "min_practitioners": 4, "max_practitioners": 10, "self_service": True, "capacity_label": "De 4 à 10 praticiens", "includes": ["Toute l’offre Essentiel", "Statistiques d’activité", "Support prioritaire", "Logo sur les documents"]},
    "institutionnel": {"code": "institutionnel", "name": "Institutionnel", "price_fcfa": None, "min_practitioners": 11, "max_practitioners": None, "self_service": False, "capacity_label": "Hôpitaux, groupes et organismes publics", "includes": ["Déploiement dédié", "Accompagnement renforcé", "Sécurité et intégrations", "Conditions contractuelles"]},
}
CONDITIONS = ("Facturation mensuelle : une facture est émise 7 jours avant chaque renouvellement. Sans paiement, l’accès professionnel de l’établissement est suspendu après deux mois d’impayés ; "
              "les patients gardent leur carnet, leurs accès et leur export. Un changement d’offre prend effet à la prochaine période.")
METHODS = {"orange_money": "Orange Money", "mtn_momo": "MTN MoMo", "moov_money": "Moov Money", "wave": "Wave", "bank_transfer": "Virement bancaire"}


def conf(name, default=""):
    value = getattr(settings, name, None)
    return os.environ.get(name, default) if value is None else value


def conf_int(name, default):
    try:
        return int(conf(name, default))
    except (TypeError, ValueError):
        return default


def available_methods():
    raw = conf("BILLING_PAYMENT_METHODS", "")
    codes = [code.strip() for code in (raw if isinstance(raw, (list, tuple)) else str(raw).split(",")) if code.strip() in METHODS]
    return codes or list(METHODS)

from apps.establishments.models import EstablishmentMembership


def professional_clinical_access_error(profile):
    """Return a denial reason unless the current professional context is clinically eligible."""
    if not profile:
        return "Le profil professionnel n’est pas disponible."

    user = profile.user
    if not user.account_contexts.filter(role="professional", is_active=True).exists():
        return "Sélectionnez le contexte professionnel avant tout accès clinique."
    establishment = profile.active_establishment
    if not establishment or establishment.status != "active":
        return "Choisissez un établissement actif avant tout accès clinique."
    if not EstablishmentMembership.objects.filter(
        professional=profile,
        establishment=establishment,
        status="active",
    ).exists():
        return "Le rattachement actif à cet établissement est requis."

    return None

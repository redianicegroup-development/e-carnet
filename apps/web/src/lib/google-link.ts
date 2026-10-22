/* Liaison automatique d'un compte établissement à Google, juste après la fiche.
   Fichier pur (sans React) pour pouvoir être testé. Le serveur reste juge : il n'accepte la liaison que si Google confirme
   la même adresse que celle du compte (api identity/oauth_views.py, establishment_email_problem). */

const GOOGLE_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export type LinkableAccount = { email?: string; auth_identities?: { provider: string }[] };

/** Une adresse Gmail ne peut appartenir qu'à un compte Google : la liaison peut démarrer sans demander. */
export function isGoogleAddress(email: string | undefined | null): boolean {
  const domain = (email ?? "").trim().toLowerCase().split("@")[1] ?? "";
  return GOOGLE_DOMAINS.has(domain);
}

export function shouldAutoLinkGoogle(account: LinkableAccount | null | undefined, googleConfigured: boolean): boolean {
  if (!account || !googleConfigured || !isGoogleAddress(account.email)) return false;
  return !(account.auth_identities ?? []).some((identity) => identity.provider === "google");
}

/** Démarre la liaison (et non une connexion) ; `next` est la page où revenir une fois Google passé. */
export function googleLinkUrl(next: string): string {
  return `/api/v1/identity/oauth/google/start/?intent=link&next=${encodeURIComponent(next)}`;
}

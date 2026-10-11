/* Logique pure du message d'accueil : aucune dépendance React ni navigateur, donc testable avec `node --test`.
   - "welcome"  : compte récent ET jamais accueilli sur ce navigateur  → « Bienvenue, Prénom »
   - "morning"  : compte existant, avant 18 h (et après 5 h)           → « Bonjour Prénom »
   - "evening"  : compte existant, à partir de 18 h (jusqu'à 5 h)      → « Bonsoir Prénom »
   - null       : rien à afficher (déjà salué pendant cette session). */

export type GreetingKind = "welcome" | "morning" | "evening";

/** Un compte est « nouveau » pendant 7 jours : au-delà, on ne souhaite plus la bienvenue, même sans drapeau local. */
export const NEW_ACCOUNT_WINDOW_DAYS = 7;

export function timeOfDay(now: Date): "morning" | "evening" {
  const hour = now.getHours();
  return hour >= 18 || hour < 5 ? "evening" : "morning";
}

export function isNewAccount(dateJoined: string | undefined | null, now: Date): boolean {
  if (!dateJoined) return false; // pas d'info fiable → on traite comme un ancien compte (jamais de faux « bienvenue »)
  const joined = new Date(dateJoined).getTime();
  if (Number.isNaN(joined)) return false;
  const ageMs = now.getTime() - joined;
  return ageMs >= -5 * 60_000 && ageMs <= NEW_ACCOUNT_WINDOW_DAYS * 86_400_000; // tolérance de 5 min pour le décalage d'horloge
}

export type GreetingInput = {
  dateJoined?: string | null;
  now: Date;
  alreadyWelcomed: boolean;
  alreadyGreetedThisSession: boolean;
};

export function decideGreeting({ dateJoined, now, alreadyWelcomed, alreadyGreetedThisSession }: GreetingInput): GreetingKind | null {
  if (alreadyGreetedThisSession) return null;
  if (!alreadyWelcomed && isNewAccount(dateJoined, now)) return "welcome";
  return timeOfDay(now);
}

/** Prénom prêt à l'affichage : espaces retirés, longueur bornée. Vide si inconnu (le titre s'écrit alors sans nom). */
export function firstNameOf(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
}

/* --- Stockage navigateur (drapeaux par compte). Tout est protégé : navigation privée / stockage bloqué → pas de modal. --- */

const WELCOME_KEY = (accountId: string) => `ecarnet:welcome:v1:${accountId}`;
const SESSION_KEY = (accountId: string) => `ecarnet:greeted:v1:${accountId}`;

export type GreetingFlags = { alreadyWelcomed: boolean; alreadyGreetedThisSession: boolean; storageOk: boolean };

export function readGreetingFlags(accountId: string): GreetingFlags {
  try {
    const probe = "ecarnet:probe";
    window.sessionStorage.setItem(probe, "1");
    window.sessionStorage.removeItem(probe);
    return {
      alreadyWelcomed: window.localStorage.getItem(WELCOME_KEY(accountId)) === "1",
      alreadyGreetedThisSession: window.sessionStorage.getItem(SESSION_KEY(accountId)) === "1",
      storageOk: true,
    };
  } catch {
    return { alreadyWelcomed: true, alreadyGreetedThisSession: true, storageOk: false };
  }
}

export function markGreeted(accountId: string, kind: GreetingKind) {
  try {
    window.sessionStorage.setItem(SESSION_KEY(accountId), "1");
    if (kind === "welcome") window.localStorage.setItem(WELCOME_KEY(accountId), "1");
  } catch { /* stockage indisponible : on ne bloque rien */ }
}

/** À appeler à la déconnexion : la prochaine connexion dans le même onglet doit re-saluer l'utilisateur. */
export function clearGreetingSession() {
  try {
    const prefix = "ecarnet:greeted:v1:";
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(prefix)) window.sessionStorage.removeItem(key);
    }
  } catch { /* rien à nettoyer */ }
}

/* Logique pure du message d'accueil : aucune dépendance React ni navigateur, donc testable avec `node --test`.
   Les marqueurs de salutations sont conservés en mémoire uniquement : aucun stockage navigateur n’est utilisé. */

export type GreetingKind = "welcome" | "morning" | "evening";
export const NEW_ACCOUNT_WINDOW_DAYS = 7;

export function timeOfDay(now: Date): "morning" | "evening" {
  const hour = now.getHours();
  return hour >= 18 || hour < 5 ? "evening" : "morning";
}

export function isNewAccount(dateJoined: string | undefined | null, now: Date): boolean {
  if (!dateJoined) return false;
  const joined = new Date(dateJoined).getTime();
  if (Number.isNaN(joined)) return false;
  const ageMs = now.getTime() - joined;
  return ageMs >= -5 * 60_000 && ageMs <= NEW_ACCOUNT_WINDOW_DAYS * 86_400_000;
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

export function firstNameOf(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
}

const welcomedAccounts = new Set<string>();
const greetedAccounts = new Set<string>();
export type GreetingFlags = { alreadyWelcomed: boolean; alreadyGreetedThisSession: boolean; storageOk: boolean };

export function readGreetingFlags(accountId: string): GreetingFlags {
  return {
    alreadyWelcomed: welcomedAccounts.has(accountId),
    alreadyGreetedThisSession: greetedAccounts.has(accountId),
    storageOk: true,
  };
}

export function markGreeted(accountId: string, kind: GreetingKind) {
  greetedAccounts.add(accountId);
  if (kind === "welcome") welcomedAccounts.add(accountId);
}

/** À appeler à la déconnexion : la prochaine connexion dans la même session d’application peut re-saluer. */
export function clearGreetingSession() {
  greetedAccounts.clear();
}

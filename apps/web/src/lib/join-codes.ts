/* Codes médecin affichés pendant leurs 48 h. Fichier pur (sans React) pour pouvoir être testé. */

export type ActiveJoinCode = { id: string; code: string; expires_at: string; created_at?: string };

const HOUR = 3_600_000;

/** « Expire dans 47 h », « Expire dans moins d’une heure », ou chaîne vide si le code est déjà périmé. */
export function expiryLabel(expiresAt: string, now: number = Date.now()): string {
  const left = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(left) || left <= 0) return "";
  if (left < HOUR) return "Expire dans moins d’une heure";
  return `Expire dans ${Math.floor(left / HOUR)} h`;
}

/** Ne garde que les codes encore valables, le plus récent d'abord : la liste ne montre jamais un code périmé, même si l'écran reste ouvert. */
export function usableCodes(codes: ActiveJoinCode[], now: number = Date.now()): ActiveJoinCode[] {
  return codes
    .filter((item) => item.code && new Date(item.expires_at).getTime() > now)
    .sort((a, b) => new Date(b.created_at ?? b.expires_at).getTime() - new Date(a.created_at ?? a.expires_at).getTime());
}

/** Prénom et nom d'une personne à partir de son nom complet, pour les pastilles d'initiales. */
export function splitFullName(name: string | undefined | null): { first_name: string; last_name: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] ?? "", last_name: parts.slice(1).join(" ") };
}

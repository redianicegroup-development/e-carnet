/* PRO-15 — Patients reçus récemment. Logique pure (aucun React), testée dans tests/classe-a-2026-11-12.test.mjs.
   Le serveur ne renvoie que prénom, nom et date du dernier accès : jamais d'identifiant, d'état ni de donnée médicale.
   Un accès terminé ne se « rouvre » donc jamais d'ici : l'unique action est une NOUVELLE demande par QR. */

export const RECENT_PATIENTS_PATH = "/api/v1/patient/care/professional/recent-patients/";
export const RECENT_RETENTION_DAYS = 30;
export const RECENT_LIMIT = 20;
/** En dessous de ce nombre de lignes, une barre de recherche ne sert à rien. */
export const RECENT_SEARCH_FROM = 6;

export type RecentPatient = { first_name: string; last_name: string; last_accessed_at: string };

/** Ne garde que les trois champs attendus (tout identifiant éventuellement ajouté par erreur est écarté avant l'affichage) et au plus 20 lignes. */
export function parseRecentPatients(payload: unknown): RecentPatient[] {
  if (!Array.isArray(payload)) return [];
  const rows: RecentPatient[] = [];
  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.last_accessed_at !== "string") continue;
    rows.push({
      first_name: typeof row.first_name === "string" ? row.first_name : "",
      last_name: typeof row.last_name === "string" ? row.last_name : "",
      last_accessed_at: row.last_accessed_at,
    });
  }
  return rows.slice(0, RECENT_LIMIT);
}

export function recentPatientName(patient: Pick<RecentPatient, "first_name" | "last_name">): string {
  return [patient.first_name, patient.last_name].map((part) => part.trim()).filter(Boolean).join(" ") || "Patient sans nom renseigné";
}

/** Date à laquelle la ligne quitte la liste : dernier accès + 30 jours. Chaîne ISO, ou null si la date est illisible. */
export function listedUntil(lastAccessedAt: string): string | null {
  const time = new Date(lastAccessedAt).getTime();
  if (Number.isNaN(time)) return null;
  return new Date(time + RECENT_RETENTION_DAYS * 86_400_000).toISOString();
}

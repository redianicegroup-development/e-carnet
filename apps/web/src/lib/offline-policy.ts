/**
 * Règles du hors connexion, sans dépendance (testable en Node).
 *
 * Deux copies locales existent, et seulement deux :
 *  1. la carte d'urgence publique ouverte par QR (24 h, IndexedDB `ecarnet-public-emergency-v1`) ;
 *  2. les déclarations du carnet, en lecture seule (7 jours, IndexedDB `ecarnet-offline-v1`), décision du 02/11/2026.
 *
 * Rien d'autre n'est conservé : ni historique, ni consultations, ni documents, ni agenda, ni réponse d'API.
 * Les constantes de la copie des déclarations sont dupliquées dans `public/hors-connexion.js` (qui ne peut pas importer
 * ce module) ; `tests/hors-connexion-2026-11-02.test.mjs` vérifie qu'elles restent identiques.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export const EMERGENCY_CARD_MAX_AGE_MS = DAY_MS;
export const SNAPSHOT_MAX_AGE_MS = 7 * DAY_MS;
/** Copie des déclarations active par défaut ; le patient peut la couper (elle est alors effacée). Mettre `false` pour exiger un accord préalable. */
export const OFFLINE_DECLARATIONS_DEFAULT_ENABLED = true;

export const OFFLINE_DB_NAME = "ecarnet-offline-v1";
export const OFFLINE_STORE_NAME = "snapshots";
export const SNAPSHOT_KEY = "current";
export const PREFS_KEY = "prefs";

/** Tolérance sur l'horloge de l'appareil : une date nettement dans le futur est traitée comme expirée plutôt que « jamais périmée ». */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export function isExpired(value: unknown, maxAgeMs: number, now: number = Date.now()): boolean {
  const time = typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(time)) return true;
  const age = now - time;
  return age > maxAgeMs || age < -CLOCK_SKEW_MS;
}

/* ---------- carte d'urgence publique ---------- */

export type CardFallback = "use-cache" | "forget" | "none";

/**
 * Que faire de la copie locale quand la lecture de la carte échoue ?
 *  - 404 / 410 : le QR est désactivé, renouvelé ou inconnu → la copie doit disparaître, jamais être affichée ;
 *  - pas de réponse (réseau, délai), 429 ou 5xx → on peut montrer la copie (avec son avertissement) ;
 *  - tout autre refus (400, 401, 403…) → rien à montrer.
 */
export function emergencyCardFallback(error: unknown): CardFallback {
  const status = typeof error === "object" && error !== null && "status" in error ? (error as { status: unknown }).status : undefined;
  if (status === undefined) return "use-cache"; // TypeError réseau, AbortError : aucune réponse du serveur
  if (typeof status !== "number") return "none";
  if (status === 404 || status === 410) return "forget";
  if (status === 0 || status === 429 || status >= 500) return "use-cache";
  return "none";
}

/* ---------- copie des déclarations (lecture seule) ---------- */

export type OfflineDeclaration = { id: string; kind: string; label: string; details: string; provenance: string };
export type OfflineProfile = { id: string; kind: "self" | "child"; first_name: string; last_name: string };
export type OfflineProfileEntry = { savedAt: string; items: OfflineDeclaration[] };
export type OfflineSnapshot = {
  key: typeof SNAPSHOT_KEY;
  version: 1;
  accountId: string;
  savedAt: string;
  /** Profil actif côté serveur à la dernière synchronisation (proposé en premier hors connexion). */
  activeProfileId: string;
  profiles: OfflineProfile[];
  declarations: Record<string, OfflineProfileEntry>;
};

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

/** Ne garde de la réponse d'API que ce qui s'affiche hors connexion (minimisation) ; ignore tout ce qui est mal formé. */
export function toOfflineDeclaration(raw: unknown): OfflineDeclaration | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Record<string, unknown>;
  const id = text(item.id, 64);
  const kind = text(item.kind, 32);
  const label = text(item.label, 200);
  if (!id || !kind || !label) return null;
  const provenance = typeof item.provenance === "object" && item.provenance !== null ? text((item.provenance as Record<string, unknown>).label, 120) : "";
  return { id, kind, label, details: text(item.details, 2000), provenance: provenance || "Déclaré par le patient" };
}

export function toOfflineProfile(id: unknown, kind: OfflineProfile["kind"], firstName: unknown, lastName: unknown): OfflineProfile | null {
  const profileId = text(id, 64);
  if (!profileId) return null;
  return { id: profileId, kind, first_name: text(firstName, 80), last_name: text(lastName, 80) };
}

export type SnapshotInput = {
  accountId: string;
  activeProfileId: string;
  profiles: OfflineProfile[];
  declarations: OfflineDeclaration[];
  now?: number;
};

/**
 * Fusionne la lecture qui vient d'être faite (profil actif) avec la copie précédente (autres profils).
 * Un autre compte repart de zéro ; un profil qui n'existe plus ou dont la copie est périmée disparaît.
 * Renvoie `null` si le profil lu ne figure pas dans la liste (on n'enregistre pas de déclarations sans propriétaire).
 */
export function mergeSnapshot(previous: OfflineSnapshot | null, input: SnapshotInput): OfflineSnapshot | null {
  const now = input.now ?? Date.now();
  if (!input.accountId || !input.profiles.some((profile) => profile.id === input.activeProfileId)) return null;
  const savedAt = new Date(now).toISOString();
  const known = new Set(input.profiles.map((profile) => profile.id));
  const declarations: Record<string, OfflineProfileEntry> = {};
  if (previous && previous.accountId === input.accountId) {
    for (const [profileId, entry] of Object.entries(previous.declarations)) {
      if (known.has(profileId) && !isExpired(entry.savedAt, SNAPSHOT_MAX_AGE_MS, now)) declarations[profileId] = entry;
    }
  }
  declarations[input.activeProfileId] = { savedAt, items: input.declarations };
  return { key: SNAPSHOT_KEY, version: 1, accountId: input.accountId, savedAt, activeProfileId: input.activeProfileId, profiles: input.profiles, declarations };
}

/** Retire ce qui a dépassé 7 jours ; `null` si plus rien n'est lisible (la copie entière doit alors être effacée). */
export function pruneSnapshot(snapshot: OfflineSnapshot | null | undefined, now: number = Date.now()): OfflineSnapshot | null {
  if (!snapshot || snapshot.key !== SNAPSHOT_KEY || snapshot.version !== 1 || !Array.isArray(snapshot.profiles)) return null;
  if (isExpired(snapshot.savedAt, SNAPSHOT_MAX_AGE_MS, now)) return null;
  const declarations: Record<string, OfflineProfileEntry> = {};
  for (const [profileId, entry] of Object.entries(snapshot.declarations ?? {})) {
    if (entry && Array.isArray(entry.items) && !isExpired(entry.savedAt, SNAPSHOT_MAX_AGE_MS, now)) declarations[profileId] = entry;
  }
  if (Object.keys(declarations).length === 0) return null;
  return { ...snapshot, declarations };
}

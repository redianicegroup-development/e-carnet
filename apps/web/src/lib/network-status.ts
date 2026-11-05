/**
 * Règles du réseau, sans dépendance (testable en Node).
 *
 * « Hors connexion » = l'appareil n'atteint pas le site (aucune réponse HTTP). Un serveur qui répond lentement ou par une erreur
 * (Render qui se réveille : 502, 503, délai dépassé) n'est PAS hors connexion : SpaceShell gère déjà ce réveil, et le bandeau
 * ne doit pas s'afficher à tort (même distinction que Kôkô Eats entre « Internet » et « API indisponible »).
 */
export const HEARTBEAT_PATH = "/api/v1/health/";
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const HEARTBEAT_TIMEOUT_MS = 6_000;
/** Échecs consécutifs (sans réponse HTTP) avant d'afficher « hors connexion » alors que le navigateur se croit en ligne (Wi-Fi sans Internet). */
export const HEARTBEAT_FAILURES_BEFORE_OFFLINE = 2;
export const RESTORED_BANNER_MS = 4_000;
/** Plus long quand des données affichées viennent de la copie locale : le temps de lire « Actualiser ». */
export const RESTORED_WITH_REFRESH_MS = 12_000;

export const OFFLINE_BANNER_TITLE = "Vous êtes hors connexion";
export const OFFLINE_BANNER_TEXT = "Vérifiez votre connexion Internet. Ce que vous avez déjà consulté reste disponible.";
export const RESTORED_BANNER_TITLE = "Connexion rétablie";
/** Message des erreurs réseau : remplace « Failed to fetch » (Chrome), « Load failed » (Safari), « NetworkError… » (Firefox). */
export const NETWORK_ERROR_MESSAGE = "Vous êtes hors connexion. Vérifiez votre connexion Internet puis réessayez.";
export const OFFLINE_NO_COPY_MESSAGE = "Vous êtes hors connexion et cet appareil ne garde pas encore vos données. Ouvrez l’application une fois avec la connexion pour la préparer à fonctionner sans réseau.";
export const WRITE_OFFLINE_MESSAGE = "Cette action demande une connexion Internet. Réessayez dès que vous êtes de nouveau en ligne.";

export const NETWORK_FAILURE_EVENT = "ecarnet:network-failure";
export const SERVED_FROM_COPY_EVENT = "ecarnet:served-from-cache";
export const NETWORK_RESTORED_EVENT = "ecarnet:network-restored";

/** fetch() échoue sans réponse HTTP par un TypeError (le texte varie selon le navigateur). */
export function isFetchNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError;
}

export function isOfflineVerdict(browserOnline: boolean, consecutiveFailures: number): boolean {
  return !browserOnline || consecutiveFailures >= HEARTBEAT_FAILURES_BEFORE_OFFLINE;
}

/** Résultat d'un test de joignabilité : « down » seulement si le réseau a échoué tout de suite ; un délai dépassé reste « inconnu ». */
export type PingVerdict = "ok" | "down" | "unknown";
export function pingVerdictFromError(error: unknown): PingVerdict {
  return isFetchNetworkFailure(error) ? "down" : "unknown";
}

export function formatCopyDate(savedAt: number | string | null | undefined): string {
  const time = typeof savedAt === "string" ? Date.parse(savedAt) : savedAt;
  if (typeof time !== "number" || !Number.isFinite(time)) return "";
  return new Date(time).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

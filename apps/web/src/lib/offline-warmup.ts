import { isOfflineCacheEnabled } from "./offline-cache";

const MIN_INTERVAL_MS = 30 * 60 * 1000;
let lastWarmAt = 0;

/**
 * Demande au service worker de garder la coquille des écrans listés (voir `offline-routes.ts`), en ligne seulement et si le réglage
 * « Hors connexion » est actif. Au plus une demande toutes les 30 minutes, sauf `force` (retour de la connexion).
 */
export async function warmOfflineShells(paths: string[], force = false, now: number = Date.now()): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || navigator.onLine === false) return false;
  if (!force && now - lastWarmAt < MIN_INTERVAL_MS) return false;
  if (!(await isOfflineCacheEnabled())) return false;
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration?.active) return false;
  lastWarmAt = now;
  registration.active.postMessage({ type: "WARM_SHELLS", paths });
  return true;
}

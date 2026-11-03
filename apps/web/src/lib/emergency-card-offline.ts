import type { EmergencyCardView } from "../components/emergency-card/EmergencyCardVisual";
import { EMERGENCY_CARD_MAX_AGE_MS, isExpired } from "./offline-policy";

/**
 * Copie locale de la carte d'urgence ouverte par QR (`/urgence/<token>`), sur l'appareil de celui qui la consulte.
 * Durée : 24 h, puis la copie est SUPPRIMÉE (et pas seulement ignorée). Elle l'est aussi dès que le serveur répond que le QR
 * n'existe plus (404/410), et à chaque ouverture d'une carte pour toutes les copies périmées.
 */
const DB_NAME = "ecarnet-public-emergency-v1";
const STORE_NAME = "cards";

type CachedCard = { token: string; data: EmergencyCardView; cachedAt: string };

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DB_NAME, 1); } catch { resolve(null); return; }
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "token" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

/** Transaction validée avant de rendre la main : un effacement demandé est un effacement terminé. */
async function inTransaction(mode: IDBTransactionMode, work: (store: IDBObjectStore) => void): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  const ok = await new Promise<boolean>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, mode);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
      work(transaction.objectStore(STORE_NAME));
    } catch { resolve(false); }
  });
  db.close();
  return ok;
}

export async function cacheEmergencyCard(token: string, data: EmergencyCardView): Promise<void> {
  await inTransaction("readwrite", (store) => { store.put({ token, data, cachedAt: new Date().toISOString() } satisfies CachedCard); });
}

/** Le QR n'existe plus ou a été renouvelé : la copie ne doit plus jamais être affichée. */
export async function forgetEmergencyCard(token: string): Promise<void> {
  await inTransaction("readwrite", (store) => { store.delete(token); });
}

/** Supprime toutes les copies de plus de 24 h (aucune n'est affichable, autant ne pas les garder). */
export async function purgeExpiredEmergencyCards(now: number = Date.now()): Promise<void> {
  await inTransaction("readwrite", (store) => {
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      if (isExpired((cursor.value as CachedCard).cachedAt, EMERGENCY_CARD_MAX_AGE_MS, now)) cursor.delete();
      cursor.continue();
    };
  });
}

export async function readCachedEmergencyCard(token: string, now: number = Date.now()): Promise<{ data: EmergencyCardView; cachedAt: string } | null> {
  const db = await openDb();
  if (!db) return null;
  const cached = await new Promise<CachedCard | null>((resolve) => {
    try {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(token);
      request.onsuccess = () => resolve((request.result as CachedCard | undefined) ?? null);
      request.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  db.close();
  if (!cached) return null;
  if (isExpired(cached.cachedAt, EMERGENCY_CARD_MAX_AGE_MS, now)) {
    await forgetEmergencyCard(token);
    return null;
  }
  return { data: cached.data, cachedAt: cached.cachedAt };
}

/**
 * Demande au service worker de garder la coquille de la page `/urgence/<token>` et les fichiers `/_next/static/` qu'elle a
 * chargés, pour qu'elle se recharge sans réseau (sans cela, le script de la page n'est pas disponible et la copie ci-dessus
 * ne peut jamais s'afficher). La coquille ne contient aucune donnée de santé : la carte vient de l'API, puis de IndexedDB.
 */
export function keepEmergencyPageForOffline(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const assets = performance.getEntriesByType("resource")
    .map((entry) => { try { return new URL(entry.name); } catch { return null; } })
    .filter((url): url is URL => url !== null && url.origin === window.location.origin && url.pathname.startsWith("/_next/static/"))
    .map((url) => `${url.pathname}${url.search}`);
  navigator.serviceWorker.ready
    .then((registration) => registration.active?.postMessage({ type: "CACHE_EMERGENCY_PAGE", url: window.location.pathname, assets }))
    .catch(() => undefined);
}

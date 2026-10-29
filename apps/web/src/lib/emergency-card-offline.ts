import type { EmergencyCardView } from "../components/emergency-card/EmergencyCardVisual";

const DB_NAME = "ecarnet-public-emergency-v1";
const STORE_NAME = "cards";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type CachedCard = { token: string; data: EmergencyCardView; cachedAt: string };

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "token" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function cacheEmergencyCard(token: string, data: EmergencyCardView): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ token, data, cachedAt: new Date().toISOString() } satisfies CachedCard);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
  db.close();
}

export async function readCachedEmergencyCard(token: string): Promise<{ data: EmergencyCardView; cachedAt: string } | null> {
  const db = await openDb();
  if (!db) return null;
  const cached = await new Promise<CachedCard | null>((resolve) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(token);
    request.onsuccess = () => resolve((request.result as CachedCard | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
  db.close();
  if (!cached) return null;
  const cachedAt = Date.parse(cached.cachedAt);
  if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > MAX_AGE_MS) return null;
  return { data: cached.data, cachedAt: cached.cachedAt };
}

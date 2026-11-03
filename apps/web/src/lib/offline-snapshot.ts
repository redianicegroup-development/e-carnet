import {
  OFFLINE_DB_NAME,
  OFFLINE_DECLARATIONS_DEFAULT_ENABLED,
  OFFLINE_STORE_NAME,
  PREFS_KEY,
  SNAPSHOT_KEY,
  mergeSnapshot,
  pruneSnapshot,
  type OfflineSnapshot,
  type SnapshotInput,
} from "./offline-policy";

/**
 * Copie locale des déclarations du carnet, en lecture seule (voir `offline-policy.ts` et `docs/PWA-HORS-CONNEXION.md`).
 * Un seul enregistrement `current` : le supprimer efface tout. Aucune écriture hors connexion n'existe.
 * Toutes les fonctions échouent en silence (navigation privée, stockage refusé) : le carnet fonctionne sans cette copie.
 */
type Prefs = { key: typeof PREFS_KEY; declarationsEnabled: boolean };

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(OFFLINE_DB_NAME, 1); } catch { resolve(null); return; }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(OFFLINE_STORE_NAME)) request.result.createObjectStore(OFFLINE_STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

/** Exécute `work` dans une transaction et attend sa validation (important avant une déconnexion : l'effacement doit être terminé). */
async function inTransaction(mode: IDBTransactionMode, work: (store: IDBObjectStore) => void): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  const ok = await new Promise<boolean>((resolve) => {
    try {
      const transaction = db.transaction(OFFLINE_STORE_NAME, mode);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
      work(transaction.objectStore(OFFLINE_STORE_NAME));
    } catch { resolve(false); }
  });
  db.close();
  return ok;
}

async function readRecord<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  const value = await new Promise<T | null>((resolve) => {
    try {
      const request = db.transaction(OFFLINE_STORE_NAME, "readonly").objectStore(OFFLINE_STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  db.close();
  return value;
}

export async function isOfflineSnapshotEnabled(): Promise<boolean> {
  const prefs = await readRecord<Prefs>(PREFS_KEY);
  return prefs ? prefs.declarationsEnabled !== false : OFFLINE_DECLARATIONS_DEFAULT_ENABLED;
}

/** Couper la copie l'efface aussitôt, dans la même transaction que le réglage. */
export async function setOfflineSnapshotEnabled(enabled: boolean): Promise<void> {
  await inTransaction("readwrite", (store) => {
    store.put({ key: PREFS_KEY, declarationsEnabled: enabled } satisfies Prefs);
    if (!enabled) store.delete(SNAPSHOT_KEY);
  });
}

export async function readOfflineSnapshot(now: number = Date.now()): Promise<OfflineSnapshot | null> {
  return pruneSnapshot(await readRecord<OfflineSnapshot>(SNAPSHOT_KEY), now);
}

/** Lecture + fusion + écriture dans une seule transaction : deux onglets ne s'écrasent pas. */
export async function saveOfflineSnapshot(input: SnapshotInput): Promise<boolean> {
  return inTransaction("readwrite", (store) => {
    const request = store.get(SNAPSHOT_KEY);
    request.onsuccess = () => {
      const previous = pruneSnapshot(request.result as OfflineSnapshot | undefined, input.now);
      const merged = mergeSnapshot(previous, input);
      if (merged) store.put(merged);
    };
  });
}

/** Efface la copie des déclarations (déconnexion, session absente, bouton « Effacer de cet appareil »). Le réglage est conservé. */
export async function purgeOfflineSnapshot(): Promise<void> {
  await inTransaction("readwrite", (store) => { store.delete(SNAPSHOT_KEY); });
}

/** Au démarrage de l'espace patient : retire ce qui a plus de 7 jours (la lecture hors connexion les ignore déjà, ceci les supprime vraiment). */
export async function purgeExpiredOfflineData(now: number = Date.now()): Promise<void> {
  await inTransaction("readwrite", (store) => {
    const request = store.get(SNAPSHOT_KEY);
    request.onsuccess = () => {
      if (!request.result) return;
      const pruned = pruneSnapshot(request.result as OfflineSnapshot, now);
      if (!pruned) store.delete(SNAPSHOT_KEY);
      else store.put(pruned);
    };
  });
}

import {
  CACHE_DB_NAME,
  CACHE_ENTRY_STORE,
  CACHE_MAX_ENTRIES,
  CACHE_MAX_ENTRY_CHARS,
  CACHE_META_STORE,
  OFFLINE_CACHE_DEFAULT_ENABLED,
  OFFLINE_DB_NAME,
  OFFLINE_STORE_NAME,
  PREFS_KEY,
  cacheArea,
  cacheGroup,
  cacheTtlMs,
  isCacheablePath,
  isExpired,
  type CacheArea,
} from "./offline-policy";

/**
 * Copie locale CHIFFRÉE des lectures de l'API, pour naviguer sans réseau (voir `docs/PWA-HORS-CONNEXION.md`).
 *
 *  - Valeurs : AES-GCM 256, clé générée sur l'appareil, NON extractible (le navigateur ne la rend jamais en clair, pas même à ce code),
 *    enregistrée dans IndexedDB. Le nom de l'entrée est lié au chiffré (données authentifiées) : on ne peut pas échanger deux entrées.
 *  - Noms : « haché » par HMAC-SHA-256 avec une seconde clé non extractible. Un hachage simple se devinerait en essayant les adresses de l'API ;
 *    celui-ci non. Le contenu, lui, n'est jamais haché (un hachage ne se relit pas) : il est chiffré.
 *  - Effacer la base efface aussi les clés : les entrées restantes (sauvegardes, copies disque) deviennent illisibles pour toujours.
 *
 * Limite honnête : la clé vit sur le même appareil. Cela protège contre la lecture du stockage (copie du profil du navigateur, outil
 * d'inspection du disque) ; cela ne protège pas contre une personne qui utilise le navigateur ouvert, ni contre un script injecté dans le
 * site. D'où : durée courte, effacement à la déconnexion/au changement de compte, réglage « Hors connexion » dans chaque espace.
 *
 * Toutes les fonctions échouent en silence (navigation privée, stockage refusé, HTTP sans WebCrypto) : le site fonctionne sans cette copie.
 */
type EntryRow = { id: string; group: string; area: CacheArea; iv: string; ct: string; savedAt: number; expiresAt: number };
type MetaRow = { name: string; value: unknown };
type Keys = { aes: CryptoKey; hmac: CryptoKey };
type Handle = { db: IDBDatabase; keys: Keys };

const ACCOUNT_ROW = "account";
const ENABLED_MEMO_MS = 10_000;
const TRIM_EVERY_MS = 60_000;

let handlePromise: Promise<Handle | null> | null = null;
let enabledMemo: { value: boolean; at: number } | null = null;
let lastTrimAt = 0;

/* ---------- utilitaires ---------- */
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}
function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
const toHex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

function cryptoAvailable(): boolean {
  return typeof indexedDB !== "undefined" && typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
}

/* ---------- ouverture + clés ---------- */
function openRaw(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(CACHE_DB_NAME, 1); } catch { resolve(null); return; }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_ENTRY_STORE)) db.createObjectStore(CACHE_ENTRY_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CACHE_META_STORE)) db.createObjectStore(CACHE_META_STORE, { keyPath: "name" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function readMeta(db: IDBDatabase, name: string): Promise<unknown> {
  return new Promise((resolve) => {
    try {
      const request = db.transaction(CACHE_META_STORE, "readonly").objectStore(CACHE_META_STORE).get(name);
      request.onsuccess = () => resolve((request.result as MetaRow | undefined)?.value);
      request.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}

/** Lit les clés ; sinon en crée et les enregistre dans une transaction qui garde la première écrite (deux onglets ne s'écrasent pas). */
async function loadKeys(db: IDBDatabase): Promise<Keys | null> {
  const [aes, hmac] = await Promise.all([readMeta(db, "aes"), readMeta(db, "hmac")]);
  if (aes && hmac) return { aes: aes as CryptoKey, hmac: hmac as CryptoKey };
  const freshAes = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const freshHmac = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const chosen: Partial<Keys> = {};
  const ok = await new Promise<boolean>((resolve) => {
    try {
      const transaction = db.transaction(CACHE_META_STORE, "readwrite");
      const store = transaction.objectStore(CACHE_META_STORE);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
      const keep = (name: "aes" | "hmac", fresh: CryptoKey) => {
        const request = store.get(name);
        request.onsuccess = () => {
          const existing = request.result as MetaRow | undefined;
          if (existing?.value) chosen[name] = existing.value as CryptoKey;
          else { store.put({ name, value: fresh } satisfies MetaRow); chosen[name] = fresh; }
        };
      };
      keep("aes", freshAes);
      keep("hmac", freshHmac);
    } catch { resolve(false); }
  });
  return ok && chosen.aes && chosen.hmac ? { aes: chosen.aes, hmac: chosen.hmac } : null;
}

function getHandle(): Promise<Handle | null> {
  if (!cryptoAvailable()) return Promise.resolve(null);
  if (!handlePromise) {
    handlePromise = (async () => {
      const db = await openRaw();
      if (!db) return null;
      db.onversionchange = () => { db.close(); handlePromise = null; };
      const keys = await loadKeys(db);
      if (!keys) { db.close(); return null; }
      return { db, keys };
    })().catch(() => null);
    void handlePromise.then((handle) => { if (!handle) handlePromise = null; });
  }
  return handlePromise;
}

/* ---------- réglage (même interrupteur que la copie des déclarations) ---------- */
async function readPrefsEnabled(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  const db = await new Promise<IDBDatabase | null>((resolve) => {
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(OFFLINE_DB_NAME, 1); } catch { resolve(null); return; }
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(OFFLINE_STORE_NAME)) request.result.createObjectStore(OFFLINE_STORE_NAME, { keyPath: "key" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  if (!db) return OFFLINE_CACHE_DEFAULT_ENABLED;
  const prefs = await new Promise<{ declarationsEnabled?: boolean } | undefined>((resolve) => {
    try {
      const request = db.transaction(OFFLINE_STORE_NAME, "readonly").objectStore(OFFLINE_STORE_NAME).get(PREFS_KEY);
      request.onsuccess = () => resolve(request.result as { declarationsEnabled?: boolean } | undefined);
      request.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
  db.close();
  return prefs ? prefs.declarationsEnabled !== false : OFFLINE_CACHE_DEFAULT_ENABLED;
}

export async function isOfflineCacheEnabled(now: number = Date.now()): Promise<boolean> {
  if (enabledMemo && now - enabledMemo.at < ENABLED_MEMO_MS) return enabledMemo.value;
  const value = await readPrefsEnabled().catch(() => false);
  enabledMemo = { value, at: now };
  return value;
}
export function resetOfflineCacheEnabledMemo(): void { enabledMemo = null; }

/* ---------- chiffrement ---------- */
async function entryId(keys: Keys, path: string): Promise<string> {
  return toHex(await crypto.subtle.sign("HMAC", keys.hmac, encoder.encode(`entry|${path}`)));
}
async function groupId(keys: Keys, group: string): Promise<string> {
  return toHex(await crypto.subtle.sign("HMAC", keys.hmac, encoder.encode(`group|${group}`)));
}

/* ---------- opérations sur la base ---------- */
function transact(handle: Handle, stores: string[], work: (tx: IDBTransaction) => void): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const transaction = handle.db.transaction(stores.length === 1 ? stores[0] : stores, "readwrite");
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
      work(transaction);
    } catch { resolve(false); }
  });
}

function eachRow(store: IDBObjectStore, visit: (row: EntryRow, remove: () => void) => void): void {
  const request = store.openCursor();
  request.onsuccess = () => {
    const cursor = request.result as IDBCursorWithValue | null;
    if (!cursor) return;
    visit(cursor.value as EntryRow, () => { cursor.delete(); });
    cursor.continue();
  };
}

/** Efface les entrées (pas les clés), sauf celles qui passent `keep`. */
async function deleteEntries(handle: Handle, keep: (row: EntryRow) => boolean): Promise<void> {
  await transact(handle, [CACHE_ENTRY_STORE], (tx) => {
    eachRow(tx.objectStore(CACHE_ENTRY_STORE), (row, remove) => { if (!keep(row)) remove(); });
  });
}

/* ---------- API publique ---------- */

/** Au retour d'un `/identity/me/` : un autre compte sur le même appareil repart de zéro (aucun mélange de données entre comptes). */
async function bindAccount(handle: Handle, accountId: string): Promise<void> {
  const previous = await readMeta(handle.db, ACCOUNT_ROW);
  if (previous === accountId) return;
  if (previous !== undefined) await deleteEntries(handle, () => false);
  await transact(handle, [CACHE_META_STORE], (tx) => { tx.objectStore(CACHE_META_STORE).put({ name: ACCOUNT_ROW, value: accountId } satisfies MetaRow); });
}

function accountIdOf(path: string, text: string): string | null {
  if (path.split("?")[0] !== "/api/v1/identity/me/") return null;
  try {
    const id = (JSON.parse(text) as { data?: { id?: unknown } }).data?.id;
    return typeof id === "string" && id ? id : null;
  } catch { return null; }
}

/** Enregistre une lecture réussie (corps JSON en texte). Ignore silencieusement tout ce qui ne doit pas être gardé. */
export async function rememberResponse(path: string, text: string, now: number = Date.now()): Promise<boolean> {
  if (!isCacheablePath(path) || typeof text !== "string" || text.length === 0 || text.length > CACHE_MAX_ENTRY_CHARS) return false;
  const area = cacheArea(path);
  if (!area || !(await isOfflineCacheEnabled(now))) return false;
  const handle = await getHandle();
  if (!handle) return false;
  try {
    const accountId = accountIdOf(path, text);
    if (accountId) await bindAccount(handle, accountId);
    const id = await entryId(handle.keys, path);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = encoder.encode(JSON.stringify({ p: path, t: text }));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(id) }, handle.keys.aes, plain);
    const row: EntryRow = { id, group: await groupId(handle.keys, cacheGroup(path)), area, iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)), savedAt: now, expiresAt: now + cacheTtlMs(path) };
    const stored = await transact(handle, [CACHE_ENTRY_STORE], (tx) => { tx.objectStore(CACHE_ENTRY_STORE).put(row); });
    if (stored && now - lastTrimAt > TRIM_EVERY_MS) { lastTrimAt = now; void trimOfflineCache(handle); }
    return stored;
  } catch { return false; }
}

export type RecalledResponse = { text: string; savedAt: number };

/** Relit une copie : périmée ou illisible (clé changée, entrée altérée) → supprimée, jamais montrée. */
export async function recallResponse(path: string, now: number = Date.now()): Promise<RecalledResponse | null> {
  if (!isCacheablePath(path)) return null;
  const handle = await getHandle();
  if (!handle) return null;
  try {
    const id = await entryId(handle.keys, path);
    const row = await new Promise<EntryRow | undefined>((resolve) => {
      try {
        const request = handle.db.transaction(CACHE_ENTRY_STORE, "readonly").objectStore(CACHE_ENTRY_STORE).get(id);
        request.onsuccess = () => resolve(request.result as EntryRow | undefined);
        request.onerror = () => resolve(undefined);
      } catch { resolve(undefined); }
    });
    if (!row) return null;
    if (isExpired(row.savedAt, cacheTtlMs(path), now) || !(row.expiresAt > now)) {
      await deleteEntries(handle, (candidate) => candidate.id !== id);
      return null;
    }
    try {
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(row.iv), additionalData: encoder.encode(id) }, handle.keys.aes, fromBase64(row.ct));
      const parsed = JSON.parse(decoder.decode(plain)) as { p?: unknown; t?: unknown };
      if (parsed.p !== path || typeof parsed.t !== "string") throw new Error("entrée incohérente");
      return { text: parsed.t, savedAt: row.savedAt };
    } catch {
      await deleteEntries(handle, (candidate) => candidate.id !== id);
      return null;
    }
  } catch { return null; }
}

/** Après une écriture réussie : les lectures de la même ressource ne doivent pas ressortir périmées. */
export async function invalidateGroupOf(path: string): Promise<void> {
  const handle = await getHandle();
  if (!handle) return;
  try {
    const target = await groupId(handle.keys, cacheGroup(path));
    await deleteEntries(handle, (row) => row.group !== target);
  } catch { /* la copie se périmera d'elle-même */ }
}

/** Efface toute la copie (entrées ET clés) : déconnexion, session absente, changement de compte, réglage coupé, « Effacer de cet appareil ». */
export async function purgeOfflineCache(): Promise<void> {
  if (!cryptoAvailable()) return;
  const handle = await getHandle();
  if (!handle) return;
  await transact(handle, [CACHE_ENTRY_STORE, CACHE_META_STORE], (tx) => {
    const sweep = (name: string) => {
      const request = tx.objectStore(name).openCursor();
      request.onsuccess = () => {
        const cursor = request.result as IDBCursorWithValue | null;
        if (!cursor) return;
        cursor.delete();
        cursor.continue();
      };
    };
    sweep(CACHE_ENTRY_STORE);
    sweep(CACHE_META_STORE);
  });
  handle.db.close();
  handlePromise = null;
  enabledMemo = null;
}

/** Changement de profil, d'espace ou d'établissement actif : tout sauf l'identité du compte (la même personne). */
export async function purgeScopedEntries(): Promise<void> {
  const handle = await getHandle();
  if (!handle) return;
  await deleteEntries(handle, (row) => row.area === "identity");
}

/** Retire ce qui a dépassé sa durée (la lecture l'ignore déjà ; ceci le supprime vraiment) et plafonne le nombre d'entrées. */
export async function trimOfflineCache(existing?: Handle | null, now: number = Date.now()): Promise<void> {
  const handle = existing ?? (await getHandle());
  if (!handle) return;
  const rows: EntryRow[] = [];
  await transact(handle, [CACHE_ENTRY_STORE], (tx) => {
    eachRow(tx.objectStore(CACHE_ENTRY_STORE), (row, remove) => {
      if (!(row.expiresAt > now)) remove();
      else rows.push(row);
    });
  });
  if (rows.length <= CACHE_MAX_ENTRIES) return;
  const survivors = new Set(rows.sort((a, b) => b.savedAt - a.savedAt).slice(0, CACHE_MAX_ENTRIES).map((row) => row.id));
  await deleteEntries(handle, (row) => survivors.has(row.id));
}

/** Pour les tests : oublie la base ouverte (la suivante repart d'une ouverture neuve). */
export function resetOfflineCacheForTests(): void {
  handlePromise = null;
  enabledMemo = null;
  lastTrimAt = 0;
}

import {
  NETWORK_ERROR_MESSAGE,
  NETWORK_FAILURE_EVENT,
  SERVED_FROM_COPY_EVENT,
  WRITE_OFFLINE_MESSAGE,
  isFetchNetworkFailure,
} from "./network-status";
import { OFFLINE_COPY_HEADER, changesSessionScope, isCacheablePath } from "./offline-policy";
import { invalidateGroupOf, purgeOfflineCache, purgeScopedEntries, recallResponse, rememberResponse } from "./offline-cache";

/**
 * Relais autour de `fetch` pour les appels de ce site vers son API (`/api/v1/…`, même origine). Il est posé UNE fois, avant tout
 * composant (import à effet de bord dans `NetworkProvider`), et couvre donc aussi les écrans qui n'utilisent pas `apiGet`
 * (paramètres, accès, etc.) :
 *
 *  - lecture (GET) réussie  → copie chiffrée en tâche de fond (si le réglage « Hors connexion » est actif, voir `offline-cache.ts`) ;
 *  - lecture sans réseau    → réponse reconstruite depuis la copie, marquée par l'en-tête `X-Ecarnet-Offline-Copy`, sinon erreur claire ;
 *  - écriture sans réseau   → erreur claire, rien n'est mis en attente (aucune synchronisation montante) ;
 *  - écriture réussie       → les lectures de la même ressource sont retirées de la copie ; un changement de compte, d'espace, de profil ou
 *                             d'établissement actif efface la copie.
 *
 * Les erreurs restent des `TypeError` (le code qui teste `instanceof TypeError` ne change pas) ; seul leur texte devient lisible.
 * Un délai dépassé (AbortError) n'est PAS traité comme une absence de réseau : le serveur peut simplement se réveiller.
 */
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Env = {
  fetch: FetchLike;
  location: { origin: string };
  navigator?: { onLine?: boolean };
  dispatchEvent?: (event: Event) => boolean;
};

const MARK = "__ecarnetOfflineRelay";
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function describe(input: RequestInfo | URL, init: RequestInit | undefined, origin: string): { path: string; method: string; credentials: string | undefined } | null {
  let raw = "";
  let method = init?.method;
  let credentials = init?.credentials;
  if (typeof input === "string") raw = input;
  else if (typeof URL !== "undefined" && input instanceof URL) raw = input.href;
  else if (input && typeof input === "object" && "url" in input) {
    raw = (input as Request).url;
    method = method ?? (input as Request).method;
    credentials = credentials ?? (input as Request).credentials;
  }
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw, origin); } catch { return null; }
  if (url.origin !== origin || !url.pathname.startsWith("/api/v1/")) return null;
  return { path: `${url.pathname}${url.search}`, method: (method ?? "GET").toUpperCase(), credentials };
}

function networkError(cause: unknown, write: boolean): TypeError {
  return new TypeError(write ? WRITE_OFFLINE_MESSAGE : NETWORK_ERROR_MESSAGE, { cause });
}

function announce(env: Env, name: string, detail?: unknown): void {
  try {
    if (env.dispatchEvent && typeof CustomEvent !== "undefined") env.dispatchEvent(new CustomEvent(name, { detail }));
  } catch { /* sans importance : l'information est facultative */ }
}

function copyResponse(text: string, savedAt: number): Response {
  return new Response(text, { status: 200, headers: { "Content-Type": "application/json", [OFFLINE_COPY_HEADER]: new Date(savedAt).toISOString() } });
}

async function afterWrite(path: string, method: string): Promise<void> {
  if (changesSessionScope(path, method)) {
    const route = path.split("?")[0];
    // Connexion, déconnexion, choix d'espace : autre contexte → copie entière effacée. Profil enfant / établissement actif : tout sauf l'identité.
    if (route.startsWith("/api/v1/identity/")) await purgeOfflineCache();
    else await purgeScopedEntries();
    return;
  }
  if (isCacheablePath(path)) await invalidateGroupOf(path);
}

export function installOfflineFetch(env?: Env): () => void {
  const target = (env ?? (globalThis as unknown as Env));
  if (!target || typeof target.fetch !== "function" || !target.location) return () => undefined;
  const original = target.fetch;
  if ((original as unknown as Record<string, unknown>)[MARK]) return () => undefined;
  const call = (input: RequestInfo | URL, init?: RequestInit) => original.call(target, input, init);

  const relay: FetchLike = async (input, init) => {
    const info = describe(input, init, target.location.origin);
    if (!info) return call(input, init);
    const offline = target.navigator?.onLine === false;

    if (WRITE_METHODS.has(info.method)) {
      if (offline) throw networkError(undefined, true);
      let response: Response;
      try { response = await call(input, init); } catch (error) {
        if (!isFetchNetworkFailure(error)) throw error;
        announce(target, NETWORK_FAILURE_EVENT);
        throw networkError(error, true);
      }
      if (response.ok) void afterWrite(info.path, info.method).catch(() => undefined);
      return response;
    }

    if (info.method !== "GET") return call(input, init);

    const cacheable = isCacheablePath(info.path) && info.credentials !== "omit";
    const serveCopy = async (cause: unknown): Promise<Response> => {
      const hit = cacheable ? await recallResponse(info.path) : null;
      if (hit) {
        announce(target, SERVED_FROM_COPY_EVENT, { savedAt: hit.savedAt });
        return copyResponse(hit.text, hit.savedAt);
      }
      throw networkError(cause, false);
    };

    if (offline) return serveCopy(undefined);
    let response: Response;
    try { response = await call(input, init); } catch (error) {
      if (!isFetchNetworkFailure(error)) throw error; // délai dépassé, annulation : pas une absence de réseau
      announce(target, NETWORK_FAILURE_EVENT);
      return serveCopy(error);
    }
    if (cacheable && response.ok && response.status === 200 && (response.headers.get("content-type") ?? "").includes("json")) {
      void response.clone().text().then((text) => rememberResponse(info.path, text)).catch(() => undefined);
    }
    return response;
  };
  (relay as unknown as Record<string, unknown>)[MARK] = true;
  target.fetch = relay;
  return () => { if (target.fetch === relay) target.fetch = original; };
}

// Posé à l'import côté navigateur, avant les effets des composants (les parents s'exécutent après leurs enfants).
if (typeof window !== "undefined") installOfflineFetch(window as unknown as Env);

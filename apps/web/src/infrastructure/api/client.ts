export const API_URL = "";

export class ApiError extends Error {
  status: number;
  /** Corps JSON renvoyé par l'API (ex. `errors` champ par champ) : permet aux formulaires de désigner le champ fautif. */
  details: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

/* ---------- CSRF ----------
   Le proxy Next.js expose l’API sur la même origine que le web. Le jeton renvoyé par /api/v1/csrf/ est gardé en
   mémoire afin d’éviter de dépendre d’une lecture manuelle du cookie. */
let memoryToken = "";
const COOKIE_PREFIX = "csrftoken=";

/** Valeur du cookie csrftoken. « csrftoken= » compte 10 caractères : slice(9) laissait un « = » en tête et Django rejetait tout. */
export function csrfFromCookie(cookie: string): string {
  const part = cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(COOKIE_PREFIX));
  return part ? decodeURIComponent(part.slice(COOKIE_PREFIX.length)) : "";
}

export function readCsrfToken(): string {
  return memoryToken || (typeof document === "undefined" ? "" : csrfFromCookie(document.cookie));
}

/** À appeler avant toute écriture. Renvoie la réponse pour que les appelants puissent tester `.ok`. */
export async function primeCsrf(): Promise<Response> {
  const response = await fetch(`${API_URL}/api/v1/csrf/`, { credentials: "include", cache: "no-store" });
  if (response.ok) {
    const payload = await response.clone().json().catch(() => null) as { csrfToken?: string } | null;
    if (payload?.csrfToken) memoryToken = payload.csrfToken;
  }
  return response;
}

/* ---------- requêtes JSON ---------- */
function flatten(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(flatten).filter(Boolean).join(" ");
  return "";
}

async function parse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.message ?? flatten(payload?.detail ?? payload);
    const fallback = response.status === 429 ? "Trop de tentatives. Patientez quelques minutes avant de réessayer." : "Le service est momentanément indisponible.";
    throw new ApiError(detail || fallback, response.status, payload);
  }
  return payload.data as T;
}

export async function apiGet<T>(path: string, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await parse<T>(await fetch(`${API_URL}${path}`, { credentials: "include", cache: "no-store", signal: controller.signal }));
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Connexion lente, on réessaie. Vérifiez votre réseau puis réessayez.", 0);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const PRODUCT_ACTION_EXCLUSIONS = [
  "/api/v1/professionals/onboarding/",
  "/api/v1/establishments/active/",
  "/api/v1/establishments/join-codes/redeem/",
];

function isProductAction(path: string) {
  const route = path.split("?")[0];
  if (PRODUCT_ACTION_EXCLUSIONS.some((prefix) => route.startsWith(prefix))) return false;
  return route.startsWith("/api/v1/patient/declarations/")
    || route.startsWith("/api/v1/patient/profile/")
    || route.startsWith("/api/v1/patient/care/")
    || route.startsWith("/api/v1/professionals/")
    || (route.startsWith("/api/v1/establishments/") && (route.includes("/join-codes/") || route.includes("/memberships/")));
}

/** Notify the global tracker after a successful, user-visible product mutation. */
export function notifyProductActionCompleted(path: string, method: string) {
  if (typeof window !== "undefined" && method !== "GET" && isProductAction(path)) {
    window.dispatchEvent(new Event("ecarnet:product-action-completed"));
  }
}

/* ---------- écritures : clé d'idempotence, délai maximal, reprises (SEC-05) ----------
   Chaque action de la personne reçoit une clé `Idempotency-Key` ; l'API rejoue la réponse déjà calculée si la même clé
   revient (réponse perdue, double clic), au lieu d'exécuter l'écriture deux fois. Cela rend la reprise automatique sûre :
   jusqu'à 3 essais, seulement après une panne réseau, un délai dépassé ou un 502/503/504, avec attente croissante et
   aléatoire. Une réponse de l'API (400, 403, 409…) n'est jamais reprise. Les erreurs réseau restent des `TypeError`
   (le reste de l'application teste `instanceof TypeError`). */
export const WRITE_TIMEOUT_MS = 20000;
export const UPLOAD_TIMEOUT_MS = 60000;
export const MAX_WRITE_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

export function newIdempotencyKey(): string {
  const webCrypto = typeof crypto === "undefined" ? undefined : crypto;
  if (webCrypto?.randomUUID) return webCrypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (webCrypto?.getRandomValues) webCrypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Attente avant la reprise n° `attempt` (1, 2…) : 400 ms puis 800 ms, réduite de 0 à 50 % au hasard pour étaler les reprises. */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  return Math.round(400 * 2 ** (attempt - 1) * (0.5 + random() * 0.5));
}

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function sendWrite<T>(path: string, init: { method: string; headers?: Record<string, string>; body?: BodyInit }, timeoutMs: number): Promise<T> {
  const csrf = await primeCsrf();
  if (!csrf.ok) throw new ApiError("Impossible d’établir la session de sécurité.", csrf.status);
  const idempotencyKey = newIdempotencyKey();
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${API_URL}${path}`, {
        ...init,
        credentials: "include",
        headers: { ...init.headers, "X-CSRFToken": readCsrfToken(), "Idempotency-Key": idempotencyKey },
        signal: controller.signal,
      });
      if (!isRetryableStatus(response.status) || attempt === MAX_WRITE_ATTEMPTS) return await parse<T>(response);
      lastError = new ApiError("Le service est momentanément indisponible.", response.status);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      lastError = error;
      // Hors connexion : inutile d'attendre, l'appelant (file hors ligne) doit le savoir tout de suite.
      if (typeof navigator !== "undefined" && navigator.onLine === false) break;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_WRITE_ATTEMPTS) await sleep(retryDelayMs(attempt));
  }
  if (lastError instanceof DOMException && lastError.name === "AbortError") {
    throw new ApiError("La demande prend trop de temps. Vérifiez votre réseau puis réessayez.", 0);
  }
  throw lastError;
}

/** Une même écriture identique lancée deux fois en même temps (double clic) ne part qu'une fois : les appelants partagent la réponse. */
const writesInFlight = new Map<string, Promise<unknown>>();

export function apiSend<T>(method: "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const signature = `${method} ${path} ${payload ?? ""}`;
  const running = writesInFlight.get(signature) as Promise<T> | undefined;
  if (running) return running;
  const promise = sendWrite<T>(path, { method, headers: { "Content-Type": "application/json" }, body: payload }, WRITE_TIMEOUT_MS)
    .then((result) => { notifyProductActionCompleted(path, method); return result; })
    .finally(() => { writesInFlight.delete(signature); });
  writesInFlight.set(signature, promise);
  return promise;
}

export const apiPost = <T,>(path: string, body: unknown = {}) => apiSend<T>("POST", path, body);

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const result = await sendWrite<T>(path, { method: "POST", body: form }, UPLOAD_TIMEOUT_MS);
  notifyProductActionCompleted(path, "POST");
  return result;
}

export async function apiUploadPatch<T>(path: string, form: FormData): Promise<T> {
  const result = await sendWrite<T>(path, { method: "PATCH", body: form }, UPLOAD_TIMEOUT_MS);
  notifyProductActionCompleted(path, "PATCH");
  return result;
}

export const apiPatch = <T,>(path: string, body: unknown) => apiSend<T>("PATCH", path, body);
export const apiPut = <T,>(path: string, body: unknown) => apiSend<T>("PUT", path, body);
export const apiDelete = <T,>(path: string) => apiSend<T>("DELETE", path);

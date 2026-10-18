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

export async function apiSend<T>(method: "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  const csrf = await primeCsrf();
  if (!csrf.ok) throw new ApiError("Impossible d’établir la session de sécurité.", csrf.status);
  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": readCsrfToken() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await parse<T>(response);
  notifyProductActionCompleted(path, method);
  return result;
}

export const apiPost = <T,>(path: string, body: unknown = {}) => apiSend<T>("POST", path, body);

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const csrf = await primeCsrf();
  if (!csrf.ok) throw new ApiError("Impossible d’établir la session de sécurité.", csrf.status);
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRFToken": readCsrfToken() },
    body: form,
  });
  const result = await parse<T>(response);
  notifyProductActionCompleted(path, "POST");
  return result;
}

export async function apiUploadPatch<T>(path: string, form: FormData): Promise<T> {
  const csrf = await primeCsrf();
  if (!csrf.ok) throw new ApiError("Impossible d’établir la session de sécurité.", csrf.status);
  const response = await fetch(`${API_URL}${path}`, { method: "PATCH", credentials: "include", headers: { "X-CSRFToken": readCsrfToken() }, body: form });
  const result = await parse<T>(response);
  notifyProductActionCompleted(path, "PATCH");
  return result;
}

export const apiPatch = <T,>(path: string, body: unknown) => apiSend<T>("PATCH", path, body);
export const apiPut = <T,>(path: string, body: unknown) => apiSend<T>("PUT", path, body);
export const apiDelete = <T,>(path: string) => apiSend<T>("DELETE", path);

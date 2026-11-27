import { API_URL, ApiError } from "./client";

/* Client du portail de surveillance (/surveillance). Il n'utilise PAS la session d'un compte Mon E-Carnet : l'accès repose sur un cookie propre au
   portail (HttpOnly, invisible d'ici) et sur le jeton de sécurité remis à la connexion, renvoyé dans l'en-tête X-Ops-Csrf pour toute modification.
   Le jeton vit en mémoire seulement : après un rechargement de la page, `opsSession()` le redemande tant que le cookie est valable. */
let csrf = "";
export const OPS_API = "/api/v1/identity/ops";

type Envelope<T> = { success?: boolean; data?: T; message?: string; code?: string };

async function request<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method, credentials: "include", cache: "no-store",
      headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(csrf ? { "X-Ops-Csrf": csrf } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Connexion impossible. Vérifiez votre réseau puis réessayez.", 0);
  }
  let payload: Envelope<T> | null = null;
  try { payload = (await response.json()) as Envelope<T>; } catch { payload = null; }
  if (!response.ok) throw new ApiError(payload?.message || (response.status === 429 ? "Trop d’essais. Patientez quelques minutes." : "La demande n’a pas pu aboutir."), response.status, payload);
  return (payload?.data ?? (null as T));
}

export async function opsLogin(identifier: string, secret: string): Promise<void> {
  const data = await request<{ csrf: string }>("POST", `${OPS_API}/login/`, { identifier, secret });
  csrf = data.csrf;
}
/** Redemande le jeton si le cookie du portail est encore valable (après un rechargement de page). Renvoie false si la session est absente ou expirée. */
export async function opsSession(): Promise<boolean> {
  try {
    csrf = (await request<{ csrf: string }>("GET", `${OPS_API}/session/`)).csrf;
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) throw error;
    return false;
  }
}
export async function opsLogout(): Promise<void> {
  csrf = "";
  try { await request("POST", `${OPS_API}/logout/`, {}); } catch { /* la session expire de toute façon */ }
}
export const opsGet = <T,>(path: string) => request<T>("GET", path);
export const opsPatch = <T,>(path: string, body: unknown) => request<T>("PATCH", path, body);

/* Version de l'application et détection d'une nouvelle version déployée.
   NEXT_PUBLIC_APP_VERSION et NEXT_PUBLIC_BUILD_ID sont figés au build (next.config.ts). Le serveur répond avec les valeurs de SA version
   (/api/app-version) : si l'identifiant de build du serveur diffère de celui du code qui tourne dans l'appareil, une mise à jour est disponible. */

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
export const APP_BUILD = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

export type UpdateStatus = "checking" | "current" | "available" | "offline" | "unknown";
export type LatestBuild = { version: string; build: string };

/** « dev » (build sans identifiant) ne peut pas être comparé : on ne prétend jamais qu'une mise à jour existe. */
export function statusFor(running: string, latest: string | null | undefined): UpdateStatus {
  if (!latest) return "unknown";
  if (running === "dev" || latest === "dev") return "current";
  return running === latest ? "current" : "available";
}

export const UPDATE_LABELS: Record<UpdateStatus, string> = {
  checking: "Vérification…",
  current: "À jour",
  available: "Mise à jour disponible",
  offline: "Hors connexion",
  unknown: "Vérification impossible",
};

export function parseLatestBuild(payload: unknown): LatestBuild | null {
  if (!payload || typeof payload !== "object") return null;
  const { version, build } = payload as Record<string, unknown>;
  if (typeof version !== "string" || typeof build !== "string" || !build) return null;
  return { version: version.slice(0, 32), build: build.slice(0, 64) };
}

export async function fetchLatestBuild(timeoutMs = 8000): Promise<LatestBuild | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("/api/app-version", { cache: "no-store", credentials: "omit", signal: controller.signal });
    if (!response.ok) return null;
    return parseLatestBuild(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

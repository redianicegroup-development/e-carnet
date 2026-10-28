import { API_URL, primeCsrf, readCsrfToken } from "../infrastructure/api/client";

const BASE = `${API_URL}/api/v1/patient/care/push`;

export type PushSupport = "ok" | "ios-install" | "unsupported";
export type PushResult = "subscribed" | "denied" | "unavailable" | "error";

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Sur iPhone/iPad, le Web Push n’existe que si l’application est ajoutée à l’écran d’accueil (iOS 16.4 minimum). */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (isIos() && !isStandalone()) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return "ok";
}

/** La clé VAPID est en base64 « URL-safe » : atob() seul la rejette (caractères - et _). */
export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function activeRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready; // pushManager.subscribe exige un service worker actif
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function sendToServer(method: "POST" | "DELETE", body: unknown): Promise<boolean> {
  const csrf = await primeCsrf();
  if (!csrf.ok) return false;
  const response = await fetch(`${BASE}/subscriptions/`, {
    method,
    headers: { "Content-Type": "application/json", "X-CSRFToken": readCsrfToken() },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return response.ok;
}

/** À appeler directement depuis un clic : iOS exige que la demande de permission soit dans le geste de l’utilisateur. */
export async function subscribeToPush(): Promise<PushResult> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
    const keyResponse = await fetch(`${BASE}/vapid-key/`, { credentials: "include", cache: "no-store" });
    const key = (await keyResponse.json().catch(() => null))?.data as { enabled?: boolean; public_key?: string } | undefined;
    if (!keyResponse.ok || !key?.enabled || !key.public_key) return "unavailable";
    const registration = await activeRegistration();
    const subscription = (await registration.pushManager.getSubscription())
      ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key.public_key) }));
    if (await sendToServer("POST", { subscription: subscription.toJSON() })) return "subscribed";
    await subscription.unsubscribe(); // le serveur a refusé : on ne garde pas un abonnement orphelin
    return "error";
  } catch {
    return "error";
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await sendToServer("DELETE", { endpoint: subscription.endpoint }).catch(() => false);
  await subscription.unsubscribe();
}

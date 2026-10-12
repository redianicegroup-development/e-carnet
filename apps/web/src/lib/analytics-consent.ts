export type AnalyticsConsent = "accepted" | "denied";

const CONSENT_COOKIE = "ecarnet_analytics_consent";
const CONSENT_EVENT = "ecarnet:analytics-consent-change";

export function getAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${CONSENT_COOKIE}=`));
  const value = entry?.slice(CONSENT_COOKIE.length + 1);
  return value === "accepted" || value === "denied" ? value : null;
}

export function hasAnalyticsConsent(): boolean {
  return getAnalyticsConsent() === "accepted";
}

export function saveAnalyticsConsent(value: AnalyticsConsent): void {
  if (typeof window === "undefined") return;
  const maxAge = 60 * 60 * 24 * 180;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

export function subscribeAnalyticsConsent(onChange: () => void): () => void {
    const listener = (event: Event) => {
    const value = (event as CustomEvent<AnalyticsConsent>).detail;
    if (value === "accepted" || value === "denied") onChange();
  };
  window.addEventListener(CONSENT_EVENT, listener);
  return () => window.removeEventListener(CONSENT_EVENT, listener);
}

export function requestAnalyticsPreferences(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("ecarnet:open-cookie-preferences"));
}

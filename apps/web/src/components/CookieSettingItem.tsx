"use client";

import { useSyncExternalStore } from "react";
import { getAnalyticsConsent, saveAnalyticsConsent, subscribeAnalyticsConsent, type AnalyticsConsent } from "../lib/analytics-consent";
import { Icon } from "./ui/Icon";

const LABEL = { accepted: "accepté", denied: "refusé", none: "pas encore choisi" } as const;

/* Réglage de la mesure d'audience dans les paramètres : le choix se change sur place, sans rouvrir la bannière par‑dessus
   la fenêtre des paramètres (qui garde le focus). Même cookie de choix que la bannière. */
export function CookieSettingItem() {
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, () => null);
  const choose = (value: AnalyticsConsent) => saveAnalyticsConsent(value);
  return (
    <div className="setting-item cookie-setting" role="group" aria-label="Mesure d’audience (cookie facultatif)">
      <span className="setting-item__icon" aria-hidden="true"><Icon name="lock" /></span>
      <span className="setting-item__meta">
        <strong>Cookie de mesure d’audience</strong>
        <span>Facultatif, sans publicité ni suivi tiers. Choix actuel : {LABEL[consent ?? "none"]}.</span>
      </span>
      <span className="cookie-setting__choices">
        <button type="button" className="button" aria-pressed={consent === "accepted"} onClick={() => choose("accepted")}>Accepter</button>
        <button type="button" className="button" aria-pressed={consent === "denied"} onClick={() => choose("denied")}>Refuser</button>
      </span>
    </div>
  );
}

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { getAnalyticsConsent, requestAnalyticsPreferences, saveAnalyticsConsent, subscribeAnalyticsConsent } from "../lib/analytics-consent";

export function CookieConsentBanner() {
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, () => null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("ecarnet:open-cookie-preferences", onOpen);
    const unsubscribe = subscribeAnalyticsConsent(() => setOpen(false));
    return () => {
      window.removeEventListener("ecarnet:open-cookie-preferences", onOpen);
      unsubscribe();
    };
  }, []);

  if (consent && !open) return null;
  return <aside className="cookie-consent" aria-label="Préférences des cookies" data-open={open}>
    <div className="cookie-consent__illustration" aria-hidden="true"><Image src="/cartoon-cookie-choice.svg" alt="" width={104} height={104} unoptimized /></div>
    <div className="cookie-consent__copy">
      <span className="cookie-consent__eyebrow">Votre choix, vos données</span>
      <h2>Un petit cookie, à votre convenance.</h2>
      <p>Les cookies nécessaires assurent le fonctionnement du carnet. Avec votre accord, un cookie interne facultatif nous aide à mesurer l’audience, sans publicité ni suivi tiers.</p>
      <a href="/confidentialite#cookies">En savoir plus sur les cookies</a>
      <div className="cookie-consent__actions">
        <button type="button" className="cookie-consent__accept" onClick={() => saveAnalyticsConsent("accepted")}>Accepter la mesure</button>
        <button type="button" className="cookie-consent__reject" onClick={() => saveAnalyticsConsent("denied")}>Refuser</button>
      </div>
    </div>
  </aside>;
}

export function CookiePreferencesLink({ children = "Modifier mon choix concernant les cookies" }: { children?: ReactNode }) {
  return <button type="button" className="cookie-preferences-link" onClick={requestAnalyticsPreferences}>{children}</button>;
}

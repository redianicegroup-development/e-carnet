"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { getAnalyticsConsent, requestAnalyticsPreferences, saveAnalyticsConsent, subscribeAnalyticsConsent, type AnalyticsConsent } from "../lib/analytics-consent";
import { CookieIllustration } from "./consent/CookieIllustration";

type Reaction = "accept" | "reject" | null;
const LEAVE_MS = 240;
const SAVED_TEXT: Record<AnalyticsConsent, string> = {
  accepted: "Choix enregistré : la mesure d’audience est acceptée.",
  denied: "Choix enregistré : la mesure d’audience est refusée.",
};

/* Rendu serveur : « pending » (rien d'affiché). Avant, la bannière était rendue côté serveur puis retirée à l'hydratation
   pour les visiteurs ayant déjà choisi : elle clignotait à chaque page. */
const serverSnapshot = (): AnalyticsConsent | null | "pending" => "pending";

export function CookieConsentBanner() {
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, serverSnapshot);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [reaction, setReaction] = useState<Reaction>(null);
  const [saved, setSaved] = useState("");
  const titleId = useId();
  const textId = useId();
  const acceptButton = useRef<HTMLButtonElement>(null);
  const leaveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onOpen = () => { window.clearTimeout(leaveTimer.current); setLeaving(false); setSaved(""); setOpen(true); };
    window.addEventListener("ecarnet:open-cookie-preferences", onOpen);
    return () => window.removeEventListener("ecarnet:open-cookie-preferences", onOpen);
  }, []);
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  // Réouverture voulue par la personne : le focus va sur la bannière (sinon un clavier devrait parcourir toute la page).
  useEffect(() => { if (open) acceptButton.current?.focus(); }, [open]);

  const leave = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setOpen(false); return; }
    setLeaving(true);
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => { setLeaving(false); setOpen(false); }, LEAVE_MS);
  }, []);

  const choose = useCallback((value: AnalyticsConsent) => {
    setReaction(value === "accepted" ? "accept" : "reject");
    saveAnalyticsConsent(value);
    setSaved(SAVED_TEXT[value]);
    leave();
  }, [leave]);

  // Échap ferme la bannière uniquement quand la personne l'a rouverte : au premier affichage, un choix reste attendu.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") leave(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, leave]);

  const liveRegion = <p className="sr-only" role="status" aria-live="polite">{saved}</p>;
  if (consent === "pending") return liveRegion;
  const visible = consent === null || open || leaving;
  if (!visible) return liveRegion;

  const reopened = consent !== null;
  return <>
    {liveRegion}
    <aside className="cookie-consent" role="dialog" aria-modal="false" aria-labelledby={titleId} aria-describedby={textId} data-open={open} data-reaction={reaction ?? undefined} data-leaving={leaving || undefined}>
      {reopened && <button type="button" className="cookie-consent__close" aria-label="Fermer sans modifier mon choix" onClick={leave}>×</button>}
      <div className="cookie-consent__illustration" aria-hidden="true"><CookieIllustration /></div>
      <div className="cookie-consent__copy">
        <span className="cookie-consent__eyebrow">Votre choix, vos données</span>
        <h2 id={titleId}>Un petit cookie, à votre convenance.</h2>
        <p id={textId}>Les cookies nécessaires assurent le fonctionnement du carnet. Avec votre accord, un cookie interne facultatif nous aide à mesurer l’audience, sans publicité ni suivi tiers.</p>
        {reopened && <p className="cookie-consent__current">Choix actuel : {consent === "accepted" ? "accepté" : "refusé"}.</p>}
        <Link href="/confidentialite#cookies">En savoir plus sur les cookies</Link>
        <div className="cookie-consent__actions">
          <button ref={acceptButton} type="button" className="button primary cookie-consent__accept" onClick={() => choose("accepted")} onMouseEnter={() => setReaction("accept")} onMouseLeave={() => setReaction(null)} onFocus={() => setReaction("accept")} onBlur={() => setReaction(null)}>Accepter</button>
          <button type="button" className="button cookie-consent__reject" onClick={() => choose("denied")} onMouseEnter={() => setReaction("reject")} onMouseLeave={() => setReaction(null)} onFocus={() => setReaction("reject")} onBlur={() => setReaction(null)}>Refuser</button>
        </div>
      </div>
    </aside>
  </>;
}

export function CookiePreferencesLink({ children = "Modifier mon choix concernant les cookies", className = "cookie-preferences-link" }: { children?: ReactNode; className?: string }) {
  return <button type="button" className={className} onClick={requestAnalyticsPreferences}>{children}</button>;
}

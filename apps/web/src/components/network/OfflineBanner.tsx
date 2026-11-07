"use client";

import { useEffect, useRef } from "react";
import { OFFLINE_BANNER_TEXT, OFFLINE_BANNER_TITLE, RESTORED_BANNER_TITLE, formatCopyDate } from "../../lib/network-status";
import { useNetwork } from "./NetworkProvider";

/** Bandeau en haut de l'application (tous les espaces et les pages publiques) : coupure, puis retour de la connexion. */
export function OfflineBanner() {
  const { phase, servedFromCopyAt, refreshPending, refreshed, refreshNow } = useNetwork();
  const barRef = useRef<HTMLDivElement>(null);
  const visible = phase !== "online";

  // La hauteur du bandeau décale les barres collantes (--net-banner-h, voir sidebar.css et site-pages.css).
  useEffect(() => {
    const root = document.documentElement;
    const bar = barRef.current;
    if (!visible || !bar) { root.style.removeProperty("--net-banner-h"); return; }
    const update = () => root.style.setProperty("--net-banner-h", `${bar.offsetHeight}px`);
    update();
    if (typeof ResizeObserver === "undefined") return () => root.style.removeProperty("--net-banner-h");
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    return () => { observer.disconnect(); root.style.removeProperty("--net-banner-h"); };
  }, [visible]);

  const copyDate = formatCopyDate(servedFromCopyAt);
  return (
    <div className="net-banner-slot" role="status" aria-live="polite">
      {phase === "offline" && (
        <div ref={barRef} className="net-banner net-banner--offline">
          <svg className="net-banner__icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-9-3.7M5 12.9a10 10 0 0 1 3-1.9M19 12.9a10 10 0 0 0-4.6-2.6M8.5 16.4a5 5 0 0 1 2.6-1.3M15.5 16.4a5 5 0 0 0-1.1-.8" />
            <path d="M12 20h.01M3 3l18 18" />
          </svg>
          <p className="net-banner__text">
            <strong>{OFFLINE_BANNER_TITLE}</strong>{" "}
            <span>{copyDate ? `Vous consultez la copie enregistrée sur cet appareil (${copyDate}). ${OFFLINE_BANNER_TEXT.split(". ")[0]}.` : OFFLINE_BANNER_TEXT}</span>
          </p>
        </div>
      )}
      {phase === "restored" && (
        <div ref={barRef} className="net-banner net-banner--restored">
          <svg className="net-banner__icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 8.8a15 15 0 0 1 20 0M5 12.9a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0M12 20h.01" />
          </svg>
          <p className="net-banner__text">
            <strong>{RESTORED_BANNER_TITLE}</strong>{" "}
            <span>{refreshPending ? "Vos saisies en cours sont conservées : actualisez quand vous aurez terminé." : refreshed ? "Vos données ont été mises à jour." : "Vous êtes de nouveau en ligne."}</span>
          </p>
          {refreshPending ? <button type="button" className="net-banner__action" onClick={refreshNow}>Actualiser</button> : null}
        </div>
      )}
    </div>
  );
}

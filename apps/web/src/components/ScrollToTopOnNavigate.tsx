"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { PENDING_SCROLL_KEY, SCROLL_TOP_ZONES, decideScrollOnClick, readPendingScroll, serializePendingScroll } from "../lib/scroll-to-top";

function scrollInstantlyToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

function forgetPending() {
  try { window.sessionStorage.removeItem(PENDING_SCROLL_KEY); } catch { /* sessionStorage indisponible */ }
}

/** Les liens du pied de page, de la navigation des espaces, de « Aide » et de « En savoir plus » ouvrent la nouvelle page en haut ;
    les liens d’ancre gardent leur cible. À monter une fois par structure de page (pages publiques, espaces). */
export function ScrollToTopOnNavigate() {
  const pathname = usePathname();

  useEffect(() => {
    let raw: string | null = null;
    try { raw = window.sessionStorage.getItem(PENDING_SCROLL_KEY); } catch { return; }
    const state = readPendingScroll(raw, pathname, Date.now());
    if (state === "none" || state === "other-page") return; // « other-page » : le composant peut se remonter juste avant l’actualisation de l’URL par le routeur.
    forgetPending();
    if (state !== "scroll") return;

    // Refaire le déplacement après que Next.js et les moteurs de défilement de la page ont fini la transition.
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(scrollInstantlyToTop);
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [pathname]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || !link.closest(SCROLL_TOP_ZONES)) return;
      const decision = decideScrollOnClick({
        button: event.button, metaKey: event.metaKey, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey,
        href: link.href, base: window.location.href, target: link.target, download: link.hasAttribute("download"),
      });
      if (decision.action === "ignore") return;
      if (decision.remember) {
        try { window.sessionStorage.setItem(PENDING_SCROLL_KEY, serializePendingScroll(decision.remember, Date.now())); } catch { /* le déplacement immédiat reste appliqué */ }
      } else {
        forgetPending();
      }
      scrollInstantlyToTop();
    };
    // Écoute sur le document : les listes ouvertes dans une fenêtre (portail) et la barre basse sont couvertes par la même zone.
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PENDING_FOOTER_SCROLL_KEY = "ecarnet:pending-footer-scroll";
const PENDING_FOOTER_SCROLL_MAX_AGE_MS = 10_000;

function scrollInstantlyToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

/** Les liens du pied de page ouvrent une nouvelle page en haut; les liens d’ancre gardent leur cible. */
export function PublicFooterScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    let pending: { pathname: string; createdAt: number } | null = null;
    try {
      const stored = window.sessionStorage.getItem(PENDING_FOOTER_SCROLL_KEY);
      if (!stored) return;
      pending = JSON.parse(stored) as { pathname: string; createdAt: number };
    } catch {
      try { window.sessionStorage.removeItem(PENDING_FOOTER_SCROLL_KEY); } catch { /* sessionStorage indisponible */ }
      return;
    }

    if (!pending || typeof pending.pathname !== "string" || !Number.isFinite(pending.createdAt)) {
      try { window.sessionStorage.removeItem(PENDING_FOOTER_SCROLL_KEY); } catch { /* sessionStorage indisponible */ }
      return;
    }
    if (Date.now() - pending.createdAt > PENDING_FOOTER_SCROLL_MAX_AGE_MS) {
      try { window.sessionStorage.removeItem(PENDING_FOOTER_SCROLL_KEY); } catch { /* sessionStorage indisponible */ }
      return;
    }
    // Le composant peut se remonter juste avant l’actualisation de l’URL par le routeur.
    if (pending.pathname !== pathname) return;
    try { window.sessionStorage.removeItem(PENDING_FOOTER_SCROLL_KEY); } catch { /* sessionStorage indisponible */ }

    // Refaire le déplacement après que Next.js et les moteurs de scroll de la page ont fini la transition.
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
    const footer = document.querySelector<HTMLElement>('[data-footer-zone="true"]');
    if (!footer) return;

    const handleClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || !footer.contains(link) || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;

      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.hash) return;

      if (destination.pathname !== pathname) {
        try {
          window.sessionStorage.setItem(PENDING_FOOTER_SCROLL_KEY, JSON.stringify({ pathname: destination.pathname, createdAt: Date.now() }));
        } catch {
          // Le déplacement immédiat reste appliqué même si le stockage de session est indisponible.
        }
      } else {
        try {
          window.sessionStorage.removeItem(PENDING_FOOTER_SCROLL_KEY);
        } catch {
          // Rien à nettoyer si le stockage de session n’est pas disponible.
        }
      }
      scrollInstantlyToTop();
    };

    footer.addEventListener("click", handleClick);
    return () => footer.removeEventListener("click", handleClick);
  }, [pathname]);

  return null;
}

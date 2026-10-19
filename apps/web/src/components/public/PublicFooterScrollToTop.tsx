"use client";

import { useEffect } from "react";

/** Les liens du pied de page ouvrent une nouvelle page au début; les liens d’ancre gardent leur cible. */
export function PublicFooterScrollToTop() {
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
      window.scrollTo(0, 0);
    };

    footer.addEventListener("click", handleClick);
    return () => footer.removeEventListener("click", handleClick);
  }, []);

  return null;
}

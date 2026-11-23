"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* Pied de page : l'en-tête collant et le menu (barre du bas de l'espace connecté, bouton à trois traits des pages publiques) se retirent quand on
   arrive au pied de page, pour ne plus le cacher. Ils reviennent dès qu'on remonte, et ne se retirent jamais sur une page trop courte pour défiler
   (sinon on ne pourrait plus naviguer). L'état est un attribut posé sur <html> (`data-at-footer`) : le dessin du retrait est dans le CSS
   (components/shell/sidebar.css pour l'espace connecté, app/site-pages.css pour les pages publiques). */
const ZONES = '[data-footer-zone="true"], .space-footer';
const ATTRIBUTE = "data-at-footer";

export function FooterBarsHider() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const zones = Array.from(document.querySelectorAll<HTMLElement>(ZONES));
    if (zones.length === 0 || typeof IntersectionObserver === "undefined") return;

    const inView = new Set<Element>();
    let lastY = window.scrollY;
    let hidden = false;
    const set = (value: boolean) => {
      if (value === hidden) return;
      hidden = value;
      if (value) root.setAttribute(ATTRIBUTE, "true");
      else root.removeAttribute(ATTRIBUTE);
    };
    const scrollable = () => root.scrollHeight > window.innerHeight + 120;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      if (inView.size === 0 || !scrollable()) { set(false); return; }
      if (delta < -8) set(false); // on remonte : les barres reviennent
      else if (delta > 0 || y + window.innerHeight >= root.scrollHeight - 2) set(true);
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) inView.add(entry.target);
        else inView.delete(entry.target);
      }
      if (inView.size === 0 || !scrollable()) set(false);
      else if (window.scrollY > 0) set(true);
    }, { threshold: 0.01 });
    zones.forEach((zone) => observer.observe(zone));
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      root.removeAttribute(ATTRIBUTE);
    };
  }, [pathname]);

  return null;
}

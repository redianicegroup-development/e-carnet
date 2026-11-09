"use client";

import { useEffect } from "react";

/** Apparition au défilement des blocs `.lp2-rv`. Le contenu est visible par défaut : seuls les blocs encore sous l'écran sont masqués,
 *  puis révélés à l'arrivée (ou après 5 s si l'observateur ne répond pas). Rien n'est masqué si l'animation est réduite. */
export function LandingReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const viewport = window.innerHeight;
    const waiting = Array.from(document.querySelectorAll<HTMLElement>(".lp2-rv")).filter((element) => element.getBoundingClientRect().top > viewport);
    waiting.forEach((element) => element.classList.add("lp2-rv-wait"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove("lp2-rv-wait");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
    waiting.forEach((element) => observer.observe(element));
    const safety = window.setTimeout(() => waiting.forEach((element) => element.classList.remove("lp2-rv-wait")), 5000);
    return () => { observer.disconnect(); window.clearTimeout(safety); waiting.forEach((element) => element.classList.remove("lp2-rv-wait")); };
  }, []);
  return null;
}

"use client";

import { useEffect, useRef, type RefObject } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { gsap, ScrollTrigger } from "./gsap";

/* Les fenêtres au premier plan (feedback, enquêtes, confirmations, paramètres) gardent leur défilement natif :
   sans cela, Lenis ferait défiler la page située derrière. */
const OVERLAYS = ".modal-backdrop, .feedback-backdrop, .product-survey-backdrop, .settings-modal-backdrop";

/** Hauteur de l'en-tête collant, qui sert à épingler le hero juste en dessous. Les ancres (#contact…) s'arrêtent sous l'en-tête grâce au scroll-margin-top des sections (landing-showcase.css). */
export const stickyHeaderHeight = () => document.querySelector<HTMLElement>(".pub-header")?.offsetHeight ?? 0;

/* Défilement fluide (Lenis) synchronisé avec ScrollTrigger. Désactivé si l'utilisateur demande moins de mouvement.
   Lenis ne lisse que la molette/trackpad : le tactile (mobile) reste natif, donc léger sur les téléphones modestes.
   Renvoie l'instance (null tant qu'elle n'existe pas, ou si le mouvement est réduit) pour les déplacements programmés. */
export function useSmoothScroll(): RefObject<Lenis | null> {
  const instance = useRef<Lenis | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true, anchors: false, prevent: (node) => node.closest(OVERLAYS) !== null });
    instance.current = lenis;
    const onScroll = () => ScrollTrigger.update();
    const tick = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", onScroll);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.off("scroll", onScroll);
      lenis.destroy();
      instance.current = null;
    };
  }, []);

  return instance;
}

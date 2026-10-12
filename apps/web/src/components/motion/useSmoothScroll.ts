"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { gsap, ScrollTrigger } from "./gsap";

/* Les fenêtres au premier plan (feedback, enquêtes, confirmations, paramètres) gardent leur défilement natif :
   sans cela, Lenis ferait défiler la page située derrière. */
const OVERLAYS = ".modal-backdrop, .feedback-backdrop, .product-survey-backdrop, .settings-modal-backdrop";

/* Défilement fluide (Lenis) synchronisé avec ScrollTrigger. Désactivé si l'utilisateur demande moins de mouvement.
   Lenis ne lisse que la molette/trackpad : le tactile (mobile) reste natif, donc léger sur les téléphones modestes. */
export function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true, anchors: true, prevent: (node) => node.closest(OVERLAYS) !== null });
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
    };
  }, []);
}

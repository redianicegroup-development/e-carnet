"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/* Calque gooey posé sous une modal (voir « Gooey » dans app/carnet-neo.css).
   Une goutte naît sous le panneau, grossit jusqu'à sa taille et le déborde un instant avant de s'y fondre.
   Le calque est décoratif (aria-hidden) : le filtre ne touche jamais le texte, qui reste dans le panneau net.
   Il se cale sur le panneau par ses dimensions de mise en page (offset*), que l'animation d'entrée ne fausse pas,
   et suit ses changements de hauteur (étapes d'un formulaire, message d'erreur…).
   À placer APRÈS le panneau, dans le même fond (.modal-backdrop…) : le panneau a alors déjà sa référence.
   Mouvement réduit : le calque est masqué par la feuille de style. */
export function GooLayer({ target }: { target: RefObject<HTMLElement | null> }) {
  const layer = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const panel = target.current;
    const node = layer.current;
    if (!panel || !node) return;
    const sync = () => {
      node.style.setProperty("--goo-x", `${panel.offsetLeft}px`);
      node.style.setProperty("--goo-y", `${panel.offsetTop}px`);
      node.style.setProperty("--goo-w", `${panel.offsetWidth}px`);
      node.style.setProperty("--goo-h", `${panel.offsetHeight}px`);
      node.style.setProperty("--goo-r", `${parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 24}px`);
    };
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(sync);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={layer} className="goo-layer" aria-hidden="true"><span className="goo-layer__anchor" /><span className="goo-layer__blob" /></span>;
}

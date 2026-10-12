"use client";

import { useRef, type ReactNode } from "react";
import { gsap, SplitText, useGSAP } from "./gsap";
import { useSmoothScroll } from "./useSmoothScroll";

/* Mouvement de la page connexion / inscription (une seule page, deux modes).
   Ouverture : le pouls se dessine, le titre se lève, la carte apparaît. Puis une étincelle court sur la ligne.
   Quand la personne bascule entre « J'ai déjà un compte » et « Nouveau compte », le pouls se redessine :
   un retour discret qui répond à son geste. Aucune donnée n'est lue ni modifiée ici. */
export function AuthMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useSmoothScroll();

  useGSAP(() => {
    const el = root.current;
    if (!el) return;
    const q = gsap.utils.selector(el);
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const title = q("#auth-title")[0];
      const trace = q(".auth-stage .pulse__trace");
      const spark = q(".auth-stage .pulse__spark");
      gsap.set(title, { visibility: "hidden" });
      gsap.set(q("[data-auth-item]"), { autoAlpha: 0, y: 16 });
      gsap.set(q(".auth-landing__panel"), { autoAlpha: 0, y: 36 });
      gsap.set(trace, { strokeDashoffset: 1, strokeDasharray: 1 });
      el.dataset.motion = "ready";

      SplitText.create(title, {
        type: "lines", mask: "lines", maskClass: "split-mask", autoSplit: true,
        onSplit: (self) => { gsap.set(title, { visibility: "visible" }); return gsap.from(self.lines, { yPercent: 115, duration: 0.9, ease: "power4.out", stagger: 0.12, delay: 0.1 }); },
      });
      gsap.delayedCall(2.5, () => { gsap.set(title, { visibility: "visible" }); });

      const draw = gsap.timeline({ paused: true }).fromTo(trace, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut" });
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .add(draw.duration(2.1).play(), 0)
        .to(q("[data-auth-item]"), { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.09 }, 0.35)
        .to(q(".auth-landing__panel"), { autoAlpha: 1, y: 0, duration: 0.9, ease: "power4.out" }, 0.25);

      const sparkLoop = gsap.fromTo(spark, { strokeDashoffset: 0, opacity: 1 }, { strokeDashoffset: -1, duration: 6, repeat: -1, ease: "none", delay: 2 });
      const glowLoop = gsap.to(q(".auth-stage__glow"), { scale: 1.16, duration: 4.8, yoyo: true, repeat: -1, ease: "sine.inOut", stagger: 1.4 });

      /* Bascule connexion ⇄ inscription : le composant de formulaire expose son mode dans data-mode. */
      const card = q("[data-mode]")[0];
      let observer: MutationObserver | undefined;
      if (card) {
        observer = new MutationObserver(() => { gsap.fromTo(trace, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1, ease: "power2.inOut", overwrite: true }); });
        observer.observe(card, { attributes: true, attributeFilter: ["data-mode"] });
      }

      return () => { observer?.disconnect(); sparkLoop.kill(); glowLoop.kill(); };
    });

    return () => mm.revert();
  }, { scope: root });

  return <div ref={root} className="auth-root" data-motion="pending">{children}</div>;
}

"use client";

import { useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger, SplitText, useGSAP } from "./gsap";
import { useSmoothScroll } from "./useSmoothScroll";

/* Mouvement de la landing, ajouté par-dessus du HTML rendu côté serveur (le contenu reste lisible sans JavaScript).
   Principe : une seule séquence d'ouverture (le pouls qui se dessine, le titre qui se lève, le téléphone qui apparaît),
   puis un mouvement qui répond au défilement (parcours, démonstration du consentement) — pas d'effets décoratifs partout.
   Tout est désactivé si l'utilisateur demande moins de mouvement (prefers-reduced-motion). */
export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useSmoothScroll();

  useGSAP(() => {
    const el = root.current;
    if (!el) return;
    const q = gsap.utils.selector(el);
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const header = document.querySelector<HTMLElement>(".pub-header");
      const hero = q("[data-hero]")[0];
      const loops: gsap.core.Tween[] = [];

      /* --- Ouverture : le titre est masqué par CSS (data-motion="pending") jusqu'à ce que tout soit prêt --- */
      const title = q("#hero-title")[0];
      const heroTrace = q(".lp-hero .pulse__trace")[0];
      gsap.set(title, { visibility: "hidden" });
      gsap.set(q("[data-hero-item]"), { autoAlpha: 0, y: 18 });
      gsap.set(q(".lp-phone"), { autoAlpha: 0, y: 70, rotate: 4 });
      gsap.set(q(".lp-hero .pulse__trace"), { strokeDashoffset: 1, strokeDasharray: 1 });
      el.dataset.motion = "ready";

      SplitText.create(title, {
        type: "lines", mask: "lines", maskClass: "split-mask", autoSplit: true,
        onSplit: (self) => { gsap.set(title, { visibility: "visible" }); return gsap.from(self.lines, { yPercent: 115, duration: 0.95, ease: "power4.out", stagger: 0.12, delay: 0.1 }); },
      });
      gsap.delayedCall(2.5, () => { gsap.set(title, { visibility: "visible" }); }); // filet de sécurité si les polices tardent
      const tracePulse = heroTrace ? gsap.fromTo(heroTrace, { strokeDashoffset: 1, opacity: 0.28 }, { strokeDashoffset: 0, opacity: 1, duration: 1.35, repeat: -1, repeatDelay: 1.15, ease: "power2.inOut", paused: true, immediateRender: false }) : null;
      if (tracePulse) loops.push(tracePulse);

      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro
        .to(q(".lp-hero .pulse__trace"), { strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut" }, 0)
        .to(q("[data-hero-item]"), { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1 }, 0.4)
        .to(q(".lp-phone"), { autoAlpha: 1, y: 0, rotate: 0, duration: 1.2, ease: "power4.out" }, 0.3)
        .call(() => tracePulse?.play());

      /* --- Respiration et étincelle : boucles lentes, mises en pause dès que le hero sort de l'écran --- */
      loops.push(gsap.to(q(".lp-hero__glow"), { scale: 1.14, duration: 4.6, yoyo: true, repeat: -1, ease: "sine.inOut", stagger: 1.2 }));
      loops.push(gsap.fromTo(q(".lp-hero .pulse__spark"), { strokeDashoffset: 0, opacity: 1 }, { strokeDashoffset: -1, duration: 5.5, repeat: -1, ease: "none", delay: 2 }));
      if (hero) ScrollTrigger.create({ trigger: hero, start: "top bottom", end: "bottom top", onToggle: (self) => loops.forEach((tween) => { tween.paused(!self.isActive); }) });

      /* --- En-tête : ombre légère dès que la page défile --- */
      if (header) ScrollTrigger.create({ start: 24, end: "max", onUpdate: (self) => header.classList.toggle("is-scrolled", self.scroll() > 24) });

      /* --- Titres de section : lignes masquées qui se lèvent à l'arrivée --- */
      q("[data-split]").forEach((heading) => {
        SplitText.create(heading, {
          type: "lines", mask: "lines", maskClass: "split-mask", autoSplit: true,
          onSplit: (self) => gsap.from(self.lines, { yPercent: 115, duration: 0.85, ease: "power3.out", stagger: 0.09, scrollTrigger: { trigger: heading, start: "top 88%", once: true } }),
        });
      });

      /* --- Engagements : un filet se trace au-dessus de chaque promesse --- */
      q("[data-rule]").forEach((rule, index) => {
        gsap.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "power3.out", delay: index * 0.08, scrollTrigger: { trigger: rule, start: "top 90%", once: true } });
      });

      /* --- Parcours : le fil se remplit au défilement et chaque étape s'allume quand il l'atteint --- */
      const stepsWrap = q("[data-steps]")[0];
      const fill = q("[data-rail-fill]")[0];
      if (stepsWrap && fill) {
        gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: stepsWrap, start: "top 62%", end: "bottom 72%", scrub: 0.5 } });
      }
      q("[data-step]").forEach((step) => {
        const marker = step.querySelector(".lp-step__marker");
        ScrollTrigger.create({
          trigger: step, start: "top 66%", end: "max",
          toggleClass: { targets: step, className: "is-active" },
          onEnter: () => { if (marker) gsap.fromTo(marker, { scale: 0.78 }, { scale: 1, duration: 0.6, ease: "back.out(2.4)" }); },
        });
      });

      /* --- Rôles : apparition échelonnée, une seule fois --- */
      gsap.from(q(".lp-profile"), { autoAlpha: 0, y: 30, duration: 0.8, ease: "power3.out", stagger: 0.12, scrollTrigger: { trigger: q(".lp-profiles")[0], start: "top 86%", once: true } });

      /* --- Démonstration du consentement : autoriser puis révoquer, piloté par le défilement (et réversible) --- */
      const consent = q("[data-consent]")[0];
      if (consent) {
        ScrollTrigger.create({
          trigger: consent, start: "top 78%", end: "bottom 30%",
          onUpdate: (self) => { consent.dataset.state = self.progress < 0.34 ? "pending" : self.progress < 0.74 ? "granted" : "revoked"; },
        });
      }

      /* --- Final : le pouls se dessine une dernière fois --- */
      gsap.fromTo(q(".lp-final .pulse__trace"), { strokeDashoffset: 1, strokeDasharray: 1 }, { strokeDashoffset: 0, duration: 2, ease: "power2.inOut", scrollTrigger: { trigger: q(".lp-final")[0], start: "top 82%", once: true } });

      /* --- Parallaxe du hero : grand écran uniquement --- */
      const parallax = gsap.matchMedia();
      parallax.add("(min-width: 920px)", () => {
        if (!hero) return;
        gsap.to(q(".lp-phone"), { yPercent: -7, rotate: -2, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.8 } });
        gsap.to(q(".lp-hero__glow--a"), { yPercent: 30, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 1 } });
      });

      void document.fonts?.ready.then(() => ScrollTrigger.refresh());
      return () => { header?.classList.remove("is-scrolled"); parallax.revert(); };
    });

    return () => mm.revert();
  }, { scope: root });

  return <div ref={root} className="lp-root" data-motion="pending">{children}</div>;
}

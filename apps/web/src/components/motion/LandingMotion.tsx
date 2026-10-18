"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger, SplitText, useGSAP } from "./gsap";
import { stickyHeaderHeight, useSmoothScroll } from "./useSmoothScroll";

/* Mouvement de la landing, ajouté par-dessus du HTML rendu côté serveur (le contenu reste lisible sans JavaScript).

   Séquence signature : l'image du hero (une scène de l'application) démarre petite dans le coin bas-droit de l'écran,
   puis grossit jusqu'à occuper tout l'écran à mesure qu'on défile, et rétrécit en carte à la fin — dans les deux sens,
   car elle est liée au défilement (scrub). Le reste : titres qui se lèvent, parcours qui s'allume, démonstration du consentement.

   Tout est désactivé si l'utilisateur demande moins de mouvement (prefers-reduced-motion) : le hero reste alors une page
   fixe, l'image restant dans son coin. Les valeurs de départ (échelle, marge, rayon) viennent des variables CSS du hero
   (--s0, --mx, --my, --r) pour que le CSS et l'animation ne puissent pas diverger. */

const cssNumber = (el: Element, name: string) => parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0;

export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const lenis = useSmoothScroll();

  useGSAP(() => {
    const el = root.current;
    if (!el) return;
    const q = gsap.utils.selector(el);
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const header = document.querySelector<HTMLElement>(".pub-header");
      const hero = q("[data-hero]")[0];
      const loops: gsap.core.Tween[] = [];
      const root$ = document.documentElement;

      /* La hauteur du hero = l'écran moins l'en-tête collant : mesurée, jamais devinée (l'en-tête change selon la connexion). */
      const syncHeaderHeight = () => root$.style.setProperty("--pub-header-h", `${stickyHeaderHeight()}px`);
      syncHeaderHeight();
      ScrollTrigger.addEventListener("refreshInit", syncHeaderHeight);

      /* --- Ouverture : le titre est masqué par CSS (data-motion="pending") jusqu'à ce que tout soit prêt --- */
      const title = q("#hero-title")[0];
      const heroTrace = q(".lp-hero .pulse__trace")[0];
      gsap.set(title, { visibility: "hidden" });
      gsap.set(q("[data-hero-item]"), { autoAlpha: 0, y: 18 });
      gsap.set(q(".lp-hero .pulse__trace"), { strokeDashoffset: 1, strokeDasharray: 1 });
      gsap.set(q("[data-hero-media]"), { autoAlpha: 0 });
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
        .to(q("[data-hero-media]"), { autoAlpha: 1, duration: 0.9, ease: "power2.out" }, 0.55)
        .call(() => tracePulse?.play());

      /* --- Respiration du hero : boucles lentes, mises en pause dès qu'il sort de l'écran --- */
      loops.push(gsap.to(q(".lp-hero__glow"), { scale: 1.14, duration: 4.6, yoyo: true, repeat: -1, ease: "sine.inOut", stagger: 1.2 }));
      loops.push(gsap.fromTo(q(".lp-hero .pulse__spark"), { strokeDashoffset: 0, opacity: 1 }, { strokeDashoffset: -1, duration: 5.5, repeat: -1, ease: "none", delay: 2 }));

      /* --- Image qui grossit : petite dans le coin → plein écran → carte arrondie, liée au défilement (réversible) ---
         Le hero est épinglé juste sous l'en-tête ; on n'anime que ses enfants (consigne ScrollTrigger). Mobile : trajet plus court. */
      const media = q("[data-hero-media]")[0];
      const reveal = q("[data-hero-reveal]")[0];
      const copy = q("[data-hero-copy]")[0];
      if (hero && media) {
        const s0 = cssNumber(media, "--s0") || 0.28;
        const marginX = cssNumber(media, "--mx");
        const marginY = cssNumber(media, "--my");
        const radius = cssNumber(media, "--r") || 28;
        const rest = 0.94; // taille finale : une grande carte, pas tout à fait plein écran
        const travel = window.innerWidth < 760 ? 1.9 : 2.4; // longueur du défilement, en hauteurs d'écran

        gsap.set(media, { transformOrigin: "100% 100%" });
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: hero, start: () => `top ${stickyHeaderHeight()}px`, end: () => `+=${Math.round(window.innerHeight * travel)}`,
            pin: true, scrub: 0.4, anticipatePin: 1, invalidateOnRefresh: true,
          },
        });
        // Le texte s'efface pendant que l'image grossit (fondu enchaîné) ; l'image démarre vite puis ralentit en arrivant plein écran.
        tl.fromTo(copy, { yPercent: 0, autoAlpha: 1 }, { yPercent: -10, autoAlpha: 0, duration: 0.24, ease: "power1.in", immediateRender: false }, 0.02)
          .fromTo(media, { scale: s0, x: -marginX, y: -marginY, borderRadius: radius / s0 }, { scale: 1, x: 0, y: 0, borderRadius: 0, duration: 0.58, ease: "power1.out", immediateRender: false }, 0.02)
          .fromTo(q("[data-reveal-line]"), { yPercent: 70, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.18, stagger: 0.07, ease: "power3.out", immediateRender: false }, 0.5)
          .to({}, { duration: 0.14 }) // temps de lecture, image plein écran
          .fromTo(reveal, { autoAlpha: 1, yPercent: 0 }, { autoAlpha: 0, yPercent: -8, duration: 0.12, immediateRender: false }, 0.86)
          // Fin : l'image rétrécit en une grande carte centrée (l'origine de l'échelle est le coin bas-droit, d'où le décalage x/y).
          .fromTo(media, { scale: 1, x: 0, y: 0, borderRadius: 0 }, { scale: rest, x: () => -((1 - rest) * media.offsetWidth) / 2, y: () => -((1 - rest) * media.offsetHeight) / 2, borderRadius: 40 / rest, duration: 0.14, ease: "power1.inOut", immediateRender: false }, 0.86);
      }
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

      /* --- Apparition générique (FAQ, contact, repères) : un léger lever, une seule fois --- */
      gsap.utils.toArray<HTMLElement>(q("[data-reveal]")).forEach((item) => {
        gsap.from(item, { autoAlpha: 0, y: 28, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: item, start: "top 90%", once: true } });
      });
      [".lp-facts__grid", ".lp-features__grid", ".lp-profiles"].forEach((selector) => {
        const grid = q(selector)[0];
        if (grid) gsap.from(Array.from(grid.children), { autoAlpha: 0, y: 34, duration: 0.8, ease: "power3.out", stagger: 0.09, scrollTrigger: { trigger: grid, start: "top 86%", once: true } });
      });

      /* --- Fonctionnalités : deux colonnes se décalent légèrement au défilement (grand écran uniquement) --- */
      const features = q(".lp-features__grid")[0];
      if (features && window.innerWidth >= 920) {
        Array.from(features.children).forEach((card, index) => {
          if (index % 3 === 1) gsap.fromTo(card, { y: 28 }, { y: -28, ease: "none", scrollTrigger: { trigger: features, start: "top bottom", end: "bottom top", scrub: 0.8 } });
        });
      }

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

      /* --- Démonstration du consentement : la carte grossit en arrivant, puis autoriser/révoquer suit le défilement (réversible) --- */
      const consent = q("[data-consent]")[0];
      if (consent) {
        gsap.fromTo(consent, { scale: 0.82 }, { scale: 1, ease: "none", scrollTrigger: { trigger: consent, start: "top 96%", end: "top 55%", scrub: 0.5 } });
        ScrollTrigger.create({
          trigger: consent, start: "top 78%", end: "bottom 30%",
          onUpdate: (self) => { consent.dataset.state = self.progress < 0.34 ? "pending" : self.progress < 0.74 ? "granted" : "revoked"; },
        });
      }

      void document.fonts?.ready.then(() => ScrollTrigger.refresh());
      return () => {
        header?.classList.remove("is-scrolled");
        ScrollTrigger.removeEventListener("refreshInit", syncHeaderHeight);
        root$.style.removeProperty("--pub-header-h");
      };
    });

    return () => mm.revert();
  }, { scope: root });

  /* La FAQ et le formulaire changent la hauteur de la page : les repères situés plus bas sont recalculés, regroupés, et jamais en plein
     défilement animé (un recalcul au milieu d'un déplacement vers une ancre ferait dévier l'arrivée). */
  useEffect(() => {
    let timer = 0;
    const refreshWhenIdle = () => {
      if (lenis.current?.isScrolling) { timer = window.setTimeout(refreshWhenIdle, 200); return; }
      ScrollTrigger.refresh();
    };
    const onLayout = () => { window.clearTimeout(timer); timer = window.setTimeout(refreshWhenIdle, 150); };
    window.addEventListener("ecarnet:layout", onLayout);
    return () => { window.clearTimeout(timer); window.removeEventListener("ecarnet:layout", onLayout); };
  }, [lenis]);

  /* Ancres internes (#contact, #questions…) : un seul déplacement, calculé ici. Laisser faire le navigateur ET Lenis donnait une arrivée
     aléatoire (saut natif + défilement animé qui se contredisent). L'arrêt tient compte de l'en-tête collant via scroll-margin-top. */
  useEffect(() => {
    const destination = (target: HTMLElement) => target.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(target).scrollMarginTop) || 0);
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href]");
      if (!link || link.target || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.hash.length < 2) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      event.preventDefault(); // le routeur de Next ignore un clic déjà traité
      if (lenis.current) lenis.current.scrollTo(destination(target));
      else window.scrollTo(0, destination(target));
      if (window.location.hash !== url.hash) window.history.pushState(null, "", url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [lenis]);

  /* Arrivée directe sur /#contact : le navigateur défile avant que le hero épinglé n'ait ajouté sa hauteur (le repère serait faux),
     on recale donc une fois les repères posés. */
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (!target) return;
      ScrollTrigger.refresh();
      const top = target.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(target).scrollMarginTop) || 0);
      if (lenis.current) lenis.current.scrollTo(top, { immediate: true, force: true });
      else window.scrollTo(0, top);
    });
    return () => cancelAnimationFrame(frame);
  }, [lenis]);

  return <div ref={root} className="lp-root" data-motion="pending">{children}</div>;
}

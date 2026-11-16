"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger, SplitText, useGSAP } from "./gsap";
import { stickyHeaderHeight, useSmoothScroll } from "./useSmoothScroll";

/* Mouvement de la landing, ajouté par-dessus du HTML rendu côté serveur (le contenu reste lisible sans JavaScript).

   Séquence signature : l'image du hero démarre en petit carré arrondi DANS le titre (entre « votre » et « contrôle », l'emplacement
   [data-hero-slot="media"] de HeroTiles), puis grossit jusqu'à occuper tout l'écran à mesure qu'on défile, et rétrécit en carte à la
   fin — dans les deux sens, car elle est liée au défilement (scrub). Le reste : titres qui se lèvent, parcours qui s'allume,
   démonstration du consentement.

   Le départ est mesuré sur l'emplacement réel (position et taille en mise en page, donc sans effet des transformations) : l'image
   pleine taille est réduite pour couvrir ce carré et découpée par un clip-path carré arrondi, qui s'ouvre jusqu'au plein cadre.

   Tout est désactivé si l'utilisateur demande moins de mouvement (prefers-reduced-motion) : le hero reste alors une page
   fixe, l'image restant en carte dans son coin (état défini par le CSS du hero, variables --s0, --mx, --my, --r). */

/** Position d'un élément par rapport à un ancêtre positionné, d'après la mise en page seule (offsetLeft/offsetTop ignorent les transformations). */
const offsetWithin = (el: HTMLElement, ancestor: HTMLElement) => {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
};

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
      const titleWords = q("#hero-title [data-hero-word]");
      const titleSlots = q("[data-hero-slot]"); // les quatre carrés-diaporama et l'emplacement de la grande image (dans HeroTiles)
      const heroMark = q("[data-hero-mark]"); // le grand « MON E‑CARNET » en filigrane
      gsap.set(title, { visibility: "hidden" });
      gsap.set(q("[data-hero-item]"), { autoAlpha: 0, y: 18 });
      gsap.set(q("[data-hero-media]"), { autoAlpha: 0 });
      el.dataset.motion = "ready";

      // Titre : chaque mot monte de derrière son cadre découpé (CSS .lp-hero__w), les trois carrés apparaissent ensuite. Pas de SplitText ici :
      // il réécrirait le DOM du titre, or les deux diaporamas sont des composants React qui doivent garder leurs éléments.
      gsap.set(titleWords, { yPercent: 125 });
      gsap.set(titleSlots, { autoAlpha: 0, scale: 0.55 });
      gsap.set(heroMark, { autoAlpha: 0 });
      gsap.set(title, { visibility: "visible" });
      gsap.to(titleWords, { yPercent: 0, duration: 0.95, ease: "power4.out", stagger: 0.07, delay: 0.1 });
      gsap.to(heroMark, { autoAlpha: 1, duration: 1.3, ease: "power2.out", delay: 0.1 });
      gsap.to(titleSlots, { autoAlpha: 1, scale: 1, duration: 0.8, ease: "back.out(1.7)", stagger: 0.12, delay: 0.55 });
      gsap.delayedCall(2.5, () => { gsap.set(title, { visibility: "visible" }); }); // filet de sécurité si les polices tardent
      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro
        .to(q("[data-hero-item]"), { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1 }, 0.4)
        .to(q("[data-hero-media]"), { autoAlpha: 1, duration: 0.9, ease: "power2.out" }, 0.55);

      /* --- Respiration du hero : boucles lentes, mises en pause dès qu'il sort de l'écran --- */
      loops.push(gsap.to(q(".lp-hero__glow"), { scale: 1.14, duration: 4.6, yoyo: true, repeat: -1, ease: "sine.inOut", stagger: 1.2 }));

      /* --- Image qui grossit : petit carré dans le titre → plein écran → carte arrondie, liée au défilement (réversible) ---
         Le hero est épinglé juste sous l'en-tête ; on n'anime que ses enfants (consigne ScrollTrigger). Mobile : trajet plus court. */
      const media = q("[data-hero-media]")[0];
      const slot = q('[data-hero-slot="media"]')[0];
      const reveal = q("[data-hero-reveal]")[0];
      const copy = q("[data-hero-copy]")[0];
      if (hero && media && slot) {
        const rest = 0.94; // taille finale : une grande carte, pas tout à fait plein écran
        const compact = window.innerWidth < 760; // mobile
        const travel = compact ? 1.9 : 2.4; // longueur du défilement, en hauteurs d'écran
        /* État de départ = le carré du titre. L'image (taille du hero) est réduite pour couvrir ce carré, centrée dessus, puis découpée
           par un carré arrondi centré dans l'image. Recalculé à chaque refresh (invalidateOnRefresh) : redimensionnement, polices chargées. */
        const startState = () => {
          const width = media.offsetWidth;
          const height = media.offsetHeight;
          const side = slot.offsetWidth;
          const square = Math.min(width, height);
          const scale = side / square;
          const at = offsetWithin(slot as HTMLElement, hero as HTMLElement);
          const radius = parseFloat(getComputedStyle(slot).borderTopLeftRadius) || side * 0.22;
          const insetX = (width - square) / 2;
          const insetY = (height - square) / 2;
          return { scale, x: at.x + side / 2 - width / 2, y: at.y + side / 2 - height / 2, clipPath: `inset(${insetY}px ${insetX}px ${insetY}px ${insetX}px round ${radius / scale}px)` };
        };

        gsap.set(media, { transformOrigin: "50% 50%" });
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: hero, start: () => `top ${stickyHeaderHeight()}px`, end: () => `+=${Math.round(window.innerHeight * travel)}`,
            pin: true, scrub: 0.4, anticipatePin: 1, invalidateOnRefresh: true,
          },
        });
        // Le texte s'efface pendant que l'image grossit (fondu enchaîné) ; l'image démarre vite puis ralentit en arrivant plein écran.
        tl.fromTo(copy, { yPercent: 0, autoAlpha: 1 }, { yPercent: -10, autoAlpha: 0, duration: 0.24, ease: "power1.in", immediateRender: false }, 0.02)
          .fromTo(media,
            { scale: () => startState().scale, x: () => startState().x, y: () => startState().y, clipPath: () => startState().clipPath, borderRadius: 0 },
            { scale: 1, x: 0, y: 0, clipPath: "inset(0px 0px 0px 0px round 0px)", borderRadius: 0, duration: 0.58, ease: "power1.out" }, 0.02)
          .fromTo(q("[data-reveal-line]"), { yPercent: 70, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.18, stagger: 0.07, ease: "power3.out", immediateRender: false }, 0.5)
          .to({}, { duration: 0.14 }) // temps de lecture, image plein écran
          .fromTo(reveal, { autoAlpha: 1, yPercent: 0 }, { autoAlpha: 0, yPercent: -8, duration: 0.12, immediateRender: false }, 0.86);
        // Fin, sur ordinateur : l'image rétrécit en une grande carte centrée (l'origine de l'échelle est le centre).
        // Sur mobile (15/11/2026, 2e demande) : une fois grossie, l'image reste pleine ; elle ne rétrécit qu'en remontant, pour rentrer dans son carré
        // du titre (c'est le même tracé à l'envers, lié au défilement). Le temps de pause garde la même longueur de défilement.
        if (compact) tl.to({}, { duration: 0.14 }, 0.86);
        else tl.fromTo(media, { scale: 1, borderRadius: 0 }, { scale: rest, borderRadius: 40 / rest, duration: 0.14, ease: "power1.inOut", immediateRender: false }, 0.86);
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

      /* --- Photos des cartes de rôle : dévoilées au défilement (ScrollTrigger suit Lenis), réversible ; au survol ou au focus clavier,
             le CSS les ouvre en entier. `--reveal` va de 0 (masquée) à 1 (entière) ; sans lui, la photo est simplement affichée. --- */
      const photoCards = q("[data-photo-card]") as HTMLElement[];
      photoCards.forEach((card, index) => {
        const photo = card.querySelector(".lp2-role__photo") ?? card;
        const stagger = window.innerWidth >= 900 ? index * 6 : 0; // cartes côte à côte : elles se dévoilent l'une après l'autre
        const sync = (self: ScrollTrigger) => card.style.setProperty("--reveal", self.progress.toFixed(3));
        ScrollTrigger.create({ trigger: photo, start: `top ${96 - stagger}%`, end: `top ${58 - stagger}%`, scrub: true, onUpdate: sync, onRefresh: sync });
      });

      void document.fonts?.ready.then(() => ScrollTrigger.refresh());
      return () => {
        header?.classList.remove("is-scrolled");
        photoCards.forEach((card) => card.style.removeProperty("--reveal"));
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

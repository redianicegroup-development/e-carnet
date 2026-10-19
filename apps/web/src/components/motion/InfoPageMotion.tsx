"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger, useGSAP } from "./gsap";
import { stickyHeaderHeight, useSmoothScroll } from "./useSmoothScroll";

/* Mouvement des pages d'information : pages légales, crédits, à propos. Ajouté par-dessus du HTML rendu côté serveur
   (le contenu et les schémas restent lisibles sans JavaScript).

   Toujours actif (c'est de l'aide à la lecture, pas de la décoration) : défilement fluide Lenis sur les ancres, hauteur d'en-tête pour
   les décalages, et — pages légales — durée de lecture, sommaire qui suit la section à l'écran, barre de progression, bouton « haut de page ».
   Réservé à prefers-reduced-motion: no-preference : les schémas se dessinent à l'arrivée à l'écran (cartes, traits, flèches), les paquets
   qui circulent, l'interrupteur, les étapes qui s'allument le long du rail. Les valeurs de départ sont posées ici et jamais dans le CSS :
   si le script ne se charge pas, tout reste affiché. */

type Kind = "legal" | "page";

const HIDE_DASH = { strokeDasharray: "1 1.1", strokeDashoffset: 1 }; // « 1 1.1 » plutôt que « 1 » : pas de point résiduel au bout du trait (capuchons ronds)

/** Prépare un tracé quelconque (cercle, rectangle, chemin…) à être dessiné, avec sa vraie longueur. */
function hideStroke(shape: SVGGeometryElement) {
  const length = shape.getTotalLength?.() ?? 0;
  if (length > 0) gsap.set(shape, { strokeDasharray: `${length} ${length * 1.1}`, strokeDashoffset: length });
  return length;
}

export function InfoPageMotion({ kind = "page", children }: { kind?: Kind; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const lenis = useSmoothScroll();

  /* La hauteur de l'en-tête collant : mesurée (elle change selon la connexion et la largeur), jamais devinée. */
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".pub-header");
    const sync = () => document.documentElement.style.setProperty("--pub-header-h", `${stickyHeaderHeight()}px`);
    sync();
    if (!header || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(sync);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  /* Liens d'ancre (sommaire, « Retour en haut » du pied de page) : Lenis fait glisser la page jusqu'à la cible, sous l'en-tête.
     Sans Lenis (mouvement réduit), le navigateur garde son comportement natif ; scroll-margin-top règle le décalage. */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const smooth = lenis.current;
      if (!smooth || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link || link.closest(".modal-backdrop")) return;
      const id = decodeURIComponent(link.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      event.preventDefault();
      if (id === "contenu") smooth.scrollTo(0, { duration: 1.1 });
      else smooth.scrollTo(target, { offset: -(stickyHeaderHeight() + 16), duration: 1.2 });
      window.history.replaceState(null, "", `#${id}`);
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [lenis]);

  useGSAP(() => {
    const el = root.current;
    if (!el) return;
    const all = <T extends Element = HTMLElement>(selector: string) => Array.from(el.querySelectorAll<T>(selector));

    /* ---------- Aide à la lecture des pages légales (aussi avec mouvement réduit) ---------- */
    if (kind === "legal") {
      const main = el.querySelector(".legal__main");
      const slot = el.querySelector<HTMLElement>("[data-reading-time]");
      if (main && slot) {
        const words = (main.textContent ?? "").trim().split(/\s+/).length;
        slot.textContent = `${Math.max(1, Math.round(words / 200))} min de lecture`;
        slot.hidden = false;
      }

      const sections = all("[data-spy]");
      const links = all<HTMLAnchorElement>("[data-toc]");
      const setActive = (id: string | null) => {
        links.forEach((link) => {
          const on = link.dataset.toc === id;
          link.classList.toggle("is-active", on);
          if (on) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
          const side = link.closest<HTMLElement>(".legal__side");
          if (on && side && side.scrollHeight > side.clientHeight) side.scrollTop = link.offsetTop - side.clientHeight / 2;
        });
        sections.forEach((section) => section.classList.toggle("is-active", section.id === id));
      };
      sections.forEach((section, index) => {
        ScrollTrigger.create({
          trigger: section, start: "top 40%", end: "bottom 40%",
          onToggle: (self) => { if (self.isActive) setActive(section.id); },
          onLeaveBack: index === 0 ? () => setActive(null) : undefined,
        });
      });

      const setBar = bar.current ? gsap.quickSetter(bar.current, "scaleX") : null;
      ScrollTrigger.create({ start: 0, end: "max", onUpdate: (self) => setBar?.(self.progress) });
    }

    /* Les ancres et les hauteurs de page changent quand les polices arrivent : on recalcule une fois. */
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    /* ---------- Mouvement (réservé à prefers-reduced-motion: no-preference) ---------- */
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      el.classList.add("pm-ready");

      /* Schémas : à l'arrivée à l'écran, chaque élément apparaît dans l'ordre où il est écrit dans le SVG (carte, trait, flèche, légende). */
      all("[data-figure]").forEach((fig) => {
        const items = Array.from(fig.querySelectorAll<SVGElement>(".fg-pop, .fg-draw, .fg-fade"));
        if (items.length === 0) return;
        items.forEach((item) => {
          if (item.classList.contains("fg-draw")) gsap.set(item, HIDE_DASH);
          else gsap.set(item, item.classList.contains("fg-pop") ? { autoAlpha: 0, scale: 0.86 } : { autoAlpha: 0 });
        });

        const loops: gsap.core.Animation[] = [];
        const play = () => {
          fig.querySelectorAll<SVGElement>("[data-travel]").forEach((dot) => {
            const path = fig.querySelector<SVGGeometryElement>(`[data-path="${dot.dataset.travel}"]`);
            if (!path) return;
            const length = path.getTotalLength();
            const reverse = dot.hasAttribute("data-reverse");
            const state = { t: 0 };
            loops.push(gsap.to(state, {
              t: 1, duration: Math.max(1.6, length / 80), ease: "none", repeat: -1, repeatDelay: 1.1,
              onUpdate: () => {
                const point = path.getPointAtLength((reverse ? 1 - state.t : state.t) * length);
                dot.setAttribute("cx", String(point.x));
                dot.setAttribute("cy", String(point.y));
                dot.style.opacity = String(Math.min(1, state.t * 8, (1 - state.t) * 8));
              },
            }));
          });
          fig.querySelectorAll<SVGElement>(".fg-toggle").forEach((toggle) => {
            const knob = toggle.querySelector<SVGCircleElement>(".fg-toggle__knob");
            const track = toggle.querySelector<SVGElement>(".fg-toggle__track");
            if (!knob || !track) return;
            const from = Number(knob.getAttribute("cx"));
            const to = Number(knob.dataset.to);
            loops.push(gsap.timeline({ delay: 0.5 })
              .to(knob, { attr: { cx: to }, duration: 0.35, ease: "power2.inOut" })
              .call(() => track.classList.add("is-on"), undefined, 0)
              .to(knob, { attr: { cx: from }, duration: 0.35, ease: "power2.inOut" }, "+=1.6")
              .call(() => track.classList.remove("is-on"), undefined, "<"));
          });
          fig.querySelectorAll<SVGCircleElement>(".fg-switch-knob").forEach((knob) => {
            const from = Number(knob.dataset.from);
            loops.push(gsap.to(knob, { attr: { cx: from }, duration: 0.55, ease: "power2.inOut", yoyo: true, repeat: -1, repeatDelay: 1.3 }));
          });
        };

        const reveal = gsap.timeline({ paused: true, onComplete: play });
        items.forEach((item, index) => {
          const at = Math.min(index * 0.09, 1.5);
          if (item.classList.contains("fg-draw")) reveal.to(item, { strokeDashoffset: 0, duration: 0.7, ease: "power2.inOut" }, at);
          else if (item.classList.contains("fg-pop")) reveal.to(item, { autoAlpha: 1, scale: 1, duration: 0.5, ease: "back.out(1.5)" }, at);
          else reveal.to(item, { autoAlpha: 1, duration: 0.45, ease: "power1.out" }, at);
        });
        ScrollTrigger.create({ trigger: fig, start: "top 85%", once: true, onEnter: () => reveal.play() });
        // Les boucles ne tournent que tant que le schéma est à l'écran.
        ScrollTrigger.create({ trigger: fig, start: "top bottom", end: "bottom top", onToggle: (self) => loops.forEach((loop) => (self.isActive ? loop.play() : loop.pause())) });
      });

      /* Étapes : le rail se remplit avec le défilement, chaque étape s'allume (et son pictogramme se dessine) quand on l'atteint. */
      all("[data-trail]").forEach((list) => {
        gsap.set(list, { "--rail": 0 });
        gsap.to(list, { "--rail": 1, ease: "none", scrollTrigger: { trigger: list, start: "top 70%", end: "bottom 65%", scrub: 0.4 } });
        list.querySelectorAll<HTMLElement>(".trail__item").forEach((item) => {
          const draws = item.querySelectorAll<SVGElement>(".fg-draw");
          gsap.set(draws, HIDE_DASH);
          ScrollTrigger.create({
            trigger: item, start: "top 75%",
            onEnter: () => { item.classList.add("is-on"); gsap.to(draws, { strokeDashoffset: 0, duration: 0.7, ease: "power2.inOut", stagger: 0.08, overwrite: true }); },
            onLeaveBack: () => { item.classList.remove("is-on"); gsap.set(draws, HIDE_DASH); },
          });
        });
      });

      /* Pictogrammes des cartes (À propos, Crédits) : le trait se dessine une fois, à l'arrivée à l'écran. */
      all("[data-draw-icon]").forEach((holder) => {
        const shapes = Array.from(holder.querySelectorAll<SVGGeometryElement>("path, circle, rect, line, polyline"));
        shapes.forEach(hideStroke);
        ScrollTrigger.create({
          trigger: holder, start: "top 88%", once: true,
          onEnter: () => gsap.to(shapes, { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut", stagger: 0.06, clearProps: "strokeDasharray,strokeDashoffset" }),
        });
      });

      /* Fil de santé de l'en-tête de « À propos » : même mouvement que la page d'accueil (tracé, puis étincelle qui court). */
      const trace = all(".about__pulse .pulse__trace");
      if (trace.length > 0) {
        gsap.set(trace, { strokeDasharray: 1, strokeDashoffset: 1 });
        gsap.to(trace, { strokeDashoffset: 0, duration: 2, ease: "power2.inOut", delay: 0.3 });
        gsap.fromTo(all(".about__pulse .pulse__spark"), { strokeDashoffset: 0, opacity: 1 }, { strokeDashoffset: -1, duration: 5.5, repeat: -1, ease: "none", delay: 2.4 });
      }

      return () => el.classList.remove("pm-ready");
    });

    return () => mm.revert();
  }, { scope: root, dependencies: [kind] });

  return (
    <div ref={root} className="pm-root" data-kind={kind}>
      {kind === "legal" && (
        <>
          <span className="pm-progress" aria-hidden="true"><span ref={bar} className="pm-progress__bar" /></span>
        </>
      )}
      {children}
    </div>
  );
}

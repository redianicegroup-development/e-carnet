"use client";

import { useRef, type ReactNode } from "react";
import { useAuthUi } from "../auth/AuthUiContext";
import { gsap, SplitText, useGSAP } from "./gsap";
import { useSmoothScroll } from "./useSmoothScroll";

/* Mouvement de la page connexion / inscription (une seule page, deux modes).
   Ouverture : le titre se lève mot à mot, la scène respire (halos qui dérivent), le panneau et les champs arrivent en cascade,
   le pouls se dessine. Pendant la saisie : la scène suit le curseur (parallaxe), le bouton principal est légèrement aimanté.
   Réactions : erreur = la carte tremble ; succès = la carte s'efface pendant que le personnage te salue ; bascule
   connexion ⇄ inscription = le pouls se redessine. Aucune donnée n'est lue ni modifiée ici.
   Tout est réservé à prefers-reduced-motion: no-preference. */
export function AuthMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const firstMode = useRef(true);
  const { mode, step, status } = useAuthUi();
  useSmoothScroll();

  useGSAP(() => {
    const el = root.current;
    if (!el) return;
    const q = gsap.utils.selector(el);
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const title = q("#auth-title")[0];
      const trace = q(".ax-stage .pulse__trace");
      const spark = q(".ax-stage .pulse__spark");
      gsap.set(title, { visibility: "hidden" });
      gsap.set(q("[data-auth-item]"), { autoAlpha: 0, y: 16 });
      gsap.set(q(".ax-panel"), { autoAlpha: 0, y: 36, scale: 0.97 });
      gsap.set(q(".ax-blob"), { autoAlpha: 0, scale: 0.7 });
      gsap.set(trace, { strokeDashoffset: 1, strokeDasharray: 1 });
      el.dataset.motion = "ready";

      SplitText.create(title, {
        type: "lines,words", mask: "lines", maskClass: "split-mask", autoSplit: true,
        onSplit: (self) => { gsap.set(title, { visibility: "visible" }); return gsap.from(self.words, { yPercent: 115, duration: 0.95, ease: "power4.out", stagger: 0.05, delay: 0.15 }); },
      });
      gsap.delayedCall(2.5, () => { gsap.set(title, { visibility: "visible" }); });

      const draw = gsap.timeline({ paused: true }).fromTo(trace, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut" });
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .add(draw.duration(2.1).play(), 0)
        .to(q(".ax-blob"), { autoAlpha: 1, scale: 1, duration: 1.4, stagger: 0.18, ease: "power2.out" }, 0)
        .to(q("[data-auth-item]"), { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.07 }, 0.35)
        .to(q(".ax-panel"), { autoAlpha: 1, y: 0, scale: 1, duration: 1, ease: "power4.out", clearProps: "transform" }, 0.25)
        .from(q(".ax-glyph"), { rotate: -140, scale: 0.4, autoAlpha: 0, duration: 1.1, ease: "back.out(1.8)" }, 0.8);

      // Halos qui dérivent, éclat qui tourne, astérisque qui tourne lentement : la scène ne reste jamais figée.
      const drifts = q(".ax-blob").map((blob, index) => gsap.to(blob, { x: index % 2 ? -38 : 44, y: index === 1 ? 36 : -30, duration: 8 + index * 2.2, ease: "sine.inOut", yoyo: true, repeat: -1, delay: index * 0.6 }));
      const sheen = gsap.to(q(".ax-stage"), { "--ax-angle": "360deg", duration: 38, ease: "none", repeat: -1 });
      const glyphSpin = gsap.to(q(".ax-glyph"), { rotate: 360, duration: 18, ease: "none", repeat: -1, delay: 2 });
      const sparkLoop = gsap.fromTo(spark, { strokeDashoffset: 0, opacity: 1 }, { strokeDashoffset: -1, duration: 6, repeat: -1, ease: "none", delay: 2 });

      // Parallaxe de la scène et bouton principal aimanté (souris uniquement).
      const cleanups: Array<() => void> = [];
      const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      const stage = q(".ax-stage")[0] as HTMLElement | undefined;
      if (fine && stage) {
        const blobMoves = q(".ax-blob").map((blob, index) => ({ x: gsap.quickTo(blob, "xPercent", { duration: 1.2, ease: "power3.out" }), y: gsap.quickTo(blob, "yPercent", { duration: 1.2, ease: "power3.out" }), depth: 6 + index * 4 }));
        const moveChar = { x: gsap.quickTo(q(".ax-welcome")[0], "x", { duration: 0.9, ease: "power3.out" }), y: gsap.quickTo(q(".ax-welcome")[0], "y", { duration: 0.9, ease: "power3.out" }) };
        const onStageMove = (event: PointerEvent) => {
          const box = stage.getBoundingClientRect();
          const nx = (event.clientX - box.left) / box.width - 0.5;
          const ny = (event.clientY - box.top) / box.height - 0.5;
          blobMoves.forEach((move) => { move.x(nx * move.depth); move.y(ny * move.depth); });
          moveChar.x(nx * 14); moveChar.y(ny * 10);
        };
        const onStageLeave = () => { blobMoves.forEach((move) => { move.x(0); move.y(0); }); moveChar.x(0); moveChar.y(0); };
        stage.addEventListener("pointermove", onStageMove);
        stage.addEventListener("pointerleave", onStageLeave);
        cleanups.push(() => { stage.removeEventListener("pointermove", onStageMove); stage.removeEventListener("pointerleave", onStageLeave); });

        const buttons = q(".ax-submit, .ax-pill");
        buttons.forEach((button) => {
          const bx = gsap.quickTo(button, "x", { duration: 0.5, ease: "power3.out" });
          const by = gsap.quickTo(button, "y", { duration: 0.5, ease: "power3.out" });
          const onMove = (event: Event) => {
            const pointer = event as PointerEvent;
            const box = (button as HTMLElement).getBoundingClientRect();
            bx(((pointer.clientX - box.left) / box.width - 0.5) * 10);
            by(((pointer.clientY - box.top) / box.height - 0.5) * 7);
          };
          const onLeave = () => { bx(0); by(0); };
          button.addEventListener("pointermove", onMove);
          button.addEventListener("pointerleave", onLeave);
          cleanups.push(() => { button.removeEventListener("pointermove", onMove); button.removeEventListener("pointerleave", onLeave); });
        });
      }

      return () => { cleanups.forEach((run) => run()); drifts.forEach((tween) => tween.kill()); sheen.kill(); glyphSpin.kill(); sparkLoop.kill(); };
    });

    return () => mm.revert();
  }, { scope: root });

  // Bascule connexion ⇄ inscription : le pouls se redessine, les champs qui apparaissent arrivent en cascade.
  useGSAP(() => {
    if (firstMode.current) { firstMode.current = false; return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = root.current;
    if (!el) return;
    const q = gsap.utils.selector(el);
    gsap.fromTo(q(".ax-stage .pulse__trace"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1, ease: "power2.inOut", overwrite: true });
    gsap.from(q(".ax-names .ax-field"), { autoAlpha: 0, y: -10, duration: 0.5, stagger: 0.08, ease: "power3.out", clearProps: "all" });
  }, { scope: root, dependencies: [mode] });

  // Mobile : l'écran suivant glisse depuis la droite.
  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(max-width: 859px)").matches) return;
    const el = root.current;
    if (!el) return;
    const q = gsap.utils.selector(el);
    const target = step === "form" ? q(".ax-form [data-ax-item], .ax-form .ax-title, .ax-form .ax-subtitle") : q(".ax-welcome-actions [data-ax-item]");
    gsap.from(target, { autoAlpha: 0, x: step === "form" ? 28 : -28, duration: 0.5, stagger: 0.05, ease: "power3.out", clearProps: "all" });
  }, { scope: root, dependencies: [step] });

  // Réactions de la carte : tremblement en cas d'erreur, sortie en douceur après une connexion réussie.
  useGSAP(() => {
    if (status !== "error" && status !== "success") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = root.current;
    if (!el) return;
    const card = gsap.utils.selector(el)(".ax-card")[0];
    if (!card) return;
    if (status === "error") gsap.fromTo(card, { x: 0 }, { keyframes: [{ x: -11 }, { x: 9 }, { x: -6 }, { x: 4 }, { x: 0 }], duration: 0.55, ease: "power2.out", clearProps: "x" });
    else gsap.to(card, { y: -10, scale: 0.985, autoAlpha: 0.0, duration: 0.55, delay: 0.85, ease: "power2.inOut" });
  }, { scope: root, dependencies: [status] });

  return <div ref={root} className="auth-root" data-motion="pending" data-mode={mode} data-step={step} data-status={status}>{children}</div>;
}

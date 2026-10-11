"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Options = {
  open: boolean;
  container: RefObject<HTMLElement | null>;
  /** Élément focalisé à l'ouverture (sinon le premier élément focalisable). */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Appelée sur Échap. Ne pas la fournir pour interdire la fermeture au clavier. */
  onEscape?: () => void;
};

/* Comportement d'accessibilité commun aux nouvelles modals : focus piégé, retour du focus à la fermeture,
   défilement de la page bloqué, Échap. (Les anciennes modals gardent leur propre copie de cette logique.) */
export function useDialogBehavior({ open, container, initialFocus, onEscape }: Options) {
  const escapeRef = useRef(onEscape);
  useEffect(() => { escapeRef.current = onEscape; }, [onEscape]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(container.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (initialFocus?.current ?? focusables()[0])?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && escapeRef.current) { event.preventDefault(); event.stopPropagation(); escapeRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!container.current?.contains(active)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    };
    // capture=true : la modal au premier plan reçoit Échap avant une éventuelle modal parente (ex. paramètres).
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [open, container, initialFocus]);
}

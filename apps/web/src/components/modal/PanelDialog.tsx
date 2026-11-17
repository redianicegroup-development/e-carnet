"use client";

import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GooLayer } from "../ui/GooLayer";
import { useDialogBehavior } from "./useDialogBehavior";

/* Fenêtre secondaire ouverte depuis une rubrique des paramètres (« Donner accès », « Reçu accès », fiche d'un profil…).
   Rendue dans <body>, avec son propre focus, et AU-DESSUS des paramètres : sans ce niveau (.modal-backdrop--panel), elle s'ouvrait derrière
   la fenêtre des paramètres et un clic sur « Donner accès » ou « Reçu accès » semblait ne rien faire. Échap et un clic à côté ferment seulement elle. */
export function PanelDialog({ title, lead, onClose, children }: { title: string; lead?: ReactNode; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useDialogBehavior({ open: true, container: dialog, initialFocus: closeButton, onEscape: onClose });
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop modal-backdrop--panel" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialog} className="modal-dialog trusted-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="trusted-panel__head"><h2 id={titleId}>{title}</h2><button ref={closeButton} type="button" className="button small" onClick={onClose} aria-label="Fermer">Fermer</button></header>
        {lead && <p className="muted">{lead}</p>}
        {children}
      </section>
      <GooLayer target={dialog} />
    </div>,
    document.body,
  );
}

"use client";

import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { GooLayer } from "../ui/GooLayer";
import { ModalIllustration } from "./ModalIllustration";
import { useDialogBehavior } from "./useDialogBehavior";

/* Modal de résultat : succès (accès accordé, demande envoyée) ou erreur avec son motif clair. Un seul bouton ; Échap, clic sur le fond
   et le bouton ferment de la même façon. Rendu dans <body> : il reste au-dessus des cartes et des menus. */
export type OutcomeDialogProps = {
  tone: "success" | "error";
  title: string;
  message: string;
  /** Précision sous le message (ex. « Dernière étape : choisissez votre mot de passe »). */
  note?: string;
  actionLabel?: string;
  onClose: () => void;
};

export function OutcomeDialog({ tone, title, message, note, actionLabel, onClose }: OutcomeDialogProps) {
  const dialog = useRef<HTMLElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();
  useDialogBehavior({ open: true, container: dialog, initialFocus: action, onEscape: onClose });
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop modal-backdrop--confirm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialog} className="modal-dialog modal-confirm" data-tone={tone === "error" ? "danger" : "neutral"} data-outcome={tone} role={tone === "error" ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}>
        <ModalIllustration mood={tone === "error" ? "oops" : "success"} size="md" />
        <div className="modal-copy">
          <h2 id={titleId}>{title}</h2>
          <p id={messageId} className="modal-message">{message}</p>
          {note && <p className="modal-note">{note}</p>}
        </div>
        <div className="modal-actions modal-actions--single"><button ref={action} type="button" className="button primary" onClick={onClose}>{actionLabel ?? (tone === "error" ? "Compris" : "Continuer")}</button></div>
      </section>
      <GooLayer target={dialog} />
    </div>,
    document.body,
  );
}

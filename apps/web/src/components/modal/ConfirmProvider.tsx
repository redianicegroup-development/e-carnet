"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ModalIllustration, type ModalMood } from "./ModalIllustration";
import { useDialogBehavior } from "./useDialogBehavior";

export type ConfirmOptions = {
  title: string;
  message: string;
  /** Précision rassurante ou conséquence, affichée sous le message (ex. « L’historique est conservé »). */
  note?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" : bouton plein rouge et focus sur « Annuler » (une touche Entrée distraite ne détruit rien). */
  tone?: "danger" | "neutral";
  /** Illustration du dossier .modal ; par défaut « question » (danger) ou « decision » (neutre). */
  mood?: ModalMood;
};

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
type Pending = ConfirmOptions & { resolve: (value: boolean) => void };

const ConfirmContext = createContext<ConfirmFn | null>(null);

/* Remplace window.confirm : `if (await confirm({...})) { ... }`. Une seule modal à la fois ; en ouvrir une
   seconde ferme la première en « non ». Fermer par Échap, par clic sur le fond ou par « Annuler » = false. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => new Promise<boolean>((resolve) => {
    pendingRef.current?.resolve(false);
    const next: Pending = { ...options, resolve };
    pendingRef.current = next;
    setPending(next);
  }), []);

  const settle = useCallback((value: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setPending(null);
    current.resolve(value);
  }, []);

  useEffect(() => () => { pendingRef.current?.resolve(false); }, []);

  return <ConfirmContext.Provider value={confirm}>{children}{pending && <ConfirmDialog options={pending} onSettle={settle} />}</ConfirmContext.Provider>;
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm doit être utilisé sous <ConfirmProvider> (monté dans app/layout.tsx).");
  return confirm;
}

function ConfirmDialog({ options, onSettle }: { options: ConfirmOptions; onSettle: (value: boolean) => void }) {
  const { title, message, note, confirmLabel = "Confirmer", cancelLabel = "Annuler", tone = "neutral" } = options;
  const mood = options.mood ?? (tone === "danger" ? "question" : "decision");
  const dialog = useRef<HTMLElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();
  const initialFocus = tone === "danger" ? cancelButton : confirmButton;

  useDialogBehavior({ open: true, container: dialog, initialFocus, onEscape: () => onSettle(false) });

  return (
    <div className="modal-backdrop modal-backdrop--confirm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onSettle(false); }}>
      <section ref={dialog} className="modal-dialog modal-confirm" data-tone={tone} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}>
        <ModalIllustration mood={mood} size="md" />
        <div className="modal-copy">
          <h2 id={titleId}>{title}</h2>
          <p id={messageId} className="modal-message">{message}</p>
          {note && <p className="modal-note">{note}</p>}
        </div>
        <div className="modal-actions">
          <button ref={cancelButton} type="button" className="button" onClick={() => onSettle(false)}>{cancelLabel}</button>
          <button ref={confirmButton} type="button" className={tone === "danger" ? "button danger" : "button primary"} onClick={() => onSettle(true)}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

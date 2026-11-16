"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GooLayer } from "../ui/GooLayer";
import { ModalIllustration } from "./ModalIllustration";
import { useDialogBehavior } from "./useDialogBehavior";

/* Révocation avec motif : l'établissement dit pourquoi il retire un professionnel ou un administrateur de laboratoire.
   Le motif est obligatoire (3 à 500 caractères) ; la personne le lira à sa prochaine connexion, un push l'avertit sans le révéler.
   Une erreur du serveur reste dans la fenêtre, sous le champ : on peut corriger sans tout reprendre. */
export const REVOCATION_REASON_MIN = 3;
export const REVOCATION_REASON_MAX = 500;

export type RevocationReasonDialogProps = {
  title: string;
  message: string;
  note?: string;
  confirmLabel?: string;
  onSubmit: (reason: string) => Promise<void>;
  onCancel: () => void;
};

export function RevocationReasonDialog({ title, message, note, confirmLabel = "Révoquer", onSubmit, onCancel }: RevocationReasonDialogProps) {
  const dialog = useRef<HTMLElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const fieldId = useId();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useDialogBehavior({ open: true, container: dialog, initialFocus: field, onEscape: () => { if (!busy) onCancel(); } });
  const trimmed = reason.trim();
  const valid = trimmed.length >= REVOCATION_REASON_MIN;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try { await onSubmit(trimmed); } catch (reason_) { setError(reason_ instanceof Error ? reason_.message : "Révocation impossible. Réessayez."); } finally { setBusy(false); }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop modal-backdrop--confirm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <form ref={dialog as React.RefObject<HTMLFormElement>} className="modal-dialog modal-confirm revocation-dialog" data-tone="danger" role="alertdialog" aria-modal="true" aria-labelledby={titleId} onSubmit={(event) => void submit(event)}>
        <ModalIllustration mood="question" size="md" />
        <div className="modal-copy">
          <h2 id={titleId}>{title}</h2>
          <p className="modal-message">{message}</p>
          {note && <p className="modal-note">{note}</p>}
        </div>
        <label className="field revocation-dialog__field" htmlFor={fieldId}>
          <span>Motif de la révocation</span>
          <textarea id={fieldId} ref={field} required minLength={REVOCATION_REASON_MIN} maxLength={REVOCATION_REASON_MAX} rows={4} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} placeholder="Ex. : fin de la collaboration, changement de structure…" />
          <small className="muted">{reason.length}/{REVOCATION_REASON_MAX} · Visible par la personne à sa prochaine connexion.</small>
        </label>
        {error && <p className="notice" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button" disabled={busy} onClick={onCancel}>Annuler</button>
          <button type="submit" className="button primary danger" disabled={busy || !valid}>{busy ? "Révocation…" : confirmLabel}</button>
        </div>
      </form>
      <GooLayer target={dialog} />
    </div>,
    document.body,
  );
}

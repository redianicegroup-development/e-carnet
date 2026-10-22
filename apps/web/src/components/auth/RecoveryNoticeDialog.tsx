"use client";

import { useId, useRef } from "react";
import { ModalIllustration } from "../modal/ModalIllustration";
import { useDialogBehavior } from "../modal/useDialogBehavior";
import { GooLayer } from "../ui/GooLayer";
import type { RecoveryNotice } from "./recoveryNotice";

/** Modal d'information de la récupération de compte (même habillage que les autres modals du produit). */
export function RecoveryNoticeDialog({ notice, onAction, onDismiss }: { notice: RecoveryNotice; onAction: (action: NonNullable<RecoveryNotice["secondary"]>) => void; onDismiss: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  const primaryButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();
  useDialogBehavior({ open: true, container: dialog, initialFocus: primaryButton, onEscape: onDismiss });
  return <div className="modal-backdrop modal-backdrop--confirm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onDismiss(); }}>
    <section ref={dialog} className="modal-dialog modal-confirm" data-tone={notice.tone === "danger" ? "danger" : "neutral"} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}>
      <ModalIllustration mood={notice.mood} size="md" />
      <div className="modal-copy">
        <h2 id={titleId}>{notice.title}</h2>
        <p id={messageId} className="modal-message">{notice.message}</p>
        {notice.note && <p className="modal-note">{notice.note}</p>}
      </div>
      <div className={notice.secondary ? "modal-actions" : "modal-actions modal-actions--single"}>
        {notice.secondary && <button type="button" className="button" onClick={() => onAction(notice.secondary!)}>{notice.secondaryLabel}</button>}
        <button ref={primaryButton} type="button" className="button primary" onClick={() => onAction(notice.primary)}>{notice.primaryLabel}</button>
      </div>
    </section>
    <GooLayer target={dialog} />
  </div>;
}

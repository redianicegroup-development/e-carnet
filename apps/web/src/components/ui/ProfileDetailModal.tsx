"use client";

import { useId, useRef, type ReactNode } from "react";
import { useDialogBehavior } from "../modal/useDialogBehavior";
import "./profile-detail.css";

export type DetailRow = { label: string; value: ReactNode };

/* Fiche ouverte en touchant une photo ronde (patient, établissement, demande). Lecture seule : elle montre ce que
   l'utilisateur voit déjà ailleurs, jamais plus. Échap, clic sur le fond ou « × » ferment. */
export function ProfileDetailModal({ title, subtitle, avatar, rows, onClose, children }: {
  title: string; subtitle?: string; avatar?: ReactNode; rows: DetailRow[]; onClose: () => void; children?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useDialogBehavior({ open: true, container: panel, initialFocus: closeButton, onEscape: onClose });
  return (
    <div className="profile-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="profile-modal__panel" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
        <header className="profile-modal__head">
          {avatar}
          <div><h2 id={titleId}>{title}</h2>{subtitle && <p className="muted">{subtitle}</p>}</div>
          <button ref={closeButton} type="button" className="profile-modal__close" aria-label="Fermer" onClick={onClose}>×</button>
        </header>
        {rows.length > 0 && <dl className="kv">{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>}
        {children}
      </div>
    </div>
  );
}

"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogBehavior } from "../modal/useDialogBehavior";
import { GooLayer } from "./GooLayer";
import { PersonAvatar } from "./PersonAvatar";
import "./profile.css";

export type ProfileRow = { label: string; value: ReactNode };
/** `close` ferme la fiche. Une action peut renvoyer une phrase (ex. « Identifiant copié. ») : elle s'affiche dans la fiche, au-dessus des boutons. */
export type ProfileAction = {
  label: string;
  onClick: (context: { close: () => void }) => void | string | Promise<void | string>;
  tone?: "default" | "primary" | "danger";
  disabled?: boolean;
};
export type ProfileSheetProps = {
  name: string;
  subtitle?: string;
  /** Photo de la personne (URL) ; à défaut, ses initiales. */
  photo?: string | null;
  /** Remplace la photo par défaut (logo d'établissement, photo + logo…). Reçoit la taille à dessiner. */
  avatar?: (size: number) => ReactNode;
  rows?: ProfileRow[];
  note?: ReactNode;
  actions?: ProfileAction[];
  onClose: () => void;
  /** Contenu libre entre les informations et la note (listes d'historique, avis…). */
  children?: ReactNode;
};

const TONE_CLASS: Record<NonNullable<ProfileAction["tone"]>, string> = { default: "button", primary: "button primary", danger: "button primary danger" };

/* LA fiche d'une personne (ou d'un établissement) : photo ronde, nom, informations en tuiles, puis les boutons d'action TOUJOURS en bas.
   Une seule présentation pour l'équipe de l'établissement, les laboratoires, les patients, les accès du professionnel et les profils d'enfants.
   « Fermer » est toujours le premier bouton ; les actions propres à la fiche (Révoquer, Voir le dossier…) viennent après.
   Rendue dans <body>, au-dessus des paramètres et des fenêtres d'action, sous les confirmations (une révocation se confirme par-dessus la fiche).
   Échap et un clic à côté ferment seulement elle. */
export function ProfileSheet({ name, subtitle, photo, avatar, rows = [], note, actions = [], onClose, children }: ProfileSheetProps) {
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  useDialogBehavior({ open: true, container: dialog, initialFocus: closeButton, onEscape: onClose });

  async function run(action: ProfileAction) {
    setStatus("");
    setPending(true);
    try {
      const result = await action.onClick({ close: onClose });
      if (typeof result === "string") setStatus(result);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action impossible pour le moment.");
    } finally {
      setPending(false);
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop modal-backdrop--sheet" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialog} className="modal-dialog profile-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="profile-sheet__body">
          {avatar ? avatar(84) : <PersonAvatar src={photo} name={name} size={84} />}
          <h2 id={titleId}>{name}</h2>
          {subtitle && <p className="profile-sheet__subtitle muted">{subtitle}</p>}
          {rows.length > 0 && <dl className="profile-sheet__list">{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>}
          {children}
          {note && <p className="profile-sheet__note muted">{note}</p>}
        </div>
        <footer className="profile-sheet__actions">
          <p className="profile-sheet__status" role="status" aria-live="polite">{status}</p>
          <div className="modal-actions">
            <button ref={closeButton} type="button" className="button" onClick={onClose}>Fermer</button>
            {actions.map((action) => (
              <button key={action.label} type="button" className={TONE_CLASS[action.tone ?? "default"]} disabled={pending || action.disabled} onClick={() => void run(action)}>{action.label}</button>
            ))}
          </div>
        </footer>
      </section>
      <GooLayer target={dialog} />
    </div>,
    document.body,
  );
}

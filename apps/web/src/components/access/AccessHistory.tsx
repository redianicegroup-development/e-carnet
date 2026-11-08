"use client";

import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { EstablishmentLogo } from "../EstablishmentLogo";
import { useDialogBehavior } from "../modal/useDialogBehavior";
import { Icon, type IconName } from "../ui/Icon";
import { PersonAvatar } from "../ui/PersonAvatar";
import { STATUS_LABELS, formatClock, formatDay, formatWhen, timeLeft, type EventKind, type ProfessionalHistory } from "./access-history";
import "./access-history.css";

const KIND_ICON: Record<EventKind, IconName> = { open: "check", request: "bell", read: "eye", extend: "clock", refuse: "close", revoke: "close", end: "logout", expire: "clock", other: "alert" };

/** Photo du professionnel (avec le logo de sa structure en pastille), son nom et sa fonction : la même identité partout dans l'historique. */
export function AccessWho({ name, avatar, logo, facility, subtitle, size = 52 }: { name: string; avatar?: string; logo?: string; facility: string; subtitle?: string; size?: number }) {
  return (
    <span className="access-who">
      <span className="access-who__photo"><PersonAvatar src={avatar} name={name} size={size} /><EstablishmentLogo logo={logo} name={facility} size={Math.round(size * 0.42)} /></span>
      <span className="access-who__text"><strong>{name}</strong><span className="muted">{subtitle ? `${subtitle} · ` : ""}{facility}</span></span>
    </span>
  );
}

/** Une carte par professionnel : l'historique reste court, le détail s'ouvre au toucher. */
export function ProfessionalHistoryList({ histories, onOpen }: { histories: ProfessionalHistory[]; onOpen: (history: ProfessionalHistory) => void }) {
  return (
    <ul className="access-pros">
      {histories.map((history) => {
        const live = history.activeGrant ? timeLeft(history.activeGrant.expires_at) : null;
        return (
          <li key={history.key}>
            <button type="button" className="access-pro" onClick={() => onOpen(history)} aria-haspopup="dialog" aria-label={`Voir tout l’historique de ${history.name}`}>
              <AccessWho name={history.name} avatar={history.avatar} logo={history.logo} facility={history.facility} subtitle={history.title} />
              <span className="access-pro__meta">
                {history.activeGrant
                  ? <span className="badge verified">Accès actif{live ? ` · ${live}` : ""}</span>
                  : history.pendingGrant ? <span className="badge declared">À décider</span> : null}
                <span className="muted access-pro__last">{history.lastLine.title}<br />{formatWhen(history.lastAt)}</span>
                <span className="access-pro__counts muted">{history.sessions.length} accès{history.reads > 0 ? ` · ${history.reads} lecture${history.reads > 1 ? "s" : ""}` : ""}</span>
              </span>
              <Icon name="chevron" size={18} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Tout ce qu'un professionnel a fait avec les accès du patient, accès par accès, dans l'ordre où cela s'est passé. */
export function ProfessionalHistoryDialog({ history, onClose }: { history: ProfessionalHistory; onClose: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useDialogBehavior({ open: true, container: dialog, initialFocus: closeButton, onEscape: onClose });
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="modal-backdrop access-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialog} className="modal-dialog access-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="access-dialog__head">
          <h2 id={titleId} className="sr-only">Historique de {history.name}</h2>
          <AccessWho name={history.name} avatar={history.avatar} logo={history.logo} facility={history.facility} subtitle={history.title} size={64} />
          <button ref={closeButton} type="button" className="access-dialog__close" onClick={onClose} aria-label="Fermer l’historique"><Icon name="close" size={18} /></button>
        </header>
        <p className="access-dialog__summary">
          <span className="access-chip">{history.sessions.length} accès</span>
          <span className="access-chip">{history.reads} lecture{history.reads > 1 ? "s" : ""} de votre carnet</span>
          {history.activeGrant && <span className="access-chip access-chip--live">Accès actif{timeLeft(history.activeGrant.expires_at) ? ` · il reste ${timeLeft(history.activeGrant.expires_at)}` : ""}</span>}
        </p>
        <ol className="access-sessions">
          {history.sessions.map((session) => (
            <li className="access-session" key={session.id}>
              <div className="access-session__head">
                <div>
                  <strong>{session.grant || session.id !== "sans-acces" ? `Accès du ${formatDay(session.startedAt)}` : "Autres événements"}</strong>
                  <span className="muted">{formatClock(session.startedAt)}{session.endedAt ? ` → ${formatClock(session.endedAt)}` : ""}</span>
                </div>
                {session.status && <span className={`badge ${session.status === "active" ? "verified" : "declared"}`}>{STATUS_LABELS[session.status] ?? session.status}</span>}
              </div>
              <ol className="access-timeline">
                {session.lines.map((line) => (
                  <li className={`access-line access-line--${line.tone}`} key={line.id}>
                    <span className="access-line__dot" aria-hidden="true"><Icon name={KIND_ICON[line.kind]} size={14} /></span>
                    <div className="access-line__body"><strong>{line.title}</strong>{line.detail && <p>{line.detail}</p>}</div>
                    <time dateTime={line.at}>{formatClock(line.at)}</time>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
        <button type="button" className="button access-dialog__done" onClick={onClose}>Fermer</button>
      </section>
    </div>,
    document.body,
  );
}

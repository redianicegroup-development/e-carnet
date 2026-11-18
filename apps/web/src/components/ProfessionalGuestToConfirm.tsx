"use client";

import type { GuestConsultationToConfirm } from "../application/guest-access";
import { PersonAvatar } from "./ui/PersonAvatar";
import "./guest-access.css";

const DAY = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

/* Mode invité, médecin sans téléphone : ce qui a été écrit en son nom sur le téléphone d'un patient. Rien n'est signé : le médecin relit
   chaque consultation (dans le formulaire habituel, prérempli), la corrige au besoin et la signe, ou la rejette s'il ne la reconnaît pas. */
export function ProfessionalGuestToConfirm({ items, activeId, onReview, onReject }: {
  items: GuestConsultationToConfirm[];
  activeId: string | null;
  onReview: (item: GuestConsultationToConfirm) => void;
  onReject: (item: GuestConsultationToConfirm) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="card guest-confirm" aria-labelledby="guest-confirm-title">
      <span className="eyebrow">Mode invité</span>
      <h2 id="guest-confirm-title">Consultations à confirmer <span className="badge pending">{items.length}</span></h2>
      <p className="muted">Écrites en votre nom sur le téléphone d’un patient. Relisez chacune avant de la signer : tant que vous ne l’avez pas fait, elle n’est pas dans le carnet du patient.</p>
      <div className="stack">
        {items.map((item) => (
          <article className="guest-confirm__item" key={item.id} aria-current={item.id === activeId ? "true" : undefined}>
            <div className="guest-confirm__who">
              <PersonAvatar src={item.patient_avatar} name={item.patient_name} size={44} />
              <div><strong>{item.patient_name || "Patient"}</strong><small className="muted">{item.draft.reason || "Sans motif"}</small><small className="muted">Écrite le {DAY.format(new Date(item.written_at))} · à confirmer avant le {DAY.format(new Date(item.expires_at))}</small></div>
            </div>
            <div className="guest-access__actions">
              <button className="button primary" type="button" disabled={item.id === activeId} onClick={() => onReview(item)}>{item.id === activeId ? "En cours de relecture" : "Relire et confirmer"}</button>
              <button className="button" type="button" onClick={() => onReject(item)}>Je ne la reconnais pas</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

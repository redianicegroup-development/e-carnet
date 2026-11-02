"use client";

import { useId, useState } from "react";
import type { ConsultationRecord } from "../lib/care-records";
import { Icon } from "./ui/Icon";
import "./consultation-seal.css";

const SEAL_DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

/* Sceau de validation (maquette « Consultations ») : « Ouvrir le sceau » déplie qui a validé la consultation, où et quand,
   avec une référence courte pour la retrouver. Tout vient de la consultation elle-même ; rien n'est ajouté ni calculé. */
export function ConsultationSealPanel({ item }: { item: ConsultationRecord }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const reference = item.id.replace(/-/g, "").slice(0, 8).toUpperCase();
  return (
    <div className="seal">
      <button className="button small seal__toggle" type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
        {open ? "Fermer le sceau" : "Ouvrir le sceau"} <Icon name="qr" size={16} />
      </button>
      {open && (
        <div className="seal__panel" id={panelId} role="group" aria-label="Sceau de validation">
          <svg className="seal__stamp" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="32" cy="32" r="23" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
            <path d="M21 33l8 8 15-17" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <dl className="kv">
            <div><dt>Validée par</dt><dd>{item.professional_name}</dd></div>
            <div><dt>Établissement</dt><dd>{item.facility_label}</dd></div>
            <div><dt>Le</dt><dd><time dateTime={item.validated_at}>{SEAL_DATE.format(new Date(item.validated_at))}</time></dd></div>
            <div><dt>Provenance</dt><dd>{item.provenance.label}</dd></div>
            <div><dt>Référence</dt><dd><code>{reference}</code></dd></div>
          </dl>
          <p className="muted">Le sceau rappelle qui a validé cette consultation, où et quand. Seules les consultations validées figurent dans votre carnet.</p>
        </div>
      )}
    </div>
  );
}

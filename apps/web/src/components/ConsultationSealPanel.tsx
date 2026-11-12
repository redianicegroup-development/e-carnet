"use client";

import { useState } from "react";
import type { ConsultationRecord } from "../lib/care-records";
import "./consultation-seal.css";

const SEAL_DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

/** Image de la signature ou du cachet figés sur la consultation (servie au patient et au professionnel signataire seulement). */
export function sealImageUrl(consultationId: string, kind: "signature" | "stamp"): string {
  return `/api/v1/patient/care/consultations/${consultationId}/seal/${kind}/`;
}

function SealImage({ id, kind, label }: { id: string; kind: "signature" | "stamp"; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null; // image indisponible (stockage injoignable) : on n'affiche rien plutôt qu'une image cassée
  return (
    <figure>
      <span className={`consult-seal-images__paper consult-seal-images__paper--${kind}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- image privée servie par l'API, avec cookie de session */}
        <img src={sealImageUrl(id, kind)} alt={label} loading="lazy" onError={() => setFailed(true)} />
      </span>
      <figcaption>{kind === "signature" ? "Signature" : "Cachet"}</figcaption>
    </figure>
  );
}

/** Signature et cachet du médecin tels qu'ils étaient au moment de la validation. Rien si la consultation n'en porte pas (anciennes consultations). */
export function SealImages({ item }: { item: ConsultationRecord }) {
  if (!item.has_signature && !item.has_stamp) return null;
  return (
    <div className="consult-seal-images">
      {item.has_signature && <SealImage id={item.id} kind="signature" label={`Signature de ${item.professional_name}`} />}
      {item.has_stamp && <SealImage id={item.id} kind="stamp" label={`Cachet de ${item.professional_name}`} />}
    </div>
  );
}

/* Sceau de validation (maquette « Consultations ») : « Ouvrir le sceau » déplie qui a validé la consultation, où et quand, avec une
   référence courte pour la retrouver, et la signature et le cachet que le médecin avait enregistrés ce jour-là (ils restent attachés
   à la consultation, même si le médecin les remplace plus tard). Tout vient de la consultation elle-même ; rien n'est calculé. */
export function ConsultationSealPanel({ item, id, images = true }: { item: ConsultationRecord; id: string; images?: boolean }) {
  const reference = item.id.replace(/-/g, "").slice(0, 8).toUpperCase();
  return (
    <div className="seal__panel" id={id} role="group" aria-label="Sceau de validation">
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
      {images && <SealImages item={item} />}
      <p className="muted">Le sceau rappelle qui a validé cette consultation, où et quand. Seules les consultations validées figurent dans votre carnet.</p>
    </div>
  );
}


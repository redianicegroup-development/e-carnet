"use client";

import { useEffect, useState } from "react";
import { listProfessionalConsultations, listProfessionalGrants, type ProfessionalGrant } from "../application/professional-access-grants";
import { listedUntil, recentPatientName, type RecentPatient } from "../lib/recent-patients";
import { GRANT_STATUS_LABELS, normalizeName, scopeText } from "../lib/grant-labels";
import { formatDay, formatWhen } from "./access/access-history";
import { PersonAvatar } from "./ui/PersonAvatar";
import { ProfileDetailModal } from "./ui/ProfileDetailModal";

type ConsultationLine = { reason?: string; facility_label?: string; patient_name?: string } & Record<string, unknown>;

function dateOf(item: ConsultationLine): string | null {
  for (const key of ["signed_at", "validated_at", "created_at"]) { const value = item[key]; if (typeof value === "string") return value; }
  return null;
}

/* Fiche d'un « patient reçu récemment ». Elle ne contient rien de médical et ne donne aucun accès au carnet :
   uniquement l'identité affichée dans la liste et ce que le professionnel a déjà fait avec ce patient
   (ses propres demandes d'accès et ses propres consultations signées), retrouvées par le nom. */
export function ProfessionalPatientDetail({ row, onClose }: { row: RecentPatient; onClose: () => void }) {
  const name = recentPatientName(row);
  const [grants, setGrants] = useState<ProfessionalGrant[] | null>(null);
  const [consultations, setConsultations] = useState<ConsultationLine[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const wanted = normalizeName(name);
    Promise.all([listProfessionalGrants(), listProfessionalConsultations()])
      .then(([grantRows, consultationRows]) => {
        if (!active) return;
        setGrants(grantRows.filter((item) => normalizeName(item.patient_name ?? "") === wanted));
        setConsultations((consultationRows as unknown as ConsultationLine[]).filter((item) => normalizeName(item.patient_name ?? "") === wanted));
      })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [name]);

  const until = listedUntil(row.last_accessed_at);
  return (
    <ProfileDetailModal
      title={name}
      subtitle="Patient reçu récemment"
      avatar={<PersonAvatar name={name} size={56} />}
      rows={[
        { label: "Nom", value: row.last_name || "—" },
        { label: "Prénom", value: row.first_name || "—" },
        { label: "Dernier accès", value: formatWhen(row.last_accessed_at) },
        ...(until ? [{ label: "Reste dans la liste jusqu’au", value: formatDay(until) }] : []),
      ]}
      onClose={onClose}
    >
      {failed && <p className="notice" role="alert">Historique indisponible pour le moment.</p>}
      {!failed && (grants === null || consultations === null) && <p className="muted">Chargement de l’historique…</p>}
      {grants && (
        <section className="profile-modal__section">
          <h3>Vos accès à ce patient</h3>
          {grants.length === 0 ? <p className="muted">Aucun accès retrouvé sous ce nom.</p> : (
            <ul className="profile-modal__list">
              {grants.slice(0, 8).map((item) => (
                <li key={item.id}><strong>{GRANT_STATUS_LABELS[item.status] ?? item.status}</strong><span>{scopeText(item.scope)}</span><span className="muted">{formatWhen(((item as unknown as { starts_at?: string }).starts_at ?? item.expires_at) as string)}</span></li>
              ))}
            </ul>
          )}
        </section>
      )}
      {consultations && (
        <section className="profile-modal__section">
          <h3>Consultations que vous avez signées</h3>
          {consultations.length === 0 ? <p className="muted">Aucune consultation signée sous ce nom.</p> : (
            <ul className="profile-modal__list">
              {consultations.slice(0, 8).map((item, index) => (
                <li key={index}><strong>{item.reason || "Consultation"}</strong>{item.facility_label && <span>{item.facility_label}</span>}{dateOf(item) && <span className="muted">{formatWhen(dateOf(item) as string)}</span>}</li>
              ))}
            </ul>
          )}
        </section>
      )}
      <p className="profile-modal__note muted">Cette fiche ne donne aucun accès au carnet. Pour revoir ce patient, faites une nouvelle demande qu’il devra autoriser.</p>
    </ProfileDetailModal>
  );
}

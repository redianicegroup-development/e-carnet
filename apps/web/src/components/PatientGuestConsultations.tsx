"use client";

import { useEffect, useState } from "react";
import { listMyGuestConsultations, type PatientGuestConsultation } from "../application/guest-access";
import "./guest-access.css";

const DAY = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

const STATUS: Record<PatientGuestConsultation["status"], { badge: string; text: (item: PatientGuestConsultation) => string }> = {
  awaiting_confirmation: { badge: "En attente de confirmation", text: (item) => `${item.professional_name} doit la relire et la signer avant le ${DAY.format(new Date(item.expires_at))}. Elle n’est pas signée : elle entrera dans votre carnet une fois confirmée.` },
  rejected: { badge: "Non confirmée", text: (item) => `${item.professional_name} ne l’a pas confirmée. Elle n’a pas été ajoutée à votre carnet.` },
  expired: { badge: "Expirée", text: () => "Le délai de confirmation est dépassé : elle n’a jamais été signée et n’est pas dans votre carnet." },
};

/* Consultations écrites sur le téléphone du patient par un médecin sans téléphone : jamais présentées comme signées. Rien si aucune n'existe. */
export function PatientGuestConsultations({ refreshKey = 0 }: { refreshKey?: number }) {
  const [items, setItems] = useState<PatientGuestConsultation[]>([]);
  useEffect(() => {
    let active = true;
    listMyGuestConsultations().then((list) => { if (active) setItems(list); }).catch(() => { if (active) setItems([]); });
    return () => { active = false; };
  }, [refreshKey]);
  if (items.length === 0) return null;
  return (
    <section className="stack" aria-labelledby="guest-waiting-title">
      <span className="eyebrow">Mode invité</span>
      <h2 id="guest-waiting-title">Consultations non signées</h2>
      <div className="stack">
        {items.map((item) => (
          <article className="card guest-waiting" key={item.id}>
            <div><strong>{item.reason || "Consultation"}</strong><small className="muted">Écrite le {DAY.format(new Date(item.written_at))} · {item.facility_label}</small></div>
            <span className={`badge ${item.status === "awaiting_confirmation" ? "pending" : ""}`}>{STATUS[item.status].badge}</span>
            <p className="muted">{STATUS[item.status].text(item)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

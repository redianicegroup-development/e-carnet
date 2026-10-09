"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";

type Consultation = { id: string; professional_name: string; facility_label: string; reason: string; observations: string; conclusion: string; care_plan: string; validated_at: string; provenance: { label: string } };

export function PatientConsultations() {
  const [items, setItems] = useState<Consultation[] | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    apiGet<Consultation[]>("/api/v1/patient/care/consultations/").then((data) => { if (active) setItems(data); }).catch((error) => { if (active) { setItems([]); setMessage(error instanceof Error ? error.message : "Historique indisponible."); } });
    return () => { active = false; };
  }, []);

  return (
    <section className="stack" aria-label="Consultations validées">
      <div className="section-heading"><div><span className="eyebrow">Validées par un professionnel</span><h2>Mes consultations</h2></div><span className="count-badge">{items?.length ?? "…"}</span></div>
      {message && <p className="notice" role="alert">{message}</p>}
      {items === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /></div> : items.length === 0 ? <p className="empty">Aucune consultation validée pour le moment.</p> : items.map((item) => (
        <article className="card" key={item.id}>
          <div className="section-heading">
            <div><h3>{item.reason}</h3><p className="muted">{item.professional_name} · {item.facility_label} · {new Date(item.validated_at).toLocaleDateString("fr-FR")}</p></div>
            <span className="badge verified">{item.provenance.label}</span>
          </div>
          {item.observations && <p><strong>Observations :</strong> {item.observations}</p>}
          {item.conclusion && <p><strong>Conclusion :</strong> {item.conclusion}</p>}
          {item.care_plan && <p><strong>Prise en charge :</strong> {item.care_plan}</p>}
        </article>
      ))}
    </section>
  );
}

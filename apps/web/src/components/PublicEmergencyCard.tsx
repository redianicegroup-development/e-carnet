"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";

type PublicEmergencyCardData = {
  blood_group: string;
  allergies: { label: string; details: string }[];
  treatments: { label: string; details: string }[];
  contact_name: string;
  contact_phone: string;
};

export function PublicEmergencyCard({ token }: { token: string }) {
  const [data, setData] = useState<PublicEmergencyCardData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let active = true;
    apiGet<PublicEmergencyCardData>(`/api/v1/patient/emergency-card/qr/${encodeURIComponent(token)}/`)
      .then((card) => { if (active) { setData(card); setStatus("ready"); } })
      .catch(() => { if (active) setStatus("missing"); });
    return () => { active = false; };
  }, [token]);

  if (status === "loading") return <main className="emergency-public"><section className="emergency-public__card" role="status"><span className="emergency-public__pulse" /><h1>Ouverture de la carte d’urgence…</h1></section></main>;
  if (status === "missing" || !data) return <main className="emergency-public"><section className="emergency-public__card" role="alert"><span className="eyebrow">E‑Carnet</span><h1>Carte indisponible</h1><p>Ce QR a peut-être été désactivé ou renouvelé par son propriétaire.</p></section></main>;

  return <main className="emergency-public"><article className="emergency-public__card">
    <div className="emergency-public__brand"><span className="emergency-public__mark" aria-hidden="true">+</span><span><strong>E‑Carnet</strong><small>Carte d’urgence déclarative</small></span></div>
    <header><span className="eyebrow">À présenter aux secours</span><h1>Informations d’urgence</h1><p>Ces informations ont été déclarées par le titulaire de la carte.</p></header>
    <section className="emergency-public__blood"><span>Groupe sanguin déclaré</span><strong>{data.blood_group || "Non renseigné"}</strong></section>
    <section className="emergency-public__section"><h2>Allergies déclarées</h2>{data.allergies.length ? <ul>{data.allergies.map((item, index) => <li key={`${item.label}-${index}`}><strong>{item.label}</strong>{item.details && <span>{item.details}</span>}</li>)}</ul> : <p>Aucune allergie déclarée</p>}</section>
    <section className="emergency-public__section"><h2>Traitements déclarés</h2>{data.treatments.length ? <ul>{data.treatments.map((item, index) => <li key={`${item.label}-${index}`}><strong>{item.label}</strong>{item.details && <span>{item.details}</span>}</li>)}</ul> : <p>Aucun traitement déclaré</p>}</section>
    <section className="emergency-public__contact"><h2>Contact à prévenir</h2>{data.contact_name || data.contact_phone ? <><strong>{data.contact_name || "Contact"}</strong>{data.contact_phone && <a href={`tel:${data.contact_phone.replace(/[^+\d]/g, "")}`}>{data.contact_phone}</a>}</> : <p>Aucun contact renseigné</p>}</section>
    <p className="emergency-public__notice">Cette carte contient des déclarations personnelles, non vérifiées par E‑Carnet. Elle ne remplace pas un avis médical ni les services d’urgence.</p>
  </article></main>;
}

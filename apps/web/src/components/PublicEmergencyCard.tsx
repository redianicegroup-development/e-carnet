"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import { EmergencyCardVisual, type EmergencyCardView } from "./emergency-card/EmergencyCardVisual";
import { Icon } from "./ui/Icon";

export function PublicEmergencyCard({ token }: { token: string }) {
  const [data, setData] = useState<EmergencyCardView | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let active = true;
    apiGet<EmergencyCardView>(`/api/v1/patient/emergency-card/qr/${encodeURIComponent(token)}/`)
      .then((card) => { if (active) { setData(card); setStatus("ready"); } })
      .catch(() => { if (active) setStatus("missing"); });
    return () => { active = false; };
  }, [token]);

  if (status === "loading") return <main className="epub"><section className="epub__state" role="status"><span className="epub__pulse" /><h1>Ouverture de la carte d’urgence…</h1></section></main>;
  if (status === "missing" || !data) return <main className="epub"><section className="epub__state" role="alert"><span className="eyebrow">Mon E‑Carnet</span><h1>Carte indisponible</h1><p>Ce QR a peut-être été désactivé ou renouvelé par son propriétaire.</p></section></main>;

  const phone = data.contact_phone.replace(/[^+\d]/g, "");
  return <main className="epub"><div className="epub__inner">
    <div className="epub__intro"><span className="eyebrow">À présenter aux secours</span><p>Informations d’urgence déclarées par le titulaire de la carte.</p></div>
    <EmergencyCardVisual card={data} showQr={false} />
    {phone && <a className="epub__call" href={`tel:${phone}`}><Icon name="phone" size={22} /><span>Appeler {data.contact_name || "le contact d’urgence"}<small>{data.contact_phone}</small></span></a>}
    <p className="epub__notice">Cette carte contient des déclarations personnelles, non vérifiées par Mon E‑Carnet. Elle ne remplace pas un avis médical ni les services d’urgence.</p>
  </div></main>;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listProfessionalConsultations, listProfessionalGrants } from "../application/professional-access-grants";
import { buildAgenda, type ConsultationLike } from "../lib/agenda";
import { AgendaEntries } from "./AgendaEntries";

const WEEKDAY_DATE = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/* Accueil médecin (maquette « Aujourd'hui ») : les consultations validées aujourd'hui, et combien de patients ont ouvert un accès actif.
   Aucun nom de patient ici : la liste des consultations n'en porte pas. */
export function ProfessionalToday() {
  const [consultations, setConsultations] = useState<ConsultationLike[] | null>(null);
  const [activeGrants, setActiveGrants] = useState(0);

  useEffect(() => {
    let active = true;
    listProfessionalConsultations().then((data) => { if (active) setConsultations(data); }).catch(() => { if (active) setConsultations([]); });
    listProfessionalGrants().then((data) => { if (active) setActiveGrants(data.filter((item) => item.status === "active").length); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const now = new Date();
  const entries = consultations ? buildAgenda({ consultations }, now, 1)[0].entries : [];
  return (
    <section className="card today-card" aria-labelledby="professional-today-title">
      <div className="section-heading"><div><span className="eyebrow">{WEEKDAY_DATE.format(now)}</span><h2 id="professional-today-title">Aujourd’hui</h2></div><Link href="/professionnel/agenda">Agenda</Link></div>
      {consultations === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /></div> : entries.length > 0 ? <AgendaEntries entries={entries} /> : <p className="muted">Aucune consultation validée aujourd’hui.</p>}
      {activeGrants > 0 && <p className="muted"><Link href="/professionnel/patients">{activeGrants} accès actif{activeGrants > 1 ? "s" : ""}</Link> : des patients vous ont ouvert leur carnet.</p>}
    </section>
  );
}

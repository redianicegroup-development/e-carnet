"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listProfessionalConsultations } from "../application/professional-access-grants";
import { buildAgenda, dayLabel, startOfDay, type ConsultationLike } from "../lib/agenda";
import { AgendaEntries } from "./AgendaEntries";

const DAYS_BACK = 14;

/* Agenda du professionnel : ses consultations validées, jour par jour, sur les 14 derniers jours. Les rendez-vous pris par les patients
   n'y figurent pas encore : ils ne sont pas rattachés à un professionnel. */
export function ProfessionalAgenda() {
  const [consultations, setConsultations] = useState<ConsultationLike[] | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    listProfessionalConsultations().then((data) => { if (active) setConsultations(data); }).catch((error) => { if (active) { setConsultations([]); setMessage(error instanceof Error ? error.message : "Agenda indisponible."); } });
    return () => { active = false; };
  }, []);

  const today = startOfDay(new Date());
  const days = buildAgenda({ consultations: consultations ?? [] }, today, -DAYS_BACK).filter((day, index) => index === 0 || day.entries.length > 0);
  return (
    <div className="stack-lg">
      <header className="page-header"><span className="eyebrow">Mon agenda</span><h1>Vos consultations, jour par jour</h1><p className="lead">Les {DAYS_BACK} derniers jours. Les rendez-vous pris par les patients ne figurent pas encore ici.</p></header>
      {message && <p className="notice" role="alert">{message}</p>}
      {consultations === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement de l’agenda…</span><i /></div> : (
        <section className="card" aria-label="Consultations validées par jour">
          {days.map((day) => (
            <div className="agenda-day" key={day.key}>
              <h2 className="agenda-day__title">{dayLabel(day.date, today)}</h2>
              {day.entries.length > 0 ? <AgendaEntries entries={day.entries} /> : <p className="muted">Aucune consultation validée aujourd’hui.</p>}
            </div>
          ))}
        </section>
      )}
      <p className="muted">Le détail de chaque consultation est dans <Link href="/professionnel/consultations">Consultations</Link>.</p>
    </div>
  );
}

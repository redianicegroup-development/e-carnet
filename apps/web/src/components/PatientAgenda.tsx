"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import { buildAgenda, dayLabel, startOfDay, type AppointmentLike, type ReminderLike } from "../lib/agenda";
import { AgendaEntries } from "./AgendaEntries";

/* Agenda du patient : prises de médicaments (selon les jours choisis) et rendez-vous, jour par jour, sur 7 ou 30 jours. */
export function PatientAgenda() {
  const [range, setRange] = useState<7 | 30>(7);
  const [reminders, setReminders] = useState<ReminderLike[] | null>(null);
  const [appointments, setAppointments] = useState<AppointmentLike[] | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    apiGet<ReminderLike[]>("/api/v1/patient/care/medication-reminders/").then((data) => { if (active) setReminders(data); }).catch((error) => { if (active) { setReminders([]); setMessage(error instanceof Error ? error.message : "Agenda indisponible."); } });
    apiGet<AppointmentLike[]>("/api/v1/patient/care/appointments/").then((data) => { if (active) setAppointments(data); }).catch(() => { if (active) setAppointments([]); });
    return () => { active = false; };
  }, []);

  const loading = reminders === null || appointments === null;
  const today = startOfDay(new Date());
  const days = buildAgenda({ reminders: reminders ?? [], appointments: appointments ?? [] }, today, range).filter((day, index) => index === 0 || day.entries.length > 0);

  return (
    <div className="stack-lg">
      <header className="page-header"><span className="eyebrow">Mon agenda</span><h1>Aujourd’hui et à venir</h1><p className="lead">Vos prises de médicaments et vos rendez-vous, jour par jour.</p></header>
      <div className="seg" role="group" aria-label="Période affichée">
        {([7, 30] as const).map((value) => <button key={value} type="button" aria-pressed={range === value} className={range === value ? "is-active" : undefined} onClick={() => setRange(value)}>{value} jours</button>)}
      </div>
      {message && <p className="notice" role="alert">{message}</p>}
      {loading ? <div className="skeleton" role="status"><span className="sr-only">Chargement de l’agenda…</span><i /></div> : (
        <section className="card" aria-label={`Agenda des ${range} prochains jours`}>
          {days.map((day) => (
            <div className="agenda-day" key={day.key}>
              <h2 className="agenda-day__title">{dayLabel(day.date, today)}</h2>
              {day.entries.length > 0 ? <AgendaEntries entries={day.entries} /> : <p className="muted">Rien de prévu aujourd’hui.</p>}
            </div>
          ))}
          {days.length === 1 && days[0].entries.length === 0 && <p className="muted">Aucun rendez-vous ni prise prévue sur {range} jours. Vos rappels se règlent dans <Link href="/patient/carnet">Mon carnet</Link>.</p>}
        </section>
      )}
      <p className="muted">Vos rendez-vous et vos rappels viennent de votre carnet. Les modifier se fait dans <Link href="/patient/carnet">Mon carnet</Link>.</p>
    </div>
  );
}

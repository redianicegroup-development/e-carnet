"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import { buildAgenda, type AppointmentLike, type ReminderLike } from "../lib/agenda";
import { AgendaEntries } from "./AgendaEntries";
import { Icon } from "./ui/Icon";

const WEEKDAY_DATE = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "short" });

/* Accueil patient (maquette) : la prochaine consultation, puis « Aujourd'hui » (prises et rendez-vous du jour) quand il y a quelque chose.
   Rien ne s'affiche tant que rien n'est prévu : pas de carte vide sur l'accueil. */
export function PatientToday() {
  const [reminders, setReminders] = useState<ReminderLike[]>([]);
  const [appointments, setAppointments] = useState<AppointmentLike[]>([]);

  useEffect(() => {
    let active = true;
    apiGet<ReminderLike[]>("/api/v1/patient/care/medication-reminders/").then((data) => { if (active) setReminders(data); }).catch(() => undefined);
    apiGet<AppointmentLike[]>("/api/v1/patient/care/appointments/").then((data) => { if (active) setAppointments(data); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const now = new Date();
  const next = appointments.filter((item) => item.status !== "cancelled" && item.status !== "completed" && new Date(item.starts_at).getTime() >= now.getTime()).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const today = buildAgenda({ reminders, appointments }, now, 1)[0];
  const nextDate = next ? new Date(next.starts_at) : null;

  return (
    <>
      {next && nextDate && (
        <Link className="next-consultation" href="/patient/agenda">
          <span className="next-consultation__date" aria-hidden="true"><strong>{nextDate.getDate()}</strong><small>{MONTH.format(nextDate)}</small></span>
          <span className="next-consultation__body"><small>Prochaine consultation</small><strong>{next.reason || "Rendez-vous"}</strong><span className="muted">{[next.professional_name, next.establishment_name].filter(Boolean).join(" · ")}</span></span>
          <Icon name="chevron" size={18} />
        </Link>
      )}
      {today.entries.length > 0 && (
        <section className="card today-card" aria-labelledby="patient-today-title">
          <div className="section-heading"><div><span className="eyebrow">{WEEKDAY_DATE.format(now)}</span><h2 id="patient-today-title">Aujourd’hui</h2></div><Link href="/patient/agenda">Agenda</Link></div>
          <AgendaEntries entries={today.entries} />
        </section>
      )}
    </>
  );
}

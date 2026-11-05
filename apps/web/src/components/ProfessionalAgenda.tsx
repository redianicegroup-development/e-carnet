"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";
import { buildAgenda, dayLabel, startOfDay, type ConsultationLike } from "../lib/agenda";
import { AgendaEntries } from "./AgendaEntries";

type Appointment = { id: string; reason: string; starts_at: string; status: string; status_label: string; patient_name: string; establishment_name: string | null; proposed_starts_at: string | null };
const DAYS_AHEAD = 30;

export function ProfessionalAgenda() {
  const [consultations, setConsultations] = useState<ConsultationLike[] | null>(null);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([apiGet<ConsultationLike[]>("/api/v1/patient/care/professional/consultations/"), apiGet<Appointment[]>("/api/v1/patient/care/professional/appointments/")])
      .then(([consultationData, appointmentData]) => { if (active) { setConsultations(consultationData); setAppointments(appointmentData); } })
      .catch((error) => { if (active) { setConsultations([]); setAppointments([]); setMessage(error instanceof Error ? error.message : "Agenda indisponible."); } });
    return () => { active = false; };
  }, []);
  const today = startOfDay(new Date());
  const days = buildAgenda({ consultations: consultations ?? [] }, today, DAYS_AHEAD).filter((day, index) => index === 0 || day.entries.length > 0);
  async function action(appointmentId: string, kind: string, reason?: string, startsAt?: string) {
    setBusy(appointmentId); setMessage("");
    try { const updated = await apiPost<Appointment>("/api/v1/patient/care/professional/appointments/", { appointment_id: appointmentId, action: kind, ...(reason ? { reason } : {}), ...(startsAt ? { starts_at: startsAt } : {}) }); setAppointments((current) => (current ?? []).map((item) => item.id === appointmentId ? updated : item)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Action impossible."); }
    finally { setBusy(""); }
  }
  async function cancel(id: string) { const reason = window.prompt("Motif de l’annulation"); if (reason?.trim()) await action(id, "cancel", reason); }
  async function propose(id: string) { const starts = window.prompt("Nouveau créneau (format ISO, ex. 2026-11-06T14:00:00+01:00)"); const reason = window.prompt("Motif du changement"); if (starts?.trim() && reason?.trim()) await action(id, "propose", reason, starts); }
  return <div className="stack-lg">
    <header className="page-header"><span className="eyebrow">Mon agenda</span><h1>Rendez-vous et consultations</h1><p className="lead">Les rendez-vous à venir sont confirmés ou modifiés par le serveur. Le patient reçoit une notification à chaque changement.</p></header>
    {message && <p className="notice" role="alert">{message}</p>}
    {appointments && <section className="card" aria-labelledby="appointments-prof-title"><div className="section-heading"><h2 id="appointments-prof-title">Rendez-vous à venir</h2></div><div className="stack">{appointments.filter((item) => item.status !== "completed" && item.status !== "cancelled").map((item) => <article className="record" key={item.id}><div><strong>{item.patient_name || "Patient sans nom renseigné"}</strong><p><strong>{new Date(item.starts_at).toLocaleString("fr-FR")}</strong></p><p className="muted">{item.reason} · {item.status_label}</p>{item.proposed_starts_at && <p className="notice">En attente de confirmation du patient : {new Date(item.proposed_starts_at).toLocaleString("fr-FR")}</p>}</div><div className="cluster">{item.proposed_starts_at && ["requested", "confirmed"].includes(item.status) && <button className="button small" disabled={busy === item.id} onClick={() => action(item.id, "withdraw-proposal")}>Retirer la proposition</button>}{!item.proposed_starts_at && <>{item.status === "requested" && <button className="button small" disabled={busy === item.id} onClick={() => action(item.id, "confirm")}>Confirmer</button>}{["requested", "confirmed"].includes(item.status) && <button className="button small" disabled={busy === item.id} onClick={() => propose(item.id)}>Proposer un autre créneau</button>}</>}{["requested", "confirmed"].includes(item.status) && <button className="button small" disabled={busy === item.id} onClick={() => cancel(item.id)}>Annuler</button>}{item.status === "confirmed" && !item.proposed_starts_at && <button className="button small" disabled={busy === item.id} onClick={() => action(item.id, "complete")}>Terminer</button>}</div></article>)}</div></section>}
    <section className="card" aria-label="Consultations validées par jour"><div className="section-heading"><h2>Consultations validées</h2></div>{consultations === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement de l’agenda…</span><i /></div> : days.map((day) => <div className="agenda-day" key={day.key}><h3 className="agenda-day__title">{dayLabel(day.date, today)}</h3>{day.entries.length > 0 ? <AgendaEntries entries={day.entries} /> : <p className="muted">Aucune consultation validée.</p>}</div>)}</section>
    <p className="muted">Le détail clinique reste dans <Link href="/professionnel/consultations">Consultations</Link>. Un rendez-vous ne donne aucun accès au dossier patient.</p>
  </div>;
}

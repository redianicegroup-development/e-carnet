"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import type { ConsultationRecord } from "../lib/care-records";
import { ConsultationCard } from "./consultation/ConsultationCard";
import "./consultation/consultation-card.css";

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });
type Appointment = { id: string; reason: string; starts_at: string; status: string; status_label: string; establishment_name: string | null; professional_name: string | null };
type Encounter = { id: string; facility_label: string; reason: string; status: "draft" | "closed"; closed_at: string | null };
type Filter = "all" | "upcoming" | "past" | "pre";
const FILTERS: Array<{ id: Filter; label: string }> = [{ id: "all", label: "Toutes" }, { id: "upcoming", label: "À venir" }, { id: "past", label: "Passées" }, { id: "pre", label: "Pré-consult." }];
const EMPTY_TEXT: Record<Filter, string> = {
  all: "Aucune consultation pour le moment.",
  upcoming: "Aucun rendez-vous à venir.",
  past: "Aucune consultation validée pour le moment.",
  pre: "Aucune pré-consultation clôturée pour le moment. Le médecin la clôture lorsqu’il signe votre consultation.",
};

/* Historique des consultations (maquette « Consultations ») : cartes à bandeau avec filtres Toutes, À venir, Passées et Pré-consult.
   À venir = rendez-vous ; Passées = consultations validées par un professionnel, avec leur sceau ; Pré-consult. = pré-consultations clôturées par un médecin.
   Une consultation = une page « Visites » du carnet papier : date, constantes, motif, examen, diagnostic, ordonnance, signature et cachet. */
export function PatientConsultations() {
  const [consultations, setConsultations] = useState<ConsultationRecord[] | null>(null);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [encounters, setEncounters] = useState<Encounter[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    apiGet<ConsultationRecord[]>("/api/v1/patient/care/consultations/").then((data) => { if (active) setConsultations(data); }).catch((error) => { if (active) { setConsultations([]); setMessage(error instanceof Error ? error.message : "Historique indisponible."); } });
    apiGet<Appointment[]>("/api/v1/patient/care/appointments/").then((data) => { if (active) setAppointments(data); }).catch(() => { if (active) setAppointments([]); });
    apiGet<Encounter[]>("/api/v1/patient/care/encounters/").then((data) => { if (active) setEncounters(data); }).catch(() => { if (active) setEncounters([]); });
    return () => { active = false; };
  }, []);

  const loading = consultations === null || appointments === null || encounters === null;
  const now = Date.now();
  const upcoming = (appointments ?? []).filter((item) => item.status !== "cancelled" && item.status !== "completed" && new Date(item.starts_at).getTime() >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = consultations ?? [];
  const closed = (encounters ?? []).filter((item) => item.status === "closed");
  const counts: Record<Filter, number> = { all: upcoming.length + past.length + closed.length, upcoming: upcoming.length, past: past.length, pre: closed.length };

  return (
    <section className="stack" aria-label="Mes consultations">
      <div className="section-heading"><div><span className="eyebrow">À venir, passées et pré-consultations</span><h2>Mes consultations</h2></div><span className="count-badge">{loading ? "…" : counts.all}</span></div>
      <div className="chips" role="group" aria-label="Filtrer mes consultations">
        {FILTERS.map((entry) => <button key={entry.id} type="button" className={`chip${filter === entry.id ? " is-active" : ""}`} aria-pressed={filter === entry.id} onClick={() => setFilter(entry.id)}>{entry.label}<span className="chip__count">{loading ? "" : counts[entry.id]}</span></button>)}
      </div>
      {message && <p className="notice" role="alert">{message}</p>}
      {loading ? <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /></div> : counts[filter] === 0 ? <p className="empty">{EMPTY_TEXT[filter]}</p> : <>
        {(filter === "all" || filter === "upcoming") && upcoming.map((item) => (
          <article className="card visit-card" key={`rdv-${item.id}`}>
            <div className="section-heading">
              <div><span className="eyebrow"><time dateTime={item.starts_at}>{DATE_TIME_FORMAT.format(new Date(item.starts_at))}</time></span><h3>{item.reason || "Rendez-vous"}</h3><p className="muted">{[item.professional_name, item.establishment_name].filter(Boolean).join(" · ") || "Lieu à préciser"}</p></div>
              <span className="badge declared">À venir</span>
            </div>
            <dl className="kv"><div><dt>Type</dt><dd>Rendez-vous</dd></div><div><dt>Statut</dt><dd>{item.status_label}</dd></div></dl>
          </article>
        ))}
        {(filter === "all" || filter === "past") && past.map((item, index) => (
          <ConsultationCard key={item.id} item={item} index={index} pdfHref={`/api/v1/patient/care/consultations/${item.id}/prescription/`} />
        ))}
        {(filter === "all" || filter === "pre") && closed.map((item) => (
          <article className="card visit-card" key={`pre-${item.id}`}>
            <div className="section-heading">
              <div><span className="eyebrow">{item.closed_at ? `Clôturée le ${new Date(item.closed_at).toLocaleDateString("fr-FR")}` : "Pré-consultation"}</span><h3>{item.reason}</h3><p className="muted">{item.facility_label || "Établissement du médecin"}</p></div>
              <span className="badge measured">Clôturée</span>
            </div>
            <dl className="kv"><div><dt>Type</dt><dd>Pré-consultation</dd></div></dl>
          </article>
        ))}
      </>}
    </section>
  );
}

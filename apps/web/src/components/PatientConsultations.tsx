"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import { describePrescriptionLine, EXAM_KIND_LABELS, EXAM_STATUS_LABELS, type ConsultationRecord } from "../lib/care-records";
import { describeVitals, VITAL_SOURCE_LABELS, type VitalLine, type VitalSource } from "../lib/vitals";
import { ConsultationSealPanel } from "./ConsultationSealPanel";

const SOURCE_ORDER: VitalSource[] = ["preconsultation", "professional"];
const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Constantes groupées par provenance : ce qui a été relevé avant la consultation, puis ce que le médecin a mesuré. */
function groupBySource(lines: VitalLine[]): Array<{ source: VitalSource | "unknown"; lines: VitalLine[] }> {
  const groups = SOURCE_ORDER.map((source) => ({ source, lines: lines.filter((line) => line.source === source) }));
  const unknown = lines.filter((line) => !line.source);
  return [...groups, { source: "unknown" as const, lines: unknown }].filter((group) => group.lines.length > 0);
}

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
   Une consultation = une page « Visites » du carnet papier : date, constantes, motif, examen, diagnostic, ordonnance, signature. */
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
        {(filter === "all" || filter === "past") && past.map((item) => {
          const vitalGroups = groupBySource(describeVitals(item.vitals));
          return (
            <article className="card visit-card" key={item.id}>
              <div className="section-heading">
                <div><span className="eyebrow"><time dateTime={item.validated_at}>{DATE_FORMAT.format(new Date(item.validated_at))}</time></span><h3>{item.reason}</h3><p className="muted">{item.professional_name} · {item.facility_label}</p></div>
                <span className="badge verified">{item.provenance.label}</span>
              </div>
              <dl className="kv"><div><dt>Type</dt><dd>Consultation</dd></div><div><dt>Médecin</dt><dd>{item.professional_name}</dd></div></dl>
              <ConsultationSealPanel item={item} />
              <details className="visit-details">
                <summary>Voir le compte rendu</summary>
                {vitalGroups.length > 0 && <div className="visit-section"><h4>Constantes</h4>{vitalGroups.map((group) => <div className="visit-vitals" key={group.source}>{group.source !== "unknown" && <span className="visit-vitals__source">{VITAL_SOURCE_LABELS[group.source]}</span>}<dl>{group.lines.map((line) => <div key={line.key}><dt>{line.label}</dt><dd>{line.text}</dd></div>)}</dl></div>)}</div>}
              {item.symptoms && <p><strong>Symptômes :</strong> {item.symptoms}</p>}
              {item.clinical_exam && <p><strong>Examen clinique :</strong> {item.clinical_exam}</p>}
              {item.diagnosis && <p><strong>Diagnostic :</strong> {item.diagnosis}</p>}
              {item.observations && <p><strong>Observations :</strong> {item.observations}</p>}
              {item.conclusion && <p><strong>Conclusion :</strong> {item.conclusion}</p>}
              {item.care_plan && <p><strong>Conduite à tenir :</strong> {item.care_plan}</p>}
              {item.prescription_lines.length > 0 && <div className="visit-section"><div className="section-heading"><h4>Ordonnance</h4><a className="button small" href={`/api/v1/patient/care/consultations/${item.id}/prescription/`} target="_blank" rel="noreferrer">Imprimer / PDF</a></div><ol className="visit-order">{item.prescription_lines.map((line) => <li key={line.id}>{describePrescriptionLine(line)}{line.instructions && <small className="muted"> · {line.instructions}</small>}</li>)}</ol></div>}
              {item.exam_requests.length > 0 && <div className="visit-section"><h4>Examens demandés</h4><ul className="visit-order">{item.exam_requests.map((exam) => <li key={exam.id}>{exam.label} <small className="muted">· {EXAM_KIND_LABELS[exam.kind]}</small> <span className={exam.status === "result_received" ? "badge verified" : "badge pending"}>{EXAM_STATUS_LABELS[exam.status]}</span></li>)}</ul></div>}
              </details>
            </article>
          );
        })}
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

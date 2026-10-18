"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import { describePrescriptionLine, EXAM_KIND_LABELS, EXAM_STATUS_LABELS, type ConsultationRecord } from "../lib/care-records";
import { describeVitals, VITAL_SOURCE_LABELS, type VitalLine, type VitalSource } from "../lib/vitals";

const SOURCE_ORDER: VitalSource[] = ["preconsultation", "professional"];
const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Constantes groupées par provenance : ce qui a été relevé avant la consultation, puis ce que le médecin a mesuré. */
function groupBySource(lines: VitalLine[]): Array<{ source: VitalSource | "unknown"; lines: VitalLine[] }> {
  const groups = SOURCE_ORDER.map((source) => ({ source, lines: lines.filter((line) => line.source === source) }));
  const unknown = lines.filter((line) => !line.source);
  return [...groups, { source: "unknown" as const, lines: unknown }].filter((group) => group.lines.length > 0);
}

/* Une consultation = une page « Visites » du carnet papier : date, constantes, motif, examen, diagnostic, ordonnance, signature. */
export function PatientConsultations() {
  const [items, setItems] = useState<ConsultationRecord[] | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    apiGet<ConsultationRecord[]>("/api/v1/patient/care/consultations/").then((data) => { if (active) setItems(data); }).catch((error) => { if (active) { setItems([]); setMessage(error instanceof Error ? error.message : "Historique indisponible."); } });
    return () => { active = false; };
  }, []);

  return (
    <section className="stack" aria-label="Consultations validées">
      <div className="section-heading"><div><span className="eyebrow">Validées par un professionnel</span><h2>Mes consultations</h2></div><span className="count-badge">{items?.length ?? "…"}</span></div>
      {message && <p className="notice" role="alert">{message}</p>}
      {items === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /></div> : items.length === 0 ? <p className="empty">Aucune consultation validée pour le moment.</p> : items.map((item) => {
        const vitalGroups = groupBySource(describeVitals(item.vitals));
        return (
          <article className="card visit-card" key={item.id}>
            <div className="section-heading">
              <div><span className="eyebrow"><time dateTime={item.validated_at}>{DATE_FORMAT.format(new Date(item.validated_at))}</time></span><h3>{item.reason}</h3><p className="muted">{item.professional_name} · {item.facility_label}</p></div>
              <span className="badge verified">{item.provenance.label}</span>
            </div>
            {vitalGroups.length > 0 && <div className="visit-section"><h4>Constantes</h4>{vitalGroups.map((group) => <div className="visit-vitals" key={group.source}>{group.source !== "unknown" && <span className="visit-vitals__source">{VITAL_SOURCE_LABELS[group.source]}</span>}<dl>{group.lines.map((line) => <div key={line.key}><dt>{line.label}</dt><dd>{line.text}</dd></div>)}</dl></div>)}</div>}
            {item.symptoms && <p><strong>Symptômes :</strong> {item.symptoms}</p>}
            {item.clinical_exam && <p><strong>Examen clinique :</strong> {item.clinical_exam}</p>}
            {item.diagnosis && <p><strong>Diagnostic :</strong> {item.diagnosis}</p>}
            {item.observations && <p><strong>Observations :</strong> {item.observations}</p>}
            {item.conclusion && <p><strong>Conclusion :</strong> {item.conclusion}</p>}
            {item.care_plan && <p><strong>Conduite à tenir :</strong> {item.care_plan}</p>}
            {item.prescription_lines.length > 0 && <div className="visit-section"><div className="section-heading"><h4>Ordonnance</h4><a className="button small" href={`/api/v1/patient/care/consultations/${item.id}/prescription/`} target="_blank" rel="noreferrer">Imprimer / PDF</a></div><ol className="visit-order">{item.prescription_lines.map((line) => <li key={line.id}>{describePrescriptionLine(line)}{line.instructions && <small className="muted"> · {line.instructions}</small>}</li>)}</ol></div>}
            {item.exam_requests.length > 0 && <div className="visit-section"><h4>Examens demandés</h4><ul className="visit-order">{item.exam_requests.map((exam) => <li key={exam.id}>{exam.label} <small className="muted">· {EXAM_KIND_LABELS[exam.kind]}</small> <span className={exam.status === "result_received" ? "badge verified" : "badge pending"}>{EXAM_STATUS_LABELS[exam.status]}</span></li>)}</ul></div>}
          </article>
        );
      })}
    </section>
  );
}

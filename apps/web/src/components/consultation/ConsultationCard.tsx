"use client";

import { useId, useState } from "react";
import { describePrescriptionLine, EXAM_KIND_LABELS, EXAM_STATUS_LABELS, type ConsultationRecord } from "../../lib/care-records";
import { parseObservations } from "../../lib/preconsult";
import { describeVitals, VITAL_SOURCE_LABELS, type VitalLine, type VitalSource } from "../../lib/vitals";
import { ConsultationSealPanel, SealImages } from "../ConsultationSealPanel";
import { Icon } from "../ui/Icon";
import { PersonAvatar } from "../ui/PersonAvatar";
import "./consultation-card.css";

export type ConsultationCardItem = ConsultationRecord & { patient_name?: string; patient_avatar?: string };

const SOURCE_ORDER: VitalSource[] = ["preconsultation", "professional"];
const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric" });
const MONTH_YEAR = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" });
const FULL_DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

/** Constantes groupées par provenance : ce qui a été relevé avant la consultation, puis ce que le médecin a mesuré. */
function groupBySource(lines: VitalLine[]): Array<{ source: VitalSource | "unknown"; lines: VitalLine[] }> {
  const groups = SOURCE_ORDER.map((source) => ({ source, lines: lines.filter((line) => line.source === source) }));
  return [...groups, { source: "unknown" as const, lines: lines.filter((line) => !line.source) }].filter((group) => group.lines.length > 0);
}

const FIELDS: Array<{ key: "clinical_exam" | "diagnosis" | "observations" | "conclusion" | "care_plan"; label: string }> = [
  { key: "clinical_exam", label: "Examen clinique" },
  { key: "diagnosis", label: "Diagnostic" },
  { key: "observations", label: "Observations" },
  { key: "conclusion", label: "Conclusion" },
  { key: "care_plan", label: "Conduite à tenir" },
];

type Props = {
  item: ConsultationCardItem;
  /** Alterne les bandeaux miel / menthe d'une carte à l'autre. */
  index?: number;
  /** Espace professionnel : la personne reçue (nom et photo) figure en tête de carte. */
  showPatient?: boolean;
  /** Lien « Imprimer / PDF » de l'ordonnance (réservé au patient, propriétaire du PDF). */
  pdfHref?: string | null;
  /** Les images de signature et de cachet ne sont servies qu'au patient et au professionnel signataire. */
  sealImages?: boolean;
};

/* Une consultation validée = une page « Visites » du carnet papier. Même carte dans les trois espaces (patient, professionnel, établissement) :
   bandeau (date, motif, qui, validation), puis « Voir le compte rendu » et « Ouvrir le sceau » à la demande. Tout texte long passe à la ligne :
   rien ne déborde à droite, quelle que soit la largeur de l'écran. */
export function ConsultationCard({ item, index = 0, showPatient = false, pdfHref = null, sealImages = true }: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const [sealOpen, setSealOpen] = useState(false);
  const reportId = useId();
  const sealId = useId();
  const date = new Date(item.validated_at);
  const vitalGroups = groupBySource(describeVitals(item.vitals));
  const symptoms = parseObservations(item.symptoms);
  const hasSymptoms = symptoms.selected.length > 0 || Boolean(symptoms.other);
  const patientName = item.patient_name || "Patient";
  const hasSeal = Boolean(item.has_signature || item.has_stamp);

  return (
    <article className="card consult-card" aria-label={`Consultation du ${FULL_DATE.format(date)} : ${item.reason}`}>
      <header className={`consult-card__band${index % 2 === 1 ? " consult-card__band--alt" : ""}`}>
        <time className="consult-card__date" dateTime={item.validated_at}>
          <span className="consult-card__day">{DAY.format(date)}</span>
          <span className="consult-card__month">{MONTH_YEAR.format(date)}</span>
        </time>
        <div className="consult-card__heading">
          {showPatient && <p className="consult-card__who"><PersonAvatar src={item.patient_avatar} name={patientName} size={32} /><strong>{patientName}</strong></p>}
          <h3>{item.reason}</h3>
          <p className="consult-card__where">{item.professional_name} · {item.facility_label}</p>
          <span className="consult-card__badge"><Icon name="check" size={15} /> {item.provenance.label}</span>
        </div>
      </header>

      <dl className="consult-card__facts">
        <div><dt>Type</dt><dd>Consultation</dd></div>
        <div><dt>Médecin</dt><dd>{item.professional_name}</dd></div>
      </dl>

      <div className="consult-card__actions">
        <button type="button" className="button small" aria-expanded={reportOpen} aria-controls={reportId} onClick={() => setReportOpen((value) => !value)}>
          <Icon name="document" size={16} /> {reportOpen ? "Masquer le compte rendu" : "Voir le compte rendu"}
        </button>
        <button type="button" className="button small" aria-expanded={sealOpen} aria-controls={sealId} onClick={() => setSealOpen((value) => !value)}>
          <Icon name="qr" size={16} /> {sealOpen ? "Fermer le sceau" : "Ouvrir le sceau"}
        </button>
      </div>

      {sealOpen && <ConsultationSealPanel id={sealId} item={item} images={sealImages} />}

      {reportOpen && (
        <div className="consult-report" id={reportId}>
          {vitalGroups.length > 0 && (
            <section className="consult-section" aria-label="Constantes">
              <h4>Constantes</h4>
              {vitalGroups.map((group) => (
                <div className="consult-vitals" key={group.source}>
                  {group.source !== "unknown" && <p className="consult-vitals__source">{VITAL_SOURCE_LABELS[group.source]}</p>}
                  <dl className="consult-vitals__grid">{group.lines.map((line) => <div key={line.key}><dt>{line.label}</dt><dd>{line.text}</dd></div>)}</dl>
                </div>
              ))}
            </section>
          )}

          {hasSymptoms && (
            <section className="consult-section" aria-label="Symptômes">
              <h4>Symptômes</h4>
              {symptoms.selected.length > 0 && <ul className="consult-chips">{symptoms.selected.map((symptom) => <li key={symptom}>{symptom}</li>)}</ul>}
              {symptoms.other && <p className="consult-text">{symptoms.selected.length > 0 && <span className="consult-text__label">Autres : </span>}{symptoms.other}</p>}
            </section>
          )}

          {FIELDS.map(({ key, label }) => item[key] ? <section className="consult-section" key={key} aria-label={label}><h4>{label}</h4><p className="consult-text">{item[key]}</p></section> : null)}

          {item.prescription_lines.length > 0 && (
            <section className="consult-section" aria-label="Ordonnance">
              <div className="consult-section__head"><h4>Ordonnance</h4>{pdfHref && <a className="button small" href={pdfHref} target="_blank" rel="noreferrer">Imprimer / PDF</a>}</div>
              <ol className="consult-rx">
                {item.prescription_lines.map((line) => (
                  <li key={line.id} aria-label={describePrescriptionLine(line)}>
                    <strong>{line.dosage ? `${line.drug_name} · ${line.dosage}` : line.drug_name}</strong>
                    <span>{[line.posology, line.duration].filter(Boolean).join(" — ")}</span>
                    {line.instructions && <em>{line.instructions}</em>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {item.exam_requests.length > 0 && (
            <section className="consult-section" aria-label="Examens demandés">
              <h4>Examens demandés</h4>
              <ul className="consult-exams">
                {item.exam_requests.map((exam) => (
                  <li key={exam.id}>
                    <span className="consult-exams__label">{exam.label}<small>{EXAM_KIND_LABELS[exam.kind]}</small></span>
                    <span className={exam.status === "result_received" ? "badge verified" : "badge pending"}>{EXAM_STATUS_LABELS[exam.status]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer className="consult-signed">
            <p>Validée et signée électroniquement dans Mon E‑Carnet par <strong>{item.professional_name}</strong>, le <time dateTime={item.validated_at}>{FULL_DATE.format(date)}</time>.</p>
            {hasSeal && sealImages && <SealImages item={item} />}
            {hasSeal && !sealImages && <p className="consult-signed__flags">{[item.has_signature && "Signature apposée", item.has_stamp && "Cachet apposé"].filter(Boolean).join(" · ")}</p>}
          </footer>
        </div>
      )}
    </article>
  );
}

"use client";

import { useId, useState } from "react";
import { carnetDate, carnetDayTime, describePrescriptionLine, EXAM_KIND_LABELS, EXAM_STATUS_LABELS, type ConsultationRecord } from "../../lib/care-records";
import { parseObservations } from "../../lib/preconsult";
import { describeVitals, VITAL_SOURCE_LABELS, type VitalLine, type VitalSource } from "../../lib/vitals";
import { ConsultationSealPanel } from "../ConsultationSealPanel";
import { PrescriptionViewer } from "../prescription/PrescriptionViewer";
import { Icon } from "../ui/Icon";
import { PersonAvatar } from "../ui/PersonAvatar";
import { ConsultationValidation } from "./ConsultationValidation";
import "./consultation-card.css";

export type ConsultationCardItem = ConsultationRecord & { patient_name?: string; patient_avatar?: string };

const FULL_DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

/** Libellés courts de la ligne des constantes, comme on les abrège sur un carnet papier (pds, TA, T°). Le libellé complet reste en info-bulle. */
const SHORT_VITAL_LABELS: Record<string, string> = {
  weight_kg: "Poids", height_cm: "Taille", temperature_c: "Temp.", blood_pressure: "Tension", heart_rate: "Pouls", spo2: "SpO₂", glycemia: "Glycémie",
};

const FIELDS: Array<{ key: "clinical_exam" | "diagnosis" | "observations" | "conclusion" | "care_plan"; label: string }> = [
  { key: "clinical_exam", label: "Examen clinique" },
  { key: "diagnosis", label: "Diagnostic" },
  { key: "observations", label: "Observations" },
  { key: "conclusion", label: "Conclusion" },
  { key: "care_plan", label: "Conduite à tenir" },
];

/** Provenances présentes, dans l'ordre : ce qui a été relevé avant la consultation, puis ce que le médecin a mesuré. */
function sourcesIn(lines: VitalLine[]): VitalSource[] {
  return (["preconsultation", "professional"] as const).filter((source) => lines.some((line) => line.source === source));
}

function VitalsLine({ lines }: { lines: VitalLine[] }) {
  if (lines.length === 0) return null;
  return (
    <dl className="consult-vline" aria-label="Constantes">
      {lines.map((line) => (
        <div key={line.key} title={line.source ? `${line.label} · ${VITAL_SOURCE_LABELS[line.source]}` : line.label}>
          <dt>{SHORT_VITAL_LABELS[line.key] ?? line.label}</dt>
          <dd>{line.text}</dd>
          {line.source && <i className={`consult-vline__src${line.source === "professional" ? " consult-vline__src--pro" : ""}`} aria-hidden="true" />}
        </div>
      ))}
    </dl>
  );
}

type Props = {
  item: ConsultationCardItem;
  /** Alterne la teinte de la marge de dates (miel / menthe) d'une page à l'autre. */
  index?: number;
  /** Espace professionnel : la personne reçue (nom et photo) figure en tête de page. */
  showPatient?: boolean;
  /** Lien « Imprimer / PDF » de l'ordonnance (réservé au patient, propriétaire du PDF). */
  pdfHref?: string | null;
  /** Lien de l'ordonnance mise en page (« Voir l'ordonnance » : lecture et impression sans quitter le carnet). Réservé au patient. */
  sheetHref?: string | null;
  /** Les images de signature et de cachet ne sont servies qu'au patient et au professionnel signataire. */
  sealImages?: boolean;
  /** Page ouverte dès l'affichage (aperçus, tests). */
  defaultOpen?: boolean;
};

/* Une consultation validée = une page « Visites » du carnet papier. Même page dans les trois espaces (patient, professionnel, établissement) :
   — l'en-tête « Dates | Visites » et la marge de dates à gauche, comme sur le carnet ;
   — la ligne des constantes d'abord (poids, tension, température…), puis le motif et, repliée, le diagnostic ;
   — « Voir le compte rendu » déplie le texte clinique en lignes pointillées, l'ordonnance (Rp/), les examens et, tout en bas,
     la ligne de signature : cachet de l'établissement, cachet et signature du médecin (ConsultationValidation) ;
   — « Ouvrir le sceau » rappelle qui a validé, où et quand.
   Tout texte long passe à la ligne : rien ne déborde à droite, même sur un écran de 320 px. */
export function ConsultationCard({ item, index = 0, showPatient = false, pdfHref = null, sheetHref = null, sealImages = true, defaultOpen = false }: Props) {
  const [reportOpen, setReportOpen] = useState(defaultOpen);
  const [sealOpen, setSealOpen] = useState(false);
  const reportId = useId();
  const sealId = useId();
  const date = new Date(item.validated_at);
  const vitals = describeVitals(item.vitals);
  const sources = sourcesIn(vitals);
  const symptoms = parseObservations(item.symptoms);
  const hasSymptoms = symptoms.selected.length > 0 || Boolean(symptoms.other);
  const patientName = item.patient_name || "Patient";
  const drugs = item.prescription_lines.length;
  const exams = item.exam_requests.length;
  const summary = [drugs > 0 && `${drugs} ${drugs > 1 ? "médicaments" : "médicament"}`, exams > 0 && `${exams} ${exams > 1 ? "examens" : "examen"}`].filter(Boolean).join(" · ");

  return (
    <article className={`card consult-card${index % 2 === 1 ? " consult-card--alt" : ""}`} aria-label={`Consultation du ${FULL_DATE.format(date)} : ${item.reason}`}>
      <div className="consult-card__head" aria-hidden="true"><span>Dates</span><span>Visites</span></div>
      <div className="consult-card__sheet">
        <time className="consult-card__date" dateTime={item.validated_at} aria-label={FULL_DATE.format(date)}>
          <strong>{carnetDate(date)}</strong>
          <span>{carnetDayTime(date)}</span>
          <Icon name="check" size={16} />
        </time>

        <div className="consult-card__main">
          <VitalsLine lines={vitals} />

          <header className="consult-card__title">
            {showPatient && <p className="consult-card__who"><PersonAvatar src={item.patient_avatar} name={patientName} size={32} /><strong>{patientName}</strong></p>}
            <h3>{item.reason}</h3>
            <p className="consult-card__where">{item.professional_name} · {item.facility_label}</p>
            <span className="consult-card__badge"><Icon name="check" size={15} /> {item.provenance.label}</span>
          </header>

          {!reportOpen && item.diagnosis && (
            <section className="consult-row consult-row--dx" aria-label="Diagnostic"><h4>Diagnostic</h4><p className="consult-text">{item.diagnosis}</p></section>
          )}
          {!reportOpen && summary && <p className="consult-card__meta">{summary}</p>}

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
              {sources.length > 0 && (
                <p className="consult-vlegend" aria-label="Origine des constantes">
                  {sources.map((source) => <span key={source}><i className={`consult-vline__src${source === "professional" ? " consult-vline__src--pro" : ""}`} aria-hidden="true" />{VITAL_SOURCE_LABELS[source]}</span>)}
                </p>
              )}

              {hasSymptoms && (
                <section className="consult-row" aria-label="Symptômes">
                  <h4>Symptômes</h4>
                  <div className="consult-text">
                    {symptoms.selected.length > 0 && <p>{symptoms.selected.join(", ")}</p>}
                    {symptoms.other && <p>{symptoms.selected.length > 0 && <span className="consult-text__label">Autres : </span>}{symptoms.other}</p>}
                  </div>
                </section>
              )}

              {FIELDS.map(({ key, label }) => item[key] ? (
                <section className={`consult-row${key === "diagnosis" ? " consult-row--dx" : ""}`} key={key} aria-label={label}><h4>{label}</h4><p className="consult-text">{item[key]}</p></section>
              ) : null)}

              {drugs > 0 && (
                <section className="consult-rx-block" aria-label="Ordonnance">
                  <div className="consult-rx-block__head">
                    <span className="consult-rx-block__mark" aria-hidden="true">Rp/</span>
                    <h4>Ordonnance</h4>
                    {(sheetHref || pdfHref) && (
                      <div className="consult-rx-block__actions">
                        {sheetHref && <PrescriptionViewer sheetHref={sheetHref} pdfHref={pdfHref} />}
                        {pdfHref && <a className="button small" href={pdfHref} target="_blank" rel="noreferrer">Imprimer / PDF</a>}
                      </div>
                    )}
                  </div>
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

              {exams > 0 && (
                <section className="consult-row consult-row--block" aria-label="Examens demandés">
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

              <ConsultationValidation item={item} images={sealImages} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import { PageHeader } from "./ui/PageHeader";

type Establishment = { id: string; name: string; status: string };
type Encounter = {
  id: string;
  reason: string;
  observations: string;
  status: string;
  created_at: string;
};
type PrescriptionLine = { drug_name: string; dosage: string; posology: string; duration: string; instructions: string };
type Consultation = {
  id: string;
  professional_name: string;
  reason: string;
  symptoms: string;
  clinical_exam: string;
  diagnosis: string;
  observations: string;
  conclusion: string;
  care_plan: string;
  validated_at: string;
  prescription_lines: PrescriptionLine[];
};
type PatientRecord = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  encounters: Encounter[];
  consultations: Consultation[];
};
type Data = { establishment: Establishment | null; patients: PatientRecord[] };

async function fetchRecords(): Promise<Data> {
  const establishments = await apiGet<Establishment[]>("/api/v1/establishments/");
  const establishment = establishments[0] ?? null;
  if (!establishment || establishment.status !== "active") return { establishment, patients: [] };
  const patients = await apiGet<PatientRecord[]>(`/api/v1/establishments/${establishment.id}/patient-records/`);
  return { establishment, patients };
}

function formatDate(value: string | null) {
  if (!value) return "Date non renseignée";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

function ClinicalField({ label, value }: { label: string; value: string }) {
  return value ? <p><strong>{label} :</strong> {value}</p> : null;
}

export function EstablishmentPatientRecords() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchRecords()
      .then((value) => { if (active) { setData(value); setError(""); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Les dossiers sont indisponibles."); });
    return () => { active = false; };
  }, []);

  if (error) return <p className="notice" role="alert">{error}</p>;
  if (!data) return <div className="skeleton" role="status"><span className="sr-only">Chargement des dossiers…</span><i /><i /></div>;
  if (!data.establishment) return <p className="notice" role="alert">Aucun établissement n’est rattaché à ce compte.</p>;

  const active = data.establishment.status === "active";
  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={data.establishment.name}
        title="Dossiers patients"
        lead="Les dossiers affichés contiennent au moins une pré-consultation clôturée ou une consultation enregistrée dans votre établissement."
      />
      {!active ? (
        <section className="card alert-card"><h2>Accès temporairement indisponible</h2><p>Les dossiers de l’établissement ne sont accessibles que lorsque sa structure est active.</p></section>
      ) : data.patients.length === 0 ? (
        <section className="card"><p className="empty">Aucun dossier patient n’est encore associé à cet établissement.</p></section>
      ) : (
        <section className="stack" aria-label="Dossiers de l’établissement">
          {data.patients.map((patient) => (
            <details className="card" key={patient.id}>
              <summary>
                <strong>{[patient.first_name, patient.last_name].filter(Boolean).join(" ") || "Patient sans nom"}</strong>
                <span className="muted"> · {patient.birth_date ? `Né(e) le ${formatDate(patient.birth_date)}` : "Date de naissance non renseignée"}</span>
                <span className="muted"> · {patient.encounters.length} pré-consultation{patient.encounters.length > 1 ? "s" : ""}, {patient.consultations.length} consultation{patient.consultations.length > 1 ? "s" : ""}</span>
              </summary>
              <div className="stack" style={{ marginTop: "1rem" }}>
                {patient.encounters.map((encounter) => (
                  <article className="record" key={encounter.id}>
                    <h3>Pré-consultation · {formatDate(encounter.created_at)}</h3>
                    <ClinicalField label="Motif" value={encounter.reason} />
                    <ClinicalField label="Observations" value={encounter.observations} />
                  </article>
                ))}
                {patient.consultations.map((consultation) => (
                  <article className="record" key={consultation.id}>
                    <h3>Consultation · {formatDate(consultation.validated_at)}</h3>
                    <p className="muted">{consultation.professional_name}</p>
                    <ClinicalField label="Motif" value={consultation.reason} />
                    <ClinicalField label="Symptômes" value={consultation.symptoms} />
                    <ClinicalField label="Examen clinique" value={consultation.clinical_exam} />
                    <ClinicalField label="Diagnostic" value={consultation.diagnosis} />
                    <ClinicalField label="Observations" value={consultation.observations} />
                    <ClinicalField label="Conclusion" value={consultation.conclusion} />
                    <ClinicalField label="Plan de soins" value={consultation.care_plan} />
                    {consultation.prescription_lines.length > 0 && (
                      <div><strong>Prescription</strong><ul>{consultation.prescription_lines.map((line, index) => <li key={`${consultation.id}-${index}`}>{[line.drug_name, line.dosage, line.posology, line.duration, line.instructions].filter(Boolean).join(" · ")}</li>)}</ul></div>
                    )}
                  </article>
                ))}
              </div>
            </details>
          ))}
        </section>
      )}
      <p className="notice"><strong>Périmètre d’accès.</strong> Seules les pré-consultations et consultations associées à cet établissement sont affichées. Les données d’un autre établissement ne sont pas ouvertes automatiquement.</p>
    </div>
  );
}

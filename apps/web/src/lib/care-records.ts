/* Contenu d'une consultation signée, tel que l'API le renvoie (apps/api/apps/care/serializers.py). */
import type { ConsultationVitals } from "./vitals";

export type PrescriptionLine = { id: string; drug_name: string; dosage: string; posology: string; duration: string; instructions: string };
export type ExamKind = "analysis" | "imaging" | "other";
export type ExamRequest = { id: string; kind: ExamKind; label: string; status: "requested" | "result_received" };

export const EXAM_KIND_LABELS: Record<ExamKind, string> = { analysis: "Analyse biologique", imaging: "Imagerie", other: "Autre examen" };
export const EXAM_STATUS_LABELS: Record<ExamRequest["status"], string> = { requested: "Demandé", result_received: "Résultat reçu" };

export type ConsultationRecord = {
  id: string;
  professional_name: string;
  facility_label: string;
  reason: string;
  symptoms: string;
  clinical_exam: string;
  diagnosis: string;
  observations: string;
  vitals: ConsultationVitals;
  prescription_lines: PrescriptionLine[];
  exam_requests: ExamRequest[];
  conclusion: string;
  care_plan: string;
  validated_at: string;
  provenance: { label: string };
};

/** « Doliprane · 1 g — 1 cp × 3/jour — 5 jours » : une ligne lisible, comme sur une ordonnance papier. */
export function describePrescriptionLine(line: PrescriptionLine): string {
  const drug = line.dosage ? `${line.drug_name} · ${line.dosage}` : line.drug_name;
  return [drug, line.posology, line.duration].filter(Boolean).join(" — ");
}

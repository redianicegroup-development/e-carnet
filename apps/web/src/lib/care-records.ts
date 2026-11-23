/* Contenu d'une consultation signée, tel que l'API le renvoie (apps/api/apps/care/serializers.py). */
import type { ConsultationVitals } from "./vitals";

export type PrescriptionLine = { id: string; drug_name: string; dosage: string; posology: string; duration: string; instructions: string };
export type ExamKind = "analysis" | "imaging" | "other";
export type ExamRequest = { id: string; kind: ExamKind; label: string; status: "requested" | "result_received"; proof_document_id?: string | null };

export const EXAM_KIND_LABELS: Record<ExamKind, string> = { analysis: "Analyse biologique", imaging: "Imagerie", other: "Autre examen" };
export const EXAM_STATUS_LABELS: Record<ExamRequest["status"], string> = { requested: "Demandé", result_received: "Résultat reçu" };

/** Qui a signé : titre, spécialité et numéro d'ordre déclarés au profil (les mêmes que sur l'ordonnance PDF). Absent des anciennes réponses. */
export type ConsultationSignatory = { title: string; specialty: string; order_number: string };
/** Établissement qui a validé la consultation : de quoi composer son cachet électronique (nom, type, ville, téléphone). */
export type ConsultationEstablishment = { name: string; type: string; city: string; phone: string };

export type ConsultationRecord = {
  id: string;
  /** Comment l'accès au dossier a été ouvert pour cette consultation (QR du patient ou mode invité). Absent des anciennes réponses. */
  access_mode?: "qr" | "guest" | "guest_pro";
  /** Mode invité, médecin sans téléphone : quand la consultation a été rédigée sur le téléphone du patient, avant la signature du médecin. */
  drafted_at?: string | null;
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
  /** Signature / cachet du médecin figés sur la consultation au moment de la validation (les images sont servies à part). */
  has_signature?: boolean;
  has_stamp?: boolean;
  /** Cachet et signature de l'ÉTABLISSEMENT (« Informations administratives »), figés eux aussi à la validation. */
  has_establishment_stamp?: boolean;
  has_establishment_signature?: boolean;
  signatory?: ConsultationSignatory | null;
  establishment?: ConsultationEstablishment | null;
  provenance: { label: string };
};

/** Ordonnance prête à être affichée ou imprimée (GET …/consultations/<id>/prescription-sheet/) : tout ce qui figure sur le PDF. */
export type PrescriptionSheetData = {
  consultation_id: string;
  reference: string;
  /** Date de l'ordonnance (AAAA-MM-JJ). */
  issued_on: string;
  signed_at: string | null;
  establishment: { name: string; type: string; city: string; address: string; phone: string; email: string; logo_url: string; header_text: string; footer_text: string };
  prescriber: { name: string; title: string; specialty: string; order_number: string };
  /** Modèle simple : le patient n'apparaît que par ses nom et prénom. */
  patient: { name: string };
  lines: PrescriptionLine[];
  has_signature: boolean;
  has_stamp: boolean;
  has_establishment_stamp: boolean;
  has_establishment_signature: boolean;
};

const SHORT_DATE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const WEEKDAY = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const CLOCK = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** « 21/11/26 » : la date telle qu'on l'écrit dans la marge d'un carnet papier. */
export function carnetDate(iso: string | Date): string {
  return SHORT_DATE.format(typeof iso === "string" ? new Date(iso) : iso);
}

/** « sam. 10:42 » : jour et heure, sous la date. */
export function carnetDayTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return `${WEEKDAY.format(date)} ${CLOCK.format(date)}`;
}

/** Référence courte d'une consultation (8 caractères) : la même sur le sceau, l'ordonnance et le PDF. */
export function consultationReference(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** « Doliprane · 1 g — 1 cp × 3/jour — 5 jours » : une ligne lisible, comme sur une ordonnance papier. */
export function describePrescriptionLine(line: PrescriptionLine): string {
  const drug = line.dosage ? `${line.drug_name} · ${line.dosage}` : line.drug_name;
  return [drug, line.posology, line.duration].filter(Boolean).join(" — ");
}

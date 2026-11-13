/* PRO-21 — consultation en attente de résultats et espace laboratoire. Tous les appels passent par l'API (drapeau ECARNET_LAB_ENABLED) :
   drapeau éteint, le serveur répond 404 et l'interface n'affiche rien (voir `isLabFeatureOff`). */
import { ApiError, apiDelete, apiGet, apiPost, apiUpload } from "../infrastructure/api/client";
import type { ConsultationInput } from "./professional-access-grants";

const BASE = "/api/v1/patient/care";

export type PendingStatus = "waiting_results" | "to_resume" | "completed" | "cancelled";
export type PendingExamStatus = "requested" | "result_received" | "abandoned";
export type ExamKind = "analysis" | "imaging" | "other";

export type ResultDocument = { id: string; original_name: string; created_at: string; issuer: string; replaced: boolean; download_url: string };
export type PendingExam = { id: string; kind: ExamKind; label: string; status: PendingExamStatus; status_label: string; abandon_reason: string; result_received_at: string | null; documents: ResultDocument[] };

/** Le drapeau est éteint (404) : la fonction n'existe pas, on n'affiche ni erreur ni bouton. */
export function isLabFeatureOff(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/* ---------- patient ---------- */
export type PatientPending = {
  id: string; status: PendingStatus; status_label: string; professional_name: string; facility_label: string; reason: string;
  created_at: string; qr_expires_at: string; qr_active: boolean; exams: PendingExam[];
};
export const listPatientPending = () => apiGet<PatientPending[]>(`${BASE}/pending-consultations/`);
export const getExamQr = (id: string) => apiGet<{ token: string; expires_at: string }>(`${BASE}/pending-consultations/${id}/exam-qr/`);
export const renewExamQr = (id: string) => apiPost<{ token: string; expires_at: string }>(`${BASE}/pending-consultations/${id}/exam-qr/`);
export const revokeExamQr = (id: string) => apiDelete<{ revoked: boolean }>(`${BASE}/pending-consultations/${id}/exam-qr/`);
export const cancelPending = (id: string) => apiPost<{ id: string; status: PendingStatus }>(`${BASE}/pending-consultations/${id}/cancel/`);

/* ---------- professionnel ---------- */
export type WaitInput = Omit<ConsultationInput, "attestation_svg" | "pending_consultation_id"> & { requested_exams: NonNullable<ConsultationInput["requested_exams"]> };
export const waitForResults = (input: WaitInput) => apiPost<{ id: string; status: PendingStatus }>(`${BASE}/professional/pending-consultations/`, input);

export type MyPending = { id: string; status: PendingStatus; status_label: string; patient_initials: string; reason: string; created_at: string; exams_total: number; exams_waiting: number };
export const listMyPending = () => apiGet<MyPending[]>(`${BASE}/professional/pending-consultations/`);

export type PendingDraft = Partial<Record<"reason" | "symptoms" | "clinical_exam" | "diagnosis" | "observations" | "conclusion" | "care_plan", string>> & { vitals?: unknown; prescription_lines?: Array<{ drug_name: string; dosage: string; posology: string; duration: string; instructions: string }> };
export type PendingForGrant = {
  id: string; status: PendingStatus; status_label: string; source_encounter_id: string; draft: PendingDraft; documents_allowed: boolean; created_at: string; exams: PendingExam[];
};
/** `null` : pas d'attente pour ce patient. */
export const getPendingForGrant = (grantId: string) => apiGet<PendingForGrant | null>(`${BASE}/professional/access-grants/${grantId}/pending-consultation/`);
export const abandonPendingExam = (pendingId: string, examId: string, reason: string) => apiPost<{ id: string; status: PendingStatus }>(`${BASE}/professional/pending-consultations/${pendingId}/exams/${examId}/abandon/`, { reason });

/* ---------- laboratoire ---------- */
export type LabResolved = {
  pending_consultation_id: string;
  patient: { first_name: string; last_name: string; birth_date: string | null };
  exams: Array<{ id: string; kind: ExamKind; label: string; status: PendingExamStatus }>;
  expires_at: string;
};
export const resolveExamQr = (token: string) => apiPost<LabResolved>(`${BASE}/laboratory/exam-qr/resolve/`, { token });
export function depositResult(input: { token: string; examId: string; file: File; identityConfirmed: boolean; documentDate?: string }) {
  const form = new FormData();
  form.append("token", input.token);
  form.append("exam_id", input.examId);
  form.append("identity_confirmed", input.identityConfirmed ? "true" : "false");
  if (input.documentDate) form.append("document_date", input.documentDate);
  form.append("file", input.file, input.file.name || "resultat.pdf");
  return apiUpload<{ id: string; original_name: string; created_at: string }>(`${BASE}/laboratory/results/`, form);
}
export type LabDepositStatus = "deposited" | "replaced" | "abandoned";
export type LabHistoryItem = {
  id: string; status: LabDepositStatus; exam_label: string; exam_kind: ExamKind | ""; original_name: string;
  patient_initials: string; birth_year: number | null; occurred_at: string;
};
/** `counts` ignore le filtre de statut (effectifs des puces) ; `truncated` : seules les lignes les plus récentes sont renvoyées. */
export type LabHistory = { items: LabHistoryItem[]; counts: Record<LabDepositStatus | "all", number>; truncated: boolean };
export function listLabHistory(options: { status?: LabDepositStatus; from?: string; to?: string } = {}) {
  const query = new URLSearchParams();
  if (options.status) query.set("status", options.status);
  if (options.from) query.set("from", options.from);
  if (options.to) query.set("to", options.to);
  const suffix = query.toString();
  return apiGet<LabHistory>(`${BASE}/laboratory/deposits/${suffix ? `?${suffix}` : ""}`);
}

/* ---------- établissement : ses laboratoires ---------- */
export type LabAccess = { email: string; state: "temporary_password" | "expired" | "activated" | "revoked"; expires_at: string | null } | null;
export type EstablishmentLab = { id: string; name: string; status: string; administrator: { name: string; email: string } | null; access: LabAccess; created_at: string };
export const listLaboratories = (establishmentId: string) => apiGet<EstablishmentLab[]>(`/api/v1/establishments/${establishmentId}/laboratories/`);
export type CreatedLab = { email: string; temporary_password?: string; [key: string]: unknown };
export const createLaboratory = (establishmentId: string, input: { name: string; admin_email: string; admin_first_name?: string; admin_last_name?: string }) =>
  apiPost<CreatedLab>(`/api/v1/establishments/${establishmentId}/laboratories/`, input);

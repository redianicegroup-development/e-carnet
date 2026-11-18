import { apiGet, apiPost, apiUpload } from "../infrastructure/api/client";

export const ATTESTATIONS = "/api/v1/attestations";
export const KIND_OPTIONS: [string, string][] = [["allergy", "Allergie"], ["antecedent", "Antécédent"], ["surgery", "Intervention chirurgicale"], ["implant", "Implant ou dispositif médical"], ["other_medical", "Autre information médicale"]];
export const ACCEPTED_FILES = ".pdf,.png,.jpg,.jpeg,.docx";
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

export type Attachment = { id: string; name: string; content_type: string; size_bytes: number };
export type Share = {
  id: string; establishment_id: string; establishment_name: string; status: "pending" | "info_requested" | "attested" | "revoked"; status_label: string;
  info_message: string; error_message: string; error_reported_at: string | null; created_at: string;
  attestation: { professional_name: string; professional_title: string; attested_at: string } | null;
};
export type PatientDeclaration = { id: string; kind: string; kind_label: string; label: string; details: string; event_date: string | null; created_at: string; attachments: Attachment[]; shares: Share[]; events: { kind: string; actor: string; detail: string; created_at: string }[] };
export type EstablishmentChoice = { id: string; name: string; city: string; recent: boolean };
export type ProDeclaration = {
  id: string; patient_name: string; kind: string; kind_label: string; label: string; details: string; event_date: string | null; shared_at: string; status: "pending" | "info_requested";
  info_message: string; patient_seen: boolean; can_attest: boolean; blocked_reason: string; attachments: Attachment[];
};
export type ProList = { to_attest: ProDeclaration[]; waiting: ProDeclaration[]; reported: { id: string; patient_name: string; label: string; error_message: string; error_reported_at: string; attested_by: string }[] };
export type ProSummary = { allowed: boolean; to_attest: number; waiting: number };
export type Reminder = { count: number; items: { id: string; label: string; kind_label: string }[] };

export const attachmentUrl = (side: "patient" | "professional", id: string) => `${ATTESTATIONS}/${side}/attachments/${id}/`;
export const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`);

export const listPatientDeclarations = () => apiGet<PatientDeclaration[]>(`${ATTESTATIONS}/patient/declarations/`);
export const listEstablishmentChoices = (query = "") => apiGet<EstablishmentChoice[]>(`${ATTESTATIONS}/patient/establishments/${query ? `?q=${encodeURIComponent(query)}` : ""}`);
export const createPatientDeclaration = (form: FormData) => apiUpload<PatientDeclaration>(`${ATTESTATIONS}/patient/declarations/`, form);
export const shareDeclaration = (id: string, establishmentIds: string[]) => apiPost<PatientDeclaration>(`${ATTESTATIONS}/patient/declarations/${id}/share/`, { establishment_ids: establishmentIds });
export const revokeShare = (id: string) => apiPost<PatientDeclaration>(`${ATTESTATIONS}/patient/shares/${id}/revoke/`, {});
export const reportShareError = (id: string, message: string) => apiPost<PatientDeclaration>(`${ATTESTATIONS}/patient/shares/${id}/report-error/`, { message });

export const proSummary = () => apiGet<ProSummary>(`${ATTESTATIONS}/professional/summary/`);
export const proList = () => apiGet<ProList>(`${ATTESTATIONS}/professional/declarations/`);
export const proReminder = (grantId: string) => apiGet<Reminder>(`${ATTESTATIONS}/professional/reminders/?grant=${encodeURIComponent(grantId)}`);
export const attestShare = (id: string) => apiPost<{ share_id: string }>(`${ATTESTATIONS}/professional/shares/${id}/attest/`, {});
export const requestShareInfo = (id: string, message: string) => apiPost<{ share_id: string }>(`${ATTESTATIONS}/professional/shares/${id}/request-info/`, { message });

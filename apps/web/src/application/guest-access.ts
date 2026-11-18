import { apiGet, apiPost } from "../infrastructure/api/client";
import type { ConsultationInput, Encounter, ProfessionalGrant } from "./professional-access-grants";

/* Mode invité (patient sans téléphone) : nom + date de naissance + téléphone retrouvent le profil, le professionnel le compare à la personne
   présente, puis confirme. L'accès ne couvre que la pré-consultation, dure 2 h, et le patient en est averti. */

export type GuestLookupInput = { first_name: string; last_name: string; birth_date: string; phone: string };
export type GuestLookupResult = {
  /** Jeton à usage unique, valable quelques minutes, lié au professionnel qui a cherché : aucun identifiant de patient ne circule. */
  confirmation_token: string;
  expires_in_seconds: number;
  patient: { first_name: string; last_name: string; photo_url: string | null };
  scope: string[];
};

const PATIENT_BASE = "/api/v1/patient/care";
const BASE = `${PATIENT_BASE}/professional`;

export function lookupGuestPatient(input: GuestLookupInput): Promise<GuestLookupResult> {
  return apiPost<GuestLookupResult>(`${BASE}/guest-access/lookup/`, input);
}

export function startGuestAccess(confirmationToken: string): Promise<ProfessionalGrant> {
  return apiPost<ProfessionalGrant>(`${BASE}/guest-access/start/`, { confirmation_token: confirmationToken });
}

/** Personne n'a préparé la pré-consultation d'un patient sans téléphone : le médecin la crée (ou retrouve celle qui existe déjà). */
export function createGuestPreconsultation(grantId: string, input: { reason: string; observations?: string }): Promise<Encounter> {
  return apiPost<Encounter>(`${BASE}/access-grants/${grantId}/guest-preconsultation/`, input);
}

/* ---- Médecin sans téléphone : il écrit sur le téléphone du patient, puis confirme plus tard sur le sien ------------------------------------------- */
export type GuestProfessionalCard = { first_name: string; last_name: string; photo_url: string | null; title: string; establishment_name: string };
export type GuestProfessionalLookup = { confirmation_token: string; expires_in_seconds: number; professional: GuestProfessionalCard; scope: string[] };
export type GuestSession = { grant_id: string; expires_at: string; professional_name: string; facility_label: string };

/** Ce que le médecin écrit sur le téléphone du patient. Pas de signature, pas d'examens demandés : il les ajoute à la confirmation. */
export type GuestConsultationInput = Omit<ConsultationInput, "access_grant_id" | "source_encounter_id" | "attestation_svg" | "requested_exams" | "pending_consultation_id" | "guest_consultation_id" | "conclusion" | "care_plan" | "reason"> & {
  reason: string;
  conclusion?: string;
  care_plan?: string;
};

/** Côté patient : une consultation saisie sur son téléphone qui n'est PAS (ou pas encore) signée. */
export type PatientGuestConsultation = {
  id: string;
  status: "awaiting_confirmation" | "rejected" | "expired";
  professional_name: string;
  facility_label: string;
  reason: string;
  written_at: string;
  expires_at: string;
};

/** Côté médecin : ce qui a été écrit en son nom, à relire puis signer (ou rejeter). */
export type GuestConsultationToConfirm = {
  id: string;
  status: string;
  access_grant_id: string;
  source_encounter_id: string;
  patient_name: string;
  patient_avatar: string;
  facility_label: string;
  draft: Partial<ConsultationInput>;
  encounter: Encounter;
  written_at: string;
  expires_at: string;
};

export function lookupGuestProfessional(input: GuestLookupInput): Promise<GuestProfessionalLookup> {
  return apiPost<GuestProfessionalLookup>(`${PATIENT_BASE}/guest-professional/lookup/`, input);
}

export function startGuestProfessional(confirmationToken: string): Promise<GuestSession> {
  return apiPost<GuestSession>(`${PATIENT_BASE}/guest-professional/start/`, { confirmation_token: confirmationToken });
}

export function saveGuestConsultation(grantId: string, input: GuestConsultationInput): Promise<PatientGuestConsultation> {
  return apiPost<PatientGuestConsultation>(`${PATIENT_BASE}/guest-professional/${grantId}/consultation/`, input);
}

export function listMyGuestConsultations(): Promise<PatientGuestConsultation[]> {
  return apiGet<PatientGuestConsultation[]>(`${PATIENT_BASE}/guest-consultations/`);
}

export function listGuestConsultationsToConfirm(): Promise<GuestConsultationToConfirm[]> {
  return apiGet<GuestConsultationToConfirm[]>(`${BASE}/guest-consultations/`);
}

export function rejectGuestConsultation(id: string): Promise<{ id: string; status: string }> {
  return apiPost<{ id: string; status: string }>(`${BASE}/guest-consultations/${id}/reject/`, {});
}

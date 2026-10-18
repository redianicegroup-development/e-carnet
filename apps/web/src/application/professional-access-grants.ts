import { apiGet, apiPost } from "../infrastructure/api/client";
import type { ConsultationRecord, ExamKind } from "../lib/care-records";
import type { StoredVitals, VitalKey } from "../lib/vitals";

export type ProfessionalGrant = { id: string; reference: string; professional_id: string | null; establishment_id: string | null; professional_name: string; facility_label: string; scope: string[]; status: "pending" | "active" | "refused" | "expired" | "revoked"; starts_at: string | null; expires_at: string | null; extension_count: number };
export type Encounter = { id: string; reason: string; observations: string; vitals?: StoredVitals; recorded_with_help?: string; status: "draft" | "closed"; facility_label: string; provenance: { label: string } };
export type Consultation = ConsultationRecord;

export function listProfessionalGrants(): Promise<ProfessionalGrant[]> {
  return apiGet<ProfessionalGrant[]>("/api/v1/patient/care/professional/access-grants/");
}

export function requestProfessionalGrant(scope: string[], qrToken: string): Promise<ProfessionalGrant> {
  return apiPost<ProfessionalGrant>("/api/v1/patient/care/professional/access-grants/", { scope, qr_token: qrToken });
}

/** La dernière pré-consultation en préparation du patient (au plus une), lisible tant que l'autorisation est active. */
export function listAuthorizedEncounters(grantId: string): Promise<Encounter[]> {
  return apiGet<Encounter[]>(`/api/v1/patient/care/professional/access-grants/${grantId}/encounters/`);
}

export function listProfessionalConsultations(): Promise<Consultation[]> {
  return apiGet<Consultation[]>("/api/v1/patient/care/professional/consultations/");
}

export type ConsultationInput = {
  access_grant_id: string;
  source_encounter_id: string;
  reason?: string;
  symptoms?: string;
  clinical_exam?: string;
  diagnosis?: string;
  /** Jeu final de constantes relu par le médecin : il remplace celui de la pré-consultation. */
  vitals?: Partial<Record<VitalKey, number>>;
  prescription_lines?: Array<{ drug_name: string; dosage?: string; posology: string; duration?: string; instructions?: string }>;
  requested_exams?: Array<{ kind: ExamKind; label: string }>;
  conclusion: string;
  care_plan: string;
  attestation_svg: string;
};

export function validateProfessionalConsultation(input: ConsultationInput): Promise<Consultation> {
  return apiPost<Consultation>("/api/v1/patient/care/professional/consultations/", input);
}

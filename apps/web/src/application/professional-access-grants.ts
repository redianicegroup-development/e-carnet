import { apiGet, apiPost } from "../infrastructure/api/client";

export type ProfessionalGrant = { id: string; reference: string; professional_id: string | null; establishment_id: string | null; professional_name: string; facility_label: string; scope: string[]; status: "pending" | "active" | "refused" | "expired" | "revoked"; starts_at: string | null; expires_at: string | null; extension_count: number };
export type Encounter = { id: string; reason: string; observations: string; recorded_with_help?: string; status: "draft" | "closed"; facility_label: string; provenance: { label: string } };
export type Consultation = { id: string; professional_name: string; facility_label: string; reason: string; conclusion: string; care_plan: string; validated_at: string; provenance: { label: string } };

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

export function validateProfessionalConsultation(input: { access_grant_id: string; source_encounter_id: string; conclusion: string; care_plan: string; attestation_svg: string }): Promise<Consultation> {
  return apiPost<Consultation>("/api/v1/patient/care/professional/consultations/", input);
}

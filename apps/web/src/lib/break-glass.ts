/** ACS-13 — accès d'urgence « bris de glace » : types partagés et petits utilitaires purs (testables sans navigateur). */

export const BREAK_GLASS_API = "/api/v1/patient/care";
export const BREAK_GLASS_MIN_NOTE = 10;
export const BREAK_GLASS_MAX_NOTE = 280;
export const BREAK_GLASS_MAX_REVIEW_NOTE = 500;

export type EmergencyReason = { code: string; label: string };
export type EmergencyLine = { label: string; details: string };
export type EmergencyAccess = {
  id: string;
  status: "active" | "expired";
  patient_label: string;
  reason_category: string;
  reason_label: string;
  requested_at: string;
  expires_at: string;
  review: { outcome: string; outcome_label: string; reviewed_at: string } | null;
};
/** La fiche d'urgence, rien de plus : identité, groupe sanguin, allergies, traitements, antécédents. */
export type EmergencySummary = {
  first_name: string;
  last_name: string;
  blood_group: string;
  allergies: EmergencyLine[];
  treatments: EmergencyLine[];
  antecedents: EmergencyLine[];
  provenance: string;
};
export type EmergencyOverview = { enabled: boolean; duration_minutes: number; reasons: EmergencyReason[]; items: EmergencyAccess[] };
export type EmergencyOpened = { access: EmergencyAccess; summary: EmergencySummary };

export type EmergencyReviewState = "pending" | "overdue" | "done";
export type EmergencyReviewItem = {
  id: string;
  professional_name: string;
  patient_name: string;
  reason_category: string;
  reason_label: string;
  reason_note: string;
  requested_at: string;
  expires_at: string;
  review_due_at: string;
  review_state: EmergencyReviewState;
  review: { outcome: string; outcome_label: string; reviewed_at: string } | null;
  is_own: boolean;
  can_review: boolean;
};

/** Le serveur répond 404 « break_glass_disabled » tant que le drapeau est coupé : l'interface ne montre alors rien. */
export function isBreakGlassDisabled(error: unknown): boolean {
  // Reconnaissance par la forme (ApiError : status + details) : ce module reste pur, sans import.
  const candidate = error as { status?: number; details?: { code?: string } } | null;
  return candidate?.status === 404 && candidate.details?.code === "break_glass_disabled";
}

/** Secondes restantes avant la fin de la fenêtre (jamais négatif). */
export function secondsLeft(expiresAt: string, now: number = Date.now()): number {
  const end = new Date(expiresAt).getTime();
  return Number.isNaN(end) ? 0 : Math.max(0, Math.ceil((end - now) / 1000));
}

/** « 59:04 » : ce que le professionnel lit pendant qu'il soigne. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

/** Le texte libre est obligatoire, relu par l'établissement : on le vérifie avant d'envoyer, le serveur le revérifie. */
export function noteProblem(note: string): string {
  const length = note.trim().replace(/\s+/g, " ").length;
  if (length < BREAK_GLASS_MIN_NOTE) return `Décrivez la situation en quelques mots (${BREAK_GLASS_MIN_NOTE} caractères au moins).`;
  if (length > BREAK_GLASS_MAX_NOTE) return `Le texte est trop long (${BREAK_GLASS_MAX_NOTE} caractères au plus).`;
  return "";
}

export const REVIEW_STATE_LABELS: Record<EmergencyReviewState, string> = {
  pending: "À revoir",
  overdue: "Revue en retard",
  done: "Revu",
};

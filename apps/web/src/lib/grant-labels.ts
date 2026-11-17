export const GRANT_STATUS_LABELS: Record<string, string> = { active: "Actif", pending: "En attente", expired: "Expiré", revoked: "Révoqué", declined: "Refusé", refused: "Refusé", ended: "Terminé" };
export const GRANT_SCOPE_LABELS: Record<string, string> = { pre_consultation: "Pré-consultation", declarations: "Déclarations", medical_documents: "Documents médicaux (lecture seule)", consultation_history: "Historique des consultations", vaccinations: "Vaccinations", measurements: "Mesures" };
export const scopeText = (scope: string[] | undefined) => (scope ?? []).map((key) => GRANT_SCOPE_LABELS[key] ?? key).join(" · ") || "—";
export const normalizeName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

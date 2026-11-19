import { apiDelete, apiGet, apiPost } from "../infrastructure/api/client";

/* Profils d'un compte patient : le titulaire (« Compte patient ») et les enfants qu'il représente (« Compte enfant »).
   Le profil actif est gardé par le serveur dans la session : toutes les routes /api/v1/patient/… répondent pour ce profil.
   Changer de profil = dire au serveur quel profil est actif, puis prévenir l'application (PROFILE_CHANGED_EVENT) pour qu'elle recharge ses écrans. */

export const PROFILE_CHANGED_EVENT = "ecarnet:patient-profile-changed";
/** La liste des profils a changé (profil créé, lien révoqué ou réactivé) sans que le profil ouvert change : on recharge la liste, pas les écrans. */
export const PROFILES_UPDATED_EVENT = "ecarnet:patient-profiles-updated";
export const HOLDER_LABEL = "Compte patient";
export const CHILD_LABEL = "Compte enfant";

export type PatientProfileEntry = {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  /** Photo de l'enfant (URL ou image intégrée) ; absente tant qu'aucune photo n'a été choisie : on affiche alors ses initiales. */
  avatar_url?: string;
  birth_date: string;
  relationship: string;
  status: "active" | "revoked" | "transferred";
  transfer_status: string | null;
  is_active: boolean;
};

export const profileName = (profile: Pick<PatientProfileEntry, "first_name" | "last_name">) => [profile.first_name, profile.last_name].filter(Boolean).join(" ");
export const profileInitials = (profile: Pick<PatientProfileEntry, "first_name" | "last_name">) => `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase() || "EC";
/** Étiquette du compte affiché : « Compte enfant » tant qu'un profil d'enfant est actif, « Compte patient » sinon. */
export const accountLabel = (active: PatientProfileEntry | null) => (active ? CHILD_LABEL : HOLDER_LABEL);
/** Seuls les liens actifs se choisissent : un lien révoqué ou transféré n'ouvre plus le dossier. */
export const usableProfiles = (profiles: PatientProfileEntry[]) => profiles.filter((profile) => profile.status === "active");

export const listProfiles = () => apiGet<PatientProfileEntry[]>("/api/v1/patient/representations/");

/** Choisit le profil actif (`null` = le titulaire) et prévient l'application. */
export async function selectProfile(patientId: string | null) {
  if (patientId) await apiPost("/api/v1/patient/representations/active/", { patient_id: patientId });
  else await apiDelete("/api/v1/patient/representations/active/");
  window.dispatchEvent(new Event(PROFILE_CHANGED_EVENT));
}

/** Exécute `task` pour le profil `patientId`, puis remet le profil qui était actif avant. L'écran ne change pas : seul le temps de l'action.
    Sert à compléter le carnet d'un enfant sans quitter l'écran où l'on se trouve. */
export async function runAsProfile<T>(patientId: string, task: () => Promise<T>): Promise<T> {
  const previous = (await listProfiles()).find((profile) => profile.is_active)?.patient_id ?? null;
  await apiPost("/api/v1/patient/representations/active/", { patient_id: patientId });
  try {
    return await task();
  } finally {
    if (previous === patientId) { /* déjà le bon profil */ }
    else if (previous) await apiPost("/api/v1/patient/representations/active/", { patient_id: previous }).catch(() => undefined);
    else await apiDelete("/api/v1/patient/representations/active/").catch(() => undefined);
  }
}

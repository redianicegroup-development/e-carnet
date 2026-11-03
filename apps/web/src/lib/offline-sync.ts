import { apiGet } from "../infrastructure/api/client";
import { isOfflineSnapshotEnabled, saveOfflineSnapshot } from "./offline-snapshot";
import { toOfflineDeclaration, toOfflineProfile, type OfflineProfile } from "./offline-policy";

/**
 * Met à jour la copie locale des déclarations (lecture seule) quand l'appareil est en ligne.
 * Elle couvre le profil actif ; les profils enfants des représentants s'ajoutent à mesure qu'ils sont ouverts en ligne
 * (on ne change jamais de profil actif à la place de la personne : ce changement est journalisé côté serveur).
 */
type Representation = { patient_id: string; first_name: string; last_name: string; status: string; is_active: boolean };
export type OfflineSyncAccount = { id: string; first_name: string; last_name: string; patient_profile: { id: string | null } };

let running: Promise<void> | null = null;
let again = false;

function activeProfileId(representations: Representation[], account: OfflineSyncAccount): string | null {
  const active = representations.find((item) => item.is_active && item.status === "active");
  return active?.patient_id ?? account.patient_profile.id;
}

async function run(account: OfflineSyncAccount): Promise<void> {
  const ownProfileId = account.patient_profile.id;
  if (!ownProfileId) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (!(await isOfflineSnapshotEnabled())) return;
  try {
    // Le profil actif est choisi côté serveur (session). On le relit après les déclarations : s'il a changé entre-temps,
    // on n'enregistre rien plutôt que d'attribuer les déclarations d'un profil au nom d'un autre.
    const before = await apiGet<Representation[]>("/api/v1/patient/representations/");
    const declarations = await apiGet<unknown[]>("/api/v1/patient/declarations/");
    const after = await apiGet<Representation[]>("/api/v1/patient/representations/");
    const active = activeProfileId(before, account);
    if (!active || active !== activeProfileId(after, account)) return;
    const profiles = [
      toOfflineProfile(ownProfileId, "self", account.first_name, account.last_name),
      ...after.filter((item) => item.status === "active").map((item) => toOfflineProfile(item.patient_id, "child", item.first_name, item.last_name)),
    ].filter((profile): profile is OfflineProfile => profile !== null);
    await saveOfflineSnapshot({
      accountId: account.id,
      activeProfileId: active,
      profiles,
      declarations: declarations.map(toOfflineDeclaration).filter((item) => item !== null),
    });
  } catch {
    // Hors connexion, session absente, accès délégué (lecture limitée) : la copie précédente reste en l'état jusqu'à son expiration.
  }
}

/** Les demandes rapprochées sont regroupées : une synchronisation en cours en relance une seule autre après elle. */
export function syncOfflineSnapshot(account: OfflineSyncAccount): Promise<void> {
  if (running) { again = true; return running; }
  running = run(account).finally(() => {
    running = null;
    if (again) { again = false; void syncOfflineSnapshot(account); }
  });
  return running;
}

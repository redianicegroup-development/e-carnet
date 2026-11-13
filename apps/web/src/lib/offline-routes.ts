import type { SpaceId } from "./spaces";

/**
 * Écrans préparés pour fonctionner sans réseau : le service worker en garde la coquille (HTML sans donnée personnelle : les pages privées
 * sont des composants navigateur, les données viennent de l'API) et les fichiers /_next/static/ qu'elles chargent. Les données, elles,
 * viennent de la copie chiffrée (`offline-cache.ts`) pour ce qui a déjà été ouvert en ligne.
 * `tests/hors-connexion-2026-11-05.test.mjs` vérifie que chaque adresse correspond à une vraie page.
 */
export const INFO_ROUTES = ["/aide", "/a-propos", "/securite", "/credits", "/cgu", "/confidentialite", "/mentions-legales", "/conditions-rattachement", "/proches-et-enfants"] as const;

export const SPACE_ROUTES: Record<SpaceId, readonly string[]> = {
  patient: ["/patient", "/patient/carnet", "/patient/consultations", "/patient/historique", "/patient/parametres", "/patient/acces", "/patient/agenda", "/patient/proches", "/patient/adressages", "/patient/transfert"],
  professional: ["/professionnel", "/professionnel/patients", "/professionnel/consultations", "/professionnel/acces", "/professionnel/etablissements", "/professionnel/agenda", "/professionnel/adressages", "/professionnel/parametres"],
  establishment: ["/etablissement", "/etablissement/dossiers", "/etablissement/medecins", "/etablissement/demandes", "/etablissement/modeles", "/etablissement/parametres", "/etablissement/gestion", "/etablissement/aide"],
  laboratory: ["/laboratoire", "/laboratoire/depots", "/laboratoire/parametres"],
};

export function routesToWarm(space: SpaceId): string[] {
  return [...SPACE_ROUTES[space], ...INFO_ROUTES];
}

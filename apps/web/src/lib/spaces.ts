import type { IconName } from "../components/ui/Icon";

export type SpaceId = "patient" | "professional" | "establishment";
export type Tab = { id: string; label: string; long: string; href: string; icon: IconName; match: (path: string) => boolean };

const exact = (href: string) => (path: string) => path === href;
const section = (...hrefs: string[]) => (path: string) => hrefs.some((href) => path === href || path.startsWith(`${href}/`));

/* Cinq entrées par espace, dans le même ordre et à la même place que les maquettes mobiles (barre basse),
   mais avec les parcours en vigueur : ce sont les écrans qui changent, pas la navigation. */
export const SPACES: Record<SpaceId, { label: string; role: string; home: string; tabs: Tab[]; bare: string[] }> = {
  patient: {
    label: "Espace patient", role: "patient", home: "/patient", bare: [],
    tabs: [
      { id: "home", label: "Accueil", long: "Accueil", href: "/patient", icon: "home", match: exact("/patient") },
      { id: "carnet", label: "Carnet", long: "Mon carnet", href: "/patient/carnet", icon: "folder", match: section("/patient/carnet") },
      { id: "consultations", label: "Consult.", long: "Consultations", href: "/patient/consultations", icon: "stethoscope", match: section("/patient/consultations") },
      { id: "acces", label: "Accès", long: "Accès et QR", href: "/patient/acces", icon: "share", match: section("/patient/acces") },
      { id: "moi", label: "Moi", long: "Mon compte", href: "/patient/parametres", icon: "user", match: section("/patient/parametres") },
    ],
  },
  professional: {
    label: "Espace professionnel", role: "professional", home: "/professionnel", bare: ["/professionnel/onboarding"],
    tabs: [
      { id: "home", label: "Accueil", long: "Accueil", href: "/professionnel", icon: "home", match: exact("/professionnel") },
      { id: "patients", label: "Patients", long: "Patients", href: "/professionnel/patients", icon: "search", match: section("/professionnel/patients") },
      { id: "consultations", label: "Consult.", long: "Consultations", href: "/professionnel/consultations", icon: "stethoscope", match: section("/professionnel/consultations") },
      { id: "acces", label: "Accès", long: "Établissement", href: "/professionnel/acces", icon: "building", match: section("/professionnel/acces") },
      { id: "moi", label: "Moi", long: "Mon profil", href: "/professionnel/parametres", icon: "user", match: section("/professionnel/parametres") },
    ],
  },
  establishment: {
    label: "Espace établissement", role: "establishment", home: "/etablissement", bare: ["/etablissement/activation"],
    tabs: [
      { id: "home", label: "Accueil", long: "Accueil", href: "/etablissement", icon: "home", match: exact("/etablissement") },
      { id: "demandes", label: "Demandes", long: "Demandes", href: "/etablissement/demandes", icon: "document", match: section("/etablissement/demandes") },
      { id: "medecins", label: "Médecins", long: "Médecins", href: "/etablissement/medecins", icon: "users", match: section("/etablissement/medecins") },
      { id: "aide", label: "Aide", long: "Aide", href: "/etablissement/aide", icon: "help", match: section("/etablissement/aide") },
      { id: "moi", label: "Moi", long: "Mon compte", href: "/etablissement/parametres", icon: "user", match: section("/etablissement/parametres") },
    ],
  },
};

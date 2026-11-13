import type { IconName } from "../components/ui/Icon";

export type SpaceId = "patient" | "professional" | "establishment" | "laboratory";
/** `featured` : onglet principal de l'espace (la 3e entrée de la barre basse mobile), mis en évidence par une pastille de miel qui suit la palette choisie. */
export type Tab = { id: string; label: string; long: string; href: string; icon: IconName; match: (path: string) => boolean; featured?: boolean };

const exact = (href: string) => (path: string) => path === href;
const section = (...hrefs: string[]) => (path: string) => hrefs.some((href) => path === href || path.startsWith(`${href}/`));

/* Navigation courte : cinq entrées maximum par espace (l'espace laboratoire n'en a que trois : il scanne, il dépose, il consulte ses dépôts). Les fonctions secondaires vivent dans l'écran de leur domaine,
   plutôt que de créer un onglet séparé pour chaque action. */
export const SPACES: Record<SpaceId, { label: string; role: string; home: string; tabs: Tab[]; bare: string[]}> = {
  patient: {
    label: "Espace patient", role: "patient", home: "/patient", bare: [],
    tabs: [
      { id: "home", label: "Accueil", long: "Accueil", href: "/patient", icon: "home", match: exact("/patient") },
      { id: "carnet", label: "Mon carnet", long: "Mon carnet · documents · vaccins · traitements", href: "/patient/carnet", icon: "folder", match: section("/patient/carnet") },
      { id: "consultations", label: "Consultations", long: "Pré-consultation et accès temporaire", href: "/patient/consultations", icon: "stethoscope", match: section("/patient/consultations"), featured: true },
      { id: "historique", label: "Historique", long: "Historique · consultations · vaccins · accès", href: "/patient/historique", icon: "clock", match: section("/patient/historique", "/patient/acces") },
      { id: "moi", label: "Moi", long: "Mon compte et paramètres", href: "/patient/parametres", icon: "user", match: section("/patient/parametres") },
    ],
  },
  professional: {
    label: "Espace professionnel", role: "professional", home: "/professionnel", bare: ["/professionnel/onboarding"],
    tabs: [
      { id: "home", label: "Accueil", long: "Accueil", href: "/professionnel", icon: "home", match: exact("/professionnel") },
      { id: "patients", label: "Patients", long: "Patients autorisés et demandes d’accès", href: "/professionnel/patients", icon: "search", match: section("/professionnel/patients") },
      { id: "consultations", label: "Suivi", long: "Consultations · ordonnances · plans de suivi", href: "/professionnel/consultations", icon: "stethoscope", match: section("/professionnel/consultations"), featured: true },
      { id: "acces", label: "Rattachement", long: "Mon rattachement et mes établissements", href: "/professionnel/acces", icon: "building", match: section("/professionnel/acces", "/professionnel/etablissements") },
      { id: "moi", label: "Moi", long: "Mon profil et paramètres", href: "/professionnel/parametres", icon: "user", match: section("/professionnel/parametres") },
    ],
  },
  establishment: {
    label: "Espace établissement", role: "establishment", home: "/etablissement", bare: ["/etablissement/activation", "/etablissement/fiche"],
    tabs: [
      { id: "home", label: "Accueil", long: "Accueil", href: "/etablissement", icon: "home", match: exact("/etablissement") },
      { id: "dossiers", label: "Dossiers", long: "Dossiers patients de l’établissement", href: "/etablissement/dossiers", icon: "folder", match: section("/etablissement/dossiers") },
      { id: "equipe", label: "Équipe", long: "Professionnels et administrateurs", href: "/etablissement/medecins", icon: "users", match: section("/etablissement/medecins") },
      { id: "demandes", label: "Demandes", long: "Demandes et suivi des rattachements", href: "/etablissement/demandes", icon: "document", match: section("/etablissement/demandes") },
      { id: "parametres", label: "Paramètres", long: "Pré-consultation · ordonnances · compte", href: "/etablissement/parametres", icon: "sliders", match: section("/etablissement/parametres", "/etablissement/fiche") },
    ],
  },
  /* PRO-21 — le laboratoire ne lit aucun dossier : il scanne le QR d'examen du patient, dépose un PDF par examen, relit ses dépôts.
     Le compte reste un compte « établissement » côté serveur (contexte `establishment`) ; seule l'interface a son propre espace. */
  laboratory: {
    label: "Espace laboratoire", role: "establishment", home: "/laboratoire", bare: [],
    tabs: [
      { id: "scanner", label: "Scanner", long: "Scanner le QR d’examen et déposer un résultat", href: "/laboratoire", icon: "qr", match: exact("/laboratoire") },
      { id: "depots", label: "Dépôts", long: "Historique de vos dépôts de résultats", href: "/laboratoire/depots", icon: "document", match: section("/laboratoire/depots") },
      { id: "moi", label: "Moi", long: "Mon compte et paramètres", href: "/laboratoire/parametres", icon: "user", match: section("/laboratoire/parametres") },
    ],
  },
};

/** Onglets d'un médecin dont le rattachement n'est pas encore validé : l'accueil et le rattachement, rien d'autre.
    Le compte (profil, paramètres, déconnexion) reste dans le menu du compte. */
export const PROFESSIONAL_SETUP_TABS = ["home", "acces"] as const;

/** Onglets affichés. `clinicalReady` : le médecin a un rattachement actif (`clinical_access.allowed`) ; tant qu'il ne l'est pas — ou
    qu'on ne le sait pas encore — il ne voit que l'accueil et le rattachement. Une fois le code validé par l'établissement, tous les onglets apparaissent. */
export function visibleTabsFor(space: SpaceId, clinicalReady: boolean): Tab[] {
  const tabs = SPACES[space].tabs;
  // Le patient garde « Moi » comme 5e onglet de la barre basse mobile (masqué sur grand écran, où le compte est en bas de la sidebar).
  if (space === "professional" && !clinicalReady) return tabs.filter((tab) => (PROFESSIONAL_SETUP_TABS as readonly string[]).includes(tab.id));
  return tabs;
}

type ContextLike = { role: string; is_active?: boolean; onboarding_completed?: boolean; is_laboratory?: boolean };

/** Un compte est « professionnel » quand son contexte professionnel existe et que son profil est créé. Les patients simples,
    les comptes établissement et les médecins en cours d'inscription n'ont pas de second espace. */
export function isProfessionalAccount(contexts: ContextLike[] | undefined): boolean {
  return (contexts ?? []).some((context) => context.role === "professional" && context.onboarding_completed === true);
}

/** Entrée « Changer d'espace » du menu du compte : l'autre espace du même compte, ou `null` (menu sans l'entrée) pour tout compte
    qui n'est pas professionnel. Le patient simple ne voit donc jamais ce choix, et l'espace établissement n'en a pas. */
export function spaceSwitchTarget(space: SpaceId, contexts: ContextLike[] | undefined): { role: "patient" | "professional"; space: SpaceId; label: string; href: string } | null {
  if (!isProfessionalAccount(contexts)) return null;
  if (space === "patient") return { role: "professional", space: "professional", label: SPACES.professional.label, href: SPACES.professional.home };
  if (space === "professional") return { role: "patient", space: "patient", label: SPACES.patient.label, href: SPACES.patient.home };
  return null;
}

/** Contexte à activer côté serveur pour que l'espace affiché soit celui que le serveur reconnaît (lien direct, favori) :
    seulement pour un compte professionnel qui possède l'espace demandé sans qu'il soit actif. `null` = rien à faire. */
export function contextToActivate(space: SpaceId, contexts: ContextLike[] | undefined): "patient" | "professional" | null {
  if (space === "establishment" || space === "laboratory" || !isProfessionalAccount(contexts)) return null;
  const wanted = (contexts ?? []).find((context) => context.role === SPACES[space].role);
  return wanted && wanted.is_active !== true ? (SPACES[space].role as "patient" | "professional") : null;
}

/** Le compte est celui d'un laboratoire (PRO-21) : le serveur l'indique sur le contexte `establishment`. */
export function isLaboratoryAccount(contexts: ContextLike[] | undefined): boolean {
  return (contexts ?? []).some((context) => context.role === "establishment" && context.is_laboratory === true);
}

/** Adresse où l'espace affiché doit envoyer le compte, ou `null` : un laboratoire n'a pas l'espace établissement (ni les onglets
    Dossiers, Équipe, Demandes), et un compte qui n'est pas un laboratoire n'a pas l'espace laboratoire. Pas de redirection en boucle :
    chaque espace n'a qu'une seule cible. */
export function laboratoryRedirect(space: SpaceId, contexts: ContextLike[] | undefined): string | null {
  const laboratory = isLaboratoryAccount(contexts);
  if (space === "establishment" && laboratory) return SPACES.laboratory.home;
  if (space === "laboratory" && !laboratory) return (contexts ?? []).some((context) => context.role === "establishment") ? SPACES.establishment.home : "/";
  return null;
}

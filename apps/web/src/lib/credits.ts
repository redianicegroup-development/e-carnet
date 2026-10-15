/** Crédits du projet E-Carnet — organisation et contributions présentées par l'équipe. */
import type { IconName } from "../components/ui/Icon";

export const CREDITS_UPDATED = "2026-10-15";

export const CREDITS_ORIGINS: {
  id: string;
  name: string;
  role: string;
  icon: IconName;
  text: string;
}[] = [
  {
    id: "redianice",
    name: "Redianice",
    role: "Startup porteuse du projet",
    icon: "heart",
    text: "À l'origine de la démarche, Redianice porte la vision du projet et coordonne la collaboration entre les compétences mobilisées pour concevoir E-Carnet.",
  },
  {
    id: "development",
    name: "Développement numérique — AKATech Studio",
    role: "Conception et réalisation technique",
    icon: "sparkle",
    text: "Le fondateur d'AKATech Studio contribue au projet en tant que développeur et prend en charge la conception et la réalisation de la solution numérique.",
  },
  {
    id: "legal",
    name: "Accompagnement juridique",
    role: "Cadre légal et juridique",
    icon: "document",
    text: "Une compétence juridique accompagne le projet sur les questions légales et la formulation des éléments qui nécessitent un examen juridique.",
  },
  {
    id: "project-management",
    name: "Pilotage du projet",
    role: "Coordination au sein de la startup",
    icon: "users",
    text: "Le chef de projet de la startup assure le suivi de la collaboration, la coordination des contributions et l'avancement du projet.",
  },
  {
    id: "visual-identity",
    name: "Design graphique et identité visuelle",
    role: "Branding, logo et direction visuelle",
    icon: "pencil",
    text: "Deux graphistes contribuent au branding, à la création du logo et à la construction d'une identité visuelle cohérente pour E-Carnet.",
  },
];

export const CREDITS_BUILT_WITH = [
  "Next.js et React pour l'interface web",
  "Django et Django REST framework pour l'API",
  "PostgreSQL pour la base de données",
  "Des polices libres, distribuées sous licence SIL Open Font License et servies par le site",
];

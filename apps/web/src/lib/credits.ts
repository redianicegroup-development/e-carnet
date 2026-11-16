/** Crédits et remerciements — faits confirmés par le porteur du projet. */
import type { IconName } from "../components/ui/Icon";

export const CREDITS_UPDATED = "2026-11-15";

/** Site d'AKATech Studio : lien du pied de page (survol avec le logo) et de la page Crédits. */
export const AKATECH_URL = "https://akatech.vercel.app/";

/** Site de Redianice : lien du pied de page (survol avec le logo), de la page Crédits et de la page À propos. */
export const REDIANICE_URL = "https://redianice.vercel.app/";

/** Les deux structures. Redianice porte le projet ; le développeur de l'équipe en est aussi le fondateur d'AKATech Studio, et le fondateur de Redianice est le juriste de l'équipe. */
export const CREDITS_ORIGINS: { id: string; name: string; role: string; icon: IconName; text: string; href?: string }[] = [
  {
    id: "redianice",
    name: "Redianice",
    role: "Startup porteuse du projet",
    icon: "heart",
    text: "Startup à l’origine de Mon E‑Carnet. Elle réunit l’équipe du projet et construit des outils simples au service du domaine de la santé.",
    href: REDIANICE_URL,
  },
  {
    id: "akatech",
    name: "AKATech Studio",
    role: "Studio de développement",
    icon: "sparkle",
    text: "Studio qui conçoit et développe l’application. Son fondateur est le développeur de l’équipe Redianice. La palette Miel et la police Bricolage Grotesque sont les choix par défaut de l’application.",
    href: AKATECH_URL,
  },
];

/** L'équipe : quatre personnes, avec le statut et le rôle que leur donne le site de Redianice (équipe Redianice). Pas de noms dans les crédits. */
/** `figureTitle` et `figureSub` : version courte pour les nœuds du schéma, où le titre complet ne tiendrait pas. */
export const CREDITS_TEAM: { id: string; role: string; org: string; icon: IconName; text: string; figureTitle: string; figureSub: string }[] = [
  {
    id: "fondateur-juridique",
    role: "Founder of Redianice & Legal Officer",
    org: "Fondateur de Redianice · Droit",
    icon: "document",
    text: "Fondateur de Redianice et juriste de l’équipe. Il apporte un regard juridique au projet et aide l’équipe à repérer les points de vigilance : mentions légales, confidentialité, conditions d’utilisation.",
    figureTitle: "Fondateur et juriste", figureSub: "Redianice · Droit",
  },
  {
    id: "developpement",
    role: "Chief Technology Officer (CTO)",
    org: "Développeur · Fondateur d’AKATech Studio",
    icon: "phone",
    text: "Développeur web freelance à AKATech Studio. Il conçoit et développe l’application : interface, API et base de données.",
    figureTitle: "CTO · Développeur", figureSub: "Fondateur d’AKATech Studio",
  },
  {
    id: "design",
    role: "Lead Brand Designer",
    org: "Design · Collaboratrice de Redianice",
    icon: "pencil",
    text: "Elle contribue à l’identité visuelle de Redianice et de ses produits, dont le logo et le branding de Mon E‑Carnet, en binôme avec l’autre graphiste.",
    figureTitle: "Lead Brand Designer", figureSub: "Design",
  },
  {
    id: "communication",
    role: "Community Manager & Infographiste",
    org: "Communication · Freelance",
    icon: "users",
    text: "Il donne de la visibilité au projet à travers les réseaux sociaux et crée des visuels qui attirent l’attention : communication digitale, affiches et contenus.",
    figureTitle: "Community Manager", figureSub: "Communication · Infographie",
  },
];

export const CREDITS_BUILT_WITH = [
  "Next.js et React pour l’interface",
  "Django et Django REST framework pour l’API",
  "PostgreSQL pour la base de données",
  "Des polices libres (licence SIL Open Font License), servies par le site lui-même",
];

/** Crédits et remerciements — faits confirmés par le porteur du projet. */
import type { IconName } from "../components/ui/Icon";

export const CREDITS_UPDATED = "2026-10-16";

/** Site d'AKATech Studio : lien du pied de page (survol avec le logo) et de la page Crédits. */
export const AKATECH_URL = "https://akatech.vercel.app/";

/** Les deux structures. Redianice porte le projet ; le développeur de l'équipe en est aussi le fondateur d'AKATech Studio. */
export const CREDITS_ORIGINS: { id: string; name: string; role: string; icon: IconName; text: string; href?: string }[] = [
  {
    id: "redianice",
    name: "Redianice",
    role: "Startup porteuse du projet",
    icon: "heart",
    text: "Startup à l’origine de Mon E‑Carnet. Elle réunit l’équipe du projet et construit des outils simples au service du domaine de la santé.",
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

/** L'équipe, par rôle. Pas de noms : seuls les rôles ont été confirmés. */
export const CREDITS_TEAM: { id: string; role: string; org: string; icon: IconName; text: string }[] = [
  {
    id: "chef-de-projet",
    role: "Chef de projet",
    org: "Redianice",
    icon: "users",
    text: "Pilote le projet, fixe les priorités et fait le lien entre l’équipe, les patients et les professionnels.",
  },
  {
    id: "developpement",
    role: "Développement",
    org: "Fondateur d’AKATech Studio",
    icon: "phone",
    text: "Conçoit et développe l’application : interface, API et base de données.",
  },
  {
    id: "juridique",
    role: "Juridique",
    org: "Juriste de l’équipe",
    icon: "document",
    text: "Prend en charge tout ce qui est légal et juridique : mentions légales, confidentialité, conditions d’utilisation.",
  },
  {
    id: "identite-visuelle",
    role: "Branding et identité visuelle",
    org: "Deux graphistes",
    icon: "pencil",
    text: "Ont dessiné le logo, le branding et l’identité visuelle de Mon E‑Carnet.",
  },
];

export const CREDITS_BUILT_WITH = [
  "Next.js et React pour l’interface",
  "Django et Django REST framework pour l’API",
  "PostgreSQL pour la base de données",
  "Des polices libres (licence SIL Open Font License), servies par le site lui-même",
];

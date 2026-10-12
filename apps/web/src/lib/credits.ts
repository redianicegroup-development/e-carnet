/** Crédits et remerciements — faits confirmés par le porteur du projet. */
import type { IconName } from "../components/ui/Icon";

export const CREDITS_UPDATED = "2026-10-12";

export const CREDITS_ORIGINS: { id: string; name: string; role: string; icon: IconName; text: string }[] = [
  {
    id: "redianice",
    name: "Redianice",
    role: "Startup à l’origine d’une proposition de collaboration",
    icon: "heart",
    text: "Startup ayant contacté AKATech Studio pour proposer une collaboration autour d’outils simples au service du domaine de la santé.",
  },
  {
    id: "akatech",
    name: "AKATech Studio",
    role: "Conception et réalisation d’E‑Carnet",
    icon: "sparkle",
    text: "Studio de conception du projet E‑Carnet et de son identité visuelle. Le thème turquoise Lagon reste la palette par défaut de l’application.",
  },
];

export const CREDITS_BUILT_WITH = [
  "Next.js et React pour l’interface",
  "Django et Django REST framework pour l’API",
  "PostgreSQL pour la base de données",
  "Des polices libres (licence SIL Open Font License), servies par le site lui-même",
];

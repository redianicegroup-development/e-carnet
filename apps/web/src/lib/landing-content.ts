import type { IconName } from "../components/ui/Icon";
import { DATA_POLICY } from "./data-policy";

/* Contenu de la landing. Règle : chaque phrase décrit ce que le produit fait réellement et reprend les réserves de la
   revue juridique (pas de « à tout moment », pas de « vérifié », pas de promesse de sécurité absolue).
   Les réponses de la FAQ sont recopiées mot pour mot de components/help/helpContent.ts (relues par les juristes) :
   tests/landing.test.mjs échoue si l'une des deux versions change sans l'autre.
   Fichier volontairement sans import d'exécution, pour rester testable avec `node --test`. */

/** Sources du hero, cadrées selon le format de l’écran : portrait sur mobile et paysage sur ordinateur. */
export const HERO_IMAGE = {
  mobileSrc: "/landing/hero-mobile.webp",
  desktopSrc: "/landing/hero-desktop.webp",
  alt: "Patient et infirmière préparent une consultation avec Mon E‑Carnet",
} as const;

export const HERO = {
  eyebrow: "Carnet de santé numérique",
  title: "Votre carnet de santé, sous votre contrôle.",
  lead: "Réunissez vos informations de santé, remettez votre carnet au médecin et choisissez qui peut le consulter.",
  primary: { href: "/connexion", label: "Commencer" },
  secondary: { href: "/connexion?mode=register&profil=professionnel", label: "Je suis professionnel" },
  note: "Organisez vos informations de santé dans votre espace sécurisé.",
  /** Texte qui apparaît par-dessus l'image quand elle occupe tout l'écran. Décoratif : repris par la section « confiance ». */
  reveal: { title: "Aucun accès sans votre choix.", text: "Vous voyez qui demande, depuis quel établissement et pour quel contenu." },
  sceneLabel: "Aperçu illustré de l’espace patient : une demande d’accès à autoriser ou refuser, et un QR code temporaire",
} as const;

export type Feature = {
  icon: IconName;
  title: string;
  text: string;
  /** Repère chiffré affiché dans la carte (il n'y a plus de bande de statistiques séparée). Les valeurs doivent rester celles du centre d'aide. */
  figure?: { value: string; unit?: string; label: string };
};
export const FEATURES: Feature[] = [
  { icon: "folder", title: "Mon carnet", text: "Vos antécédents, allergies et traitements, chacun marqué « Déclaré par le patient ». Le médecin le lit avec votre QR, sans tout vous redemander." },
  { icon: "qr", title: "QR code temporaire", text: "Un code sans donnée médicale. Il lance une demande, il n’ouvre pas votre carnet.", figure: { value: "5", unit: "min", label: "de validité pour un QR code" } },
  { icon: "lock", title: "Autorisations", text: "Un contenu précis, une durée limitée, deux prolongations d’une heure au plus. Vous autorisez ou refusez, demande par demande.", figure: { value: "2", unit: "h", label: "pour un accès autorisé" } },
  { icon: "clock", title: "Historique des accès", text: "Retrouvez qui a demandé quoi, quand, et la décision prise. Les consultations validées rejoignent votre carnet." },
];

export type Step = { icon: IconName; title: string; text: string };
export const STEPS: Step[] = [
  { icon: "pencil", title: "L’infirmier prépare", text: "Il saisit le motif, les symptômes et les constantes depuis votre espace patient. Sans infirmier, le médecin consulte directement : cette étape est facultative." },
  { icon: "qr", title: "Le médecin scanne votre QR", text: "Depuis son espace professionnel. Le QR est temporaire et ne sert qu’une fois." },
  { icon: "document", title: "Vous retrouvez ses préconisations", text: "Le médecin lit, consulte, puis établit ses préconisations. Elles rejoignent votre carnet une fois la consultation validée." },
];

export type Profile = { icon: IconName; label: string; title: string; points: string[]; cta: { href: string; text: string; subject?: string; track?: "signup" | "professional_signup" } };
export const PROFILES: Profile[] = [
  { icon: "user", label: "Patients", title: "Votre santé, organisée", points: ["Présentez votre QR : le médecin consulte votre carnet", "Gardez la maîtrise des accès"], cta: { href: "/connexion", text: "Commencer", track: "signup" } },
  { icon: "stethoscope", label: "Professionnels", title: "Un accès patient par patient", points: ["Scannez le QR du patient et consultez depuis votre espace", "Établissez vos préconisations, elles rejoignent son carnet"], cta: { href: "/connexion?mode=register&profil=professionnel", text: "Créer mon profil" } },
  { icon: "building", label: "Établissements", title: "Gérez vos rattachements", points: ["Invitez les professionnels", "Traitez les demandes de rattachement"], cta: { href: "#contact", text: "Contacter l’équipe", subject: "establishment" } },
];

export const SAFEGUARDS = [
  "Le patient autorise chaque accès",
  "Le périmètre et la durée sont visibles",
  "Les décisions restent consultables dans l’historique",
];

export type FaqItem = {
  id: string;
  q: string;
  a: string;
  link?: { href: string; label: string };
};

/* Six questions seulement : celles qu'un visiteur se pose avant de créer un espace et que la page ne traite pas déjà
   (le QR et la durée sont dans les cartes, la création de compte est le bouton du hero). Toutes les autres vivent dans le centre d'aide (/aide).
   Chaque réponse est recopiée mot pour mot de components/help/helpContent.ts (texte relu par les juristes) :
   tests/landing.test.mjs échoue si l'une des deux versions change sans l'autre. */
export const FAQ_ITEMS: FaqItem[] = [
  { id: "real-data", q: DATA_POLICY.faq.q, a: DATA_POLICY.faq.a },
  { id: "consent", q: "Un professionnel voit-il mon carnet automatiquement ?", a: "Non. Il doit être rattaché à un établissement actif, puis recevoir votre autorisation pour un contenu précis et une durée limitée." },
  { id: "refuse", q: "Puis-je refuser ou arrêter un accès ?", a: "Oui. Vous pouvez refuser une demande, ou révoquer un accès en cours depuis votre espace. La révocation n’efface pas les consultations déjà validées ni les traces d’audit." },
  { id: "verified", q: "Un professionnel est-il vérifié par Mon E-Carnet ?", a: "Non. Mon E-Carnet ne certifie ni l’identité, ni les diplômes, ni la compétence d’un professionnel. L’établissement confirme le rattachement du professionnel à sa structure." },
  { id: "protection", q: "Comment sont protégées mes informations ?", a: "Le service applique les mesures techniques décrites dans les pages Sécurité et Confidentialité.", link: { href: "/securite", label: "Page Sécurité" } },
  { id: "phone", q: "Puis-je l’utiliser sur mon téléphone ?", a: "Oui. Mon E‑Carnet s’ouvre dans le navigateur d’un téléphone ou d’un ordinateur, et peut s’installer comme une application lorsque votre navigateur le permet. Sans réseau, vous pouvez relire en lecture seule ce que vous avez déjà consulté ; toute modification demande la connexion." },
];

/** Dernière section : l'invitation à créer son espace, puis le formulaire de contact (une seule section, un seul bouton principal).
 *  `points` résume la valeur en trois lignes, au-dessus du bouton. */
export const FINAL = {
  title: "Ouvrez votre carnet avant votre prochain rendez-vous.",
  lead: "Commencez par l’essentiel, le reste peut venir plus tard.",
  points: [
    "Votre carnet réuni au même endroit",
    "Le médecin consulte votre carnet avec votre QR",
    "Ses préconisations rejoignent votre carnet",
  ],
  primary: { href: "/connexion?mode=register", label: "Créer mon carnet" },
  secondary: { href: "/connexion", label: "Déjà un compte ? Se connecter" },
  note: "Utilisez des informations exactes et gardez votre compte personnel.",
} as const;

export const CONTACT_COPY = {
  title: "Une question ? Écrivez-nous.",
  lead: "Patient, professionnel ou établissement : on vous répond.",
} as const;

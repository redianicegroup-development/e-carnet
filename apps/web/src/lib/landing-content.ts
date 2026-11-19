import type { IconName } from "../components/ui/Icon";
import { DATA_POLICY } from "./data-policy";
import { APP_SLOGAN } from "./brand";

/* Contenu de la landing. Règle : chaque phrase décrit ce que le produit fait réellement et reprend les réserves de la
   revue juridique (pas de « à tout moment », pas de « vérifié », pas de promesse de sécurité absolue).
   Les réponses de la FAQ sont recopiées mot pour mot de components/help/helpContent.ts (relues par les juristes) :
   tests/landing.test.mjs échoue si l'une des deux versions change sans l'autre.
   Fichier volontairement sans import d'exécution, pour rester testable avec `node --test`. */

/** Sources du hero, cadrées selon le format de l’écran : portrait sur mobile et paysage sur ordinateur. */
export const HERO_IMAGE = {
  mobileSrc: "/landing/hero-mobile.webp",
  desktopSrc: "/landing/hero-desktop.webp",
  alt: "Une femme souriante montre son téléphone : l’écran affiche Mon E‑Carnet",
} as const;

/** Petits carrés posés dans le titre du héro, entre les mots : deux diaporamas (a, b) et, en plus, l'emplacement « media » d'où part la grande image. */
export type HeroSlot = "a" | "b";
export const HERO_SLOTS: readonly HeroSlot[] = ["a", "b"];

/** Slogan du héro (le titre de la page), ligne par ligne, avec les carrés posés entre les mots. Une ligne ne se coupe pas : un carré ne se retrouve jamais seul en bout de ligne. */
export type HeroTitleItem = string | { tile: HeroSlot | "media" };
export const HERO_TITLE_LINES: readonly (readonly HeroTitleItem[])[] = [
  ["Gardez", { tile: "a" }, "le", "fil", { tile: "media" }],
  ["avec", { tile: "b" }, "Mon E‑Carnet."],
];

/** Les mots seuls, sans les carrés. Mis bout à bout, ils se lisent comme APP_SLOGAN (HERO.title). */
export const HERO_TITLE_GROUPS: readonly (readonly string[])[] = HERO_TITLE_LINES.map((line) => line.filter((item): item is string => typeof item === "string"));

/** Photos des carrés : chaque carré change d’image toutes les 4 s, décalé d’1 s du carré précédent, jamais la même image dans deux carrés en même temps.
    Photos recadrées en 480 × 480. Pour en ajouter : déposer le fichier dans public/landing/ et l'ajouter ici. */
export const HERO_SLIDES = [
  "/landing/hero-slide-1.webp",
  "/landing/hero-slide-2.webp",
  "/landing/hero-slide-3.webp",
  "/landing/hero-slide-4.webp",
  "/landing/hero-slide-5.webp",
  "/landing/hero-slide-6.webp",
  "/landing/hero-slide-7.webp",
  "/landing/hero-slide-8.webp",
  "/landing/hero-slide-9.webp",
  "/landing/hero-slide-10.webp",
] as const;
export const HERO_SLIDE_INTERVAL_MS = 4000;

export const HERO = {
  title: APP_SLOGAN,
  lead: "Réunissez vos informations de santé, remettez votre carnet au médecin et choisissez qui peut le consulter.",
  primary: { href: "/connexion?mode=register", label: "S’inscrire gratuitement" },
  secondary: { href: "/connexion?mode=register&profil=professionnel", label: "Je suis professionnel" },
  /** Second bouton du héro (à côté de « S’inscrire gratuitement ») : mène au parcours en trois étapes, plus bas dans la page. */
  tour: { href: "/#parcours", label: "Comment ça marche" },
  note: "Organisez vos informations de santé dans votre espace sécurisé.",
  /** Texte qui apparaît par-dessus l'image quand elle occupe tout l'écran. Décoratif : repris par la section « confiance ». */
  reveal: { title: "Aucun accès sans votre choix.", text: "Vous voyez qui demande, depuis quel établissement et pour quel contenu." },
  sceneLabel: "Aperçu illustré de l’espace patient : une demande d’accès à autoriser ou refuser, et un QR code temporaire",
  /** Aperçu du tableau de bord sous le titre : une illustration (données d'exemple), pas une capture de comptes réels. */
  previewLabel: "Aperçu illustré du tableau de bord d’un établissement : médecins actifs, demandes à traiter, rendez-vous à venir. Données d’exemple.",
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

export type Profile = { icon: IconName; label: string; title: string; points: string[]; photo: { src: string; alt: string }; cta: { href: string; text: string; subject?: string; track?: "signup" | "professional_signup" } };
export const PROFILES: Profile[] = [
  { icon: "user", label: "Patients", title: "Votre santé, organisée", points: ["Présentez votre QR : le médecin consulte votre carnet", "Gardez la maîtrise des accès"], photo: { src: "/landing/role-patient.webp", alt: "Un patient consulte son carnet sur son téléphone dans une salle d’attente ; un médecin travaille dans la pièce voisine." }, cta: { href: "/connexion?mode=register", text: "S’inscrire gratuitement", track: "signup" } },
  { icon: "stethoscope", label: "Professionnels", title: "Un accès patient par patient", points: ["Scannez le QR du patient et consultez depuis votre espace", "Établissez vos préconisations, elles rejoignent son carnet"], photo: { src: "/landing/role-professional.webp", alt: "Un médecin en blouse consulte un téléphone dans un couloir d’hôpital." }, cta: { href: "/connexion?mode=register&profil=professionnel", text: "Créer mon profil" } },
  { icon: "building", label: "Établissements", title: "Gérez vos rattachements", points: ["Invitez les professionnels", "Traitez les demandes de rattachement"], photo: { src: "/landing/role-establishment.webp", alt: "Une femme sort d’un hôpital en souriant, son téléphone à la main." }, cta: { href: "#contact", text: "Contacter l’équipe", subject: "establishment" } },
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
  { id: "consent", q: "Un professionnel voit-il mon carnet automatiquement ?", a: "Non. Il doit d’abord être rattaché à un établissement actif, puis vous devez lui donner accès : en lui montrant votre QR code, pour une durée limitée, ou en acceptant sa demande pour aller plus loin." },
  { id: "refuse", q: "Puis-je refuser ou arrêter un accès ?", a: "Oui. Vous pouvez refuser une demande, ou mettre fin à un accès en cours depuis votre espace. Cela n’efface ni les consultations déjà validées, ni le journal des accès (la liste de qui a ouvert quoi, et quand)." },
  { id: "verified", q: "Un professionnel est-il vérifié par Mon E-Carnet ?", a: "Non. Mon E-Carnet ne certifie ni l’identité, ni les diplômes, ni la compétence d’un professionnel. L’établissement confirme seulement que le professionnel fait partie de sa structure." },
  { id: "protection", q: "Comment sont protégées mes informations ?", a: "Le service applique les mesures de protection décrites dans les pages Sécurité et Confidentialité.", link: { href: "/securite", label: "Page Sécurité" } },
  { id: "phone", q: "Puis-je l’utiliser sur mon téléphone ?", a: "Oui. Mon E‑Carnet s’ouvre dans le navigateur d’un téléphone ou d’un ordinateur, et vous pouvez l’installer comme une application si votre navigateur le propose. Sans réseau, vous pouvez relire ce que vous aviez déjà ouvert, mais pas le modifier : pour modifier quoi que ce soit, il faut une connexion." },
];

/** Dernière section : l'invitation à créer son espace, puis le formulaire de contact (une seule section, un seul bouton principal).
 *  `points` résume la valeur en trois lignes, au-dessus du bouton. */
export const FINAL = {
  title: "Ne perdez plus le fil de vos antécédents médicaux.",
  lead: "Centralisez vos informations de santé et gardez une trace de votre parcours médical.",
  points: [
    "Votre carnet réuni au même endroit",
    "Le médecin consulte votre carnet avec votre QR",
    "Ses préconisations rejoignent votre carnet",
  ],
  primary: { href: "/connexion?mode=register", label: "Créer mon carnet" },
  secondary: { href: "/connexion", label: "Déjà un compte ? Se connecter" },
  note: "Utilisez des informations exactes et gardez votre compte personnel.",
} as const;

/** Photo de la carte finale : carrée (1254 × 1254), toujours affichée ; le texte et le bouton se posent par-dessus, sur un dégradé vert. */
export const FINAL_IMAGE = {
  src: "/landing/cta-carnet.webp",
  width: 1254,
  height: 1254,
  alt: "Un homme souriant tend son téléphone vers l’objectif : l’écran affiche l’espace patient de Mon E‑Carnet.",
} as const;

/** Section qui suit le hero : paysage sur ordinateur, portrait sur mobile (même découpage que le hero, 759 px). Photo d'ambiance : alt vide. */
export const PROBLEM_IMAGE = {
  desktopSrc: "/landing/problem-desktop.webp",
  desktopWidth: 1400,
  desktopHeight: 788,
  mobileSrc: "/landing/problem-mobile.webp",
  alt: "",
} as const;

export const CONTACT_COPY = {
  title: "Une question ? Écrivez-nous.",
  lead: "Patient, professionnel ou établissement : on vous répond.",
} as const;

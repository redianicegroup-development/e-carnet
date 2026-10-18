import type { IconName } from "../components/ui/Icon";

/* Contenu de la landing. Règle : chaque phrase décrit ce que le produit fait réellement et reprend les réserves de la
   revue juridique (pas de « à tout moment », pas de « vérifié », pas de promesse de sécurité absolue).
   Les réponses de la FAQ sont recopiées mot pour mot de components/help/helpContent.ts (relues par les juristes) :
   tests/landing.test.mjs échoue si l'une des deux versions change sans l'autre.
   Fichier volontairement sans import d'exécution, pour rester testable avec `node --test`. */

/** Photo du hero. `null` = illustration de l'application (celle du dépôt). Pour une vraie photo : déposer le fichier
    dans public/landing/ (WebP, 1920×1080 minimum, sujet lisible à droite) puis renseigner { src, alt }. */
export const HERO_IMAGE: { src: string; alt: string } | null = null;

export const HERO = {
  eyebrow: "Carnet de santé numérique",
  title: "Votre carnet de santé, sous votre contrôle.",
  lead: "Organisez vos informations, préparez vos consultations et choisissez qui peut consulter votre carnet.",
  primary: { href: "/connexion?mode=register", label: "Créer mon espace patient" },
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
  { icon: "folder", title: "Mon carnet", text: "Vos antécédents, allergies et traitements, chacun marqué « Déclaré par le patient ». Une pré-consultation prépare votre rendez-vous." },
  { icon: "qr", title: "QR code temporaire", text: "Un code sans donnée médicale. Il lance une demande, il n’ouvre pas votre carnet.", figure: { value: "5", unit: "min", label: "de validité pour un QR code" } },
  { icon: "lock", title: "Autorisations", text: "Un contenu précis, une durée limitée, deux prolongations d’une heure au plus. Vous autorisez ou refusez, demande par demande.", figure: { value: "2", unit: "h", label: "pour un accès autorisé" } },
  { icon: "clock", title: "Historique des accès", text: "Retrouvez qui a demandé quoi, quand, et la décision prise. Les consultations validées rejoignent votre carnet." },
];

export type Step = { icon: IconName; title: string; text: string };
export const STEPS: Step[] = [
  { icon: "pencil", title: "Préparez", text: "Notez le motif et vos observations avant le rendez-vous." },
  { icon: "qr", title: "Autorisez", text: "Présentez votre QR : le professionnel envoie une demande, vous choisissez le contenu et la durée, ou vous refusez." },
  { icon: "folder", title: "Retrouvez", text: "Les consultations validées et l’historique des accès rejoignent votre carnet." },
];

export type Profile = { icon: IconName; label: string; title: string; points: string[]; cta: { href: string; text: string; subject?: string } };
export const PROFILES: Profile[] = [
  { icon: "user", label: "Patients", title: "Votre santé, organisée", points: ["Préparez vos consultations", "Gardez la maîtrise des accès"], cta: { href: "/connexion?mode=register", text: "Créer mon carnet" } },
  { icon: "stethoscope", label: "Professionnels", title: "Un accès patient par patient", points: ["Demandez une autorisation", "Consultez selon le périmètre accordé"], cta: { href: "/connexion?mode=register&profil=professionnel", text: "Créer mon profil" } },
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
  { id: "real-data", q: "Puis-je saisir mes vraies données de santé ?", a: "Non. Utilisez des informations exactes dans votre espace personnel. N’ajoutez pas de vrais renseignements médicaux ni d’identifiants de patients." },
  { id: "consent", q: "Un professionnel voit-il mon carnet automatiquement ?", a: "Non. Il doit être rattaché à un établissement actif, puis recevoir votre autorisation pour un contenu précis et une durée limitée." },
  { id: "refuse", q: "Puis-je refuser ou arrêter un accès ?", a: "Oui. Vous pouvez refuser une demande, ou révoquer un accès en cours depuis votre espace. La révocation n’efface pas les consultations déjà validées ni les traces d’audit." },
  { id: "verified", q: "Un professionnel est-il vérifié par Mon E-Carnet ?", a: "Non. Mon E-Carnet ne certifie ni l’identité, ni les diplômes, ni la compétence d’un professionnel. L’établissement confirme le rattachement du professionnel à sa structure." },
  { id: "protection", q: "Comment sont protégées mes informations ?", a: "Le service applique les mesures techniques décrites dans les pages Sécurité et Confidentialité.", link: { href: "/securite", label: "Page Sécurité" } },
  { id: "phone", q: "Puis-je l’utiliser sur mon téléphone ?", a: "Oui. Mon E‑Carnet s’ouvre dans le navigateur d’un téléphone ou d’un ordinateur, et peut s’installer comme une application lorsque votre navigateur le permet. Hors connexion, aucune donnée médicale n’est conservée." },
];

/** Dernière section : l'invitation à créer son espace, puis le formulaire de contact (une seule section, un seul bouton principal). */
export const FINAL = {
  title: "Commencez avec votre carnet.",
  lead: "Créez votre espace patient ou professionnel depuis une seule page. Utilisez des informations exactes et gardez votre compte personnel.",
  primary: { href: "/connexion?mode=register", label: "Créer mon espace patient" },
  secondary: { href: "/connexion", label: "Se connecter" },
} as const;

export const CONTACT_COPY = {
  title: "Une question ? Écrivons-nous.",
  lead: "Patient, professionnel ou établissement : dites-nous ce dont vous avez besoin. Nous vous répondons par le moyen que vous indiquez.",
  points: [
    { icon: "building" as IconName, text: "Établissement : choisissez l’objet « Ouvrir un espace établissement »." },
    { icon: "mail" as IconName, text: "Nous utilisons votre e-mail ou votre numéro pour vous répondre." },
  ],
} as const;

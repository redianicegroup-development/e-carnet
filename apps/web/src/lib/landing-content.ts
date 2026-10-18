import type { IconName } from "../components/ui/Icon";

/* Contenu de la landing. Règle : chaque phrase décrit ce que le produit fait réellement et reprend les réserves de la
   revue juridique (pas de « à tout moment », pas de « vérifié », pas de promesse de sécurité absolue).
   Les réponses marquées origin: "help" sont recopiées mot pour mot de components/help/helpContent.ts (relues par les
   juristes) : tests/landing.test.mjs échoue si l'une des deux versions change sans l'autre.
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

export type Fact = { value: string; unit?: string; label: string };
export const FACTS: Fact[] = [
  { value: "5", unit: "min", label: "de validité pour un QR code" },
  { value: "2", unit: "h", label: "pour un accès autorisé" },
  { value: "2 × 1", unit: "h", label: "de prolongation au plus" },
  { value: "3", unit: "espaces", label: "patient, professionnel, établissement" },
];

export type Feature = { icon: IconName; title: string; text: string };
export const FEATURES: Feature[] = [
  { icon: "folder", title: "Mon carnet", text: "Vos antécédents, allergies et traitements, chacun marqué « Déclaré par le patient »." },
  { icon: "pencil", title: "Pré-consultation", text: "Notez le motif et vos observations avant le rendez-vous, pour l’établissement de votre choix." },
  { icon: "qr", title: "QR code temporaire", text: "Un code sans donnée médicale, valable 5 minutes. Il lance une demande, il n’ouvre pas votre carnet." },
  { icon: "lock", title: "Autorisations", text: "Un contenu précis, une durée limitée. Vous autorisez ou refusez, demande par demande." },
  { icon: "clock", title: "Historique des accès", text: "Retrouvez qui a demandé quoi, quand, et la décision prise." },
  { icon: "stethoscope", title: "Consultations validées", text: "Celles saisies par un professionnel rejoignent votre carnet. Les corrections sont historisées." },
];

export type Step = { icon: IconName; title: string; text: string };
export const STEPS: Step[] = [
  { icon: "pencil", title: "Préparez", text: "Notez les informations utiles avant votre rendez-vous." },
  { icon: "qr", title: "Présentez votre QR", text: "Le professionnel envoie une demande d’accès." },
  { icon: "check", title: "Choisissez", text: "Vérifiez le périmètre et autorisez ou refusez." },
  { icon: "stethoscope", title: "Consultez", text: "Le professionnel voit uniquement les informations autorisées." },
  { icon: "folder", title: "Retrouvez", text: "Gardez vos informations et leur historique au même endroit." },
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
  /** « help » : texte identique à celui du centre d'aide. « landing » : texte historique de la landing. « composed » : assemblé à partir des parcours du centre d'aide. */
  origin: "help" | "landing" | "composed";
  /** `subject` : objet présélectionné dans le formulaire de contact quand le lien pointe vers #contact. */
  link?: { href: string; label: string; subject?: string };
};
export type FaqGroup = { id: string; title: string; items: FaqItem[] };

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "start",
    title: "Premiers pas",
    items: [
      { id: "purpose", origin: "landing", q: "À quoi sert Mon E-Carnet ?", a: "Mon E‑Carnet aide à organiser des informations de santé, préparer les consultations et gérer les demandes d’accès au carnet. Le service ne remplace pas un avis médical ni les services d’urgence." },
      { id: "account", origin: "landing", q: "Comment créer un compte patient ou professionnel ?", a: "Ouvrez Connexion ou inscription, choisissez Nouveau compte, puis le rôle souhaité. Les moyens de connexion disponibles sont présentés dans le formulaire.", link: { href: "/connexion?mode=register", label: "Créer mon compte" } },
      { id: "phone", origin: "composed", q: "Puis-je l’utiliser sur mon téléphone ?", a: "Oui. Mon E‑Carnet s’ouvre dans le navigateur d’un téléphone ou d’un ordinateur, et peut s’installer comme une application lorsque votre navigateur le permet. Hors connexion, aucune donnée médicale n’est conservée." },
    ],
  },
  {
    id: "access",
    title: "Accès et confidentialité",
    items: [
      { id: "consent", origin: "landing", q: "Un professionnel peut-il consulter mon carnet sans mon accord ?", a: "Non. Le professionnel doit être rattaché à un établissement actif et le patient doit autoriser une demande pour un contenu et une durée précis. Le QR code lance une demande, il n’ouvre pas le carnet." },
      { id: "qr", origin: "help", q: "À quoi sert le QR code ?", a: "Il permet à un professionnel de lancer une demande d’accès à votre carnet. Il ne contient aucune donnée médicale, n’est valable que 5 minutes et ne sert qu’une fois. Le scanner n’ouvre pas votre carnet : c’est vous qui décidez ensuite." },
      { id: "duration", origin: "help", q: "Combien de temps dure une autorisation ?", a: "Deux heures, avec au plus deux prolongations d’une heure. Elle prend fin à son expiration ou si vous la révoquez depuis votre espace." },
      { id: "scope", origin: "help", q: "Que voit le professionnel ?", a: "Seulement le contenu que vous avez autorisé : votre pré-consultation et vos déclarations, et vos consultations passées si vous les sélectionnez. Les documents restent privés et ne sont pas inclus dans le périmètre QR professionnel." },
      { id: "refuse", origin: "help", q: "Puis-je refuser ou arrêter un accès ?", a: "Oui. Vous pouvez refuser une demande, ou révoquer un accès en cours depuis votre espace. La révocation n’efface pas les consultations déjà validées ni les traces d’audit." },
    ],
  },
  {
    id: "pros",
    title: "Professionnels et établissements",
    items: [
      { id: "verified", origin: "help", q: "Un professionnel est-il vérifié par Mon E-Carnet ?", a: "Non. Mon E-Carnet ne certifie ni l’identité, ni les diplômes, ni la compétence d’un professionnel. L’établissement confirme le rattachement du professionnel à sa structure." },
      { id: "join", origin: "composed", q: "Comment un médecin rejoint-il un établissement ?", a: "L’administrateur de l’établissement lui remet un code à usage unique, valable 48 h. Le médecin le saisit dans son espace : sa demande est envoyée à l’établissement. Tant que le rattachement n’est pas confirmé, il ne peut demander l’accès à aucun carnet." },
      { id: "all-records", origin: "help", q: "Un médecin peut-il lire tous les carnets de l’établissement ?", a: "Non. Un rattachement ne donne accès à aucun dossier : chaque patient autorise ou refuse, demande par demande." },
      { id: "admin-records", origin: "help", q: "L’administrateur d’un établissement voit-il les dossiers ?", a: "Non. Il gère l’établissement et les rattachements, mais ne consulte pas les dossiers depuis son espace." },
      { id: "open-establishment", origin: "composed", q: "Comment ouvrir l’espace de mon établissement ?", a: "L’ouverture est gérée par l’équipe Mon E‑Carnet. Écrivez-nous avec les informations de l’établissement. Nous créons votre accès administrateur et vous envoyons une invitation personnelle valable 48 h.", link: { href: "#contact", label: "Nous écrire", subject: "establishment" } },
    ],
  },
  {
    id: "data",
    title: "Pilote et données",
    items: [
      { id: "real-data", origin: "landing", q: "Puis-je saisir mes vraies données de santé ?", a: "Non. Utilisez des informations exactes dans votre espace personnel. N’ajoutez pas de vrais renseignements médicaux ni d’identifiants de patients." },
      { id: "protection", origin: "help", q: "Comment sont protégées mes informations ?", a: "Le service applique les mesures techniques décrites dans les pages Sécurité et Confidentialité.", link: { href: "/securite", label: "Page Sécurité" } },
    ],
  },
];

export const FAQ_ITEMS: FaqItem[] = FAQ_GROUPS.flatMap((group) => group.items);

export const CONTACT_COPY = {
  eyebrow: "Contact",
  title: "Une question ? Écrivons-nous.",
  lead: "Patient, professionnel ou établissement : dites-nous ce dont vous avez besoin. Nous vous répondons par le moyen que vous indiquez.",
  points: [
    { icon: "building" as IconName, text: "Établissement : choisissez l’objet « Ouvrir un espace établissement »." },
    { icon: "shield" as IconName, text: "Vos informations restent sous votre contrôle." },
    { icon: "mail" as IconName, text: "Nous utilisons votre e-mail ou votre numéro pour vous répondre." },
  ],
} as const;

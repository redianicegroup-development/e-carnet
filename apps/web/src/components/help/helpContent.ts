import type { IconName } from "../ui/Icon";

/**
 * Contenu de l'aide. Chaque phrase décrit ce que le produit fait réellement (parcours patient, professionnel,
 * établissement) et reprend les réserves de la revue juridique : pas de « à tout moment », pas de « vérifié »,
 * pas de promesse de sécurité absolue. À mettre à jour avec le produit.
 */
export type HelpProfileId = "patient" | "professional" | "establishment";
export type HelpStep = { icon: IconName; title: string; text: string };
export type HelpProfile = { id: HelpProfileId; label: string; icon: IconName; summary: string; steps: HelpStep[] };

export const ESTABLISHMENT_STEPS: HelpStep[] = [
  { icon: "mail", title: "Votre établissement est ouvert par notre équipe", text: "Vous nous écrivez avec les informations de l’établissement. Nous créons votre accès administrateur et vous envoyons une invitation personnelle valable 48 h." },
  { icon: "lock", title: "Vous activez votre compte", text: "Depuis l’invitation, vous choisissez votre mot de passe. L’accès est nominatif : il n’existe pas de compte partagé." },
  { icon: "link", title: "Vous remettez un code à chaque médecin", text: "Un code à usage unique, valable 48 h. Le médecin le saisit dans son espace et vous recevez sa demande." },
  { icon: "check", title: "Vous confirmez le rattachement", text: "Le médecin devient actif sous votre établissement. Il ne voit un carnet que si le patient l’y autorise." },
];

export const HELP_PROFILES: HelpProfile[] = [
  {
    id: "patient",
    label: "Je suis patient",
    icon: "heart",
    summary: "Tenir mon carnet et décider qui peut le consulter.",
    steps: [
      { icon: "user", title: "Créez votre compte", text: "Avec votre adresse e-mail et un mot de passe d’au moins 12 caractères, ou avec Google, Facebook ou Apple. Choisissez ensuite le rôle « patient »." },
      { icon: "idcard", title: "Complétez votre profil", text: "Votre nom, puis les informations que vous souhaitez enregistrer, comme votre téléphone, votre date de naissance ou votre couverture santé. Les champs obligatoires sont indiqués dans les formulaires." },
      { icon: "heart", title: "Remplissez votre carnet", text: "Ajoutez vos antécédents, vos allergies et vos traitements. Ces informations restent marquées « Déclaré par le patient »." },
      { icon: "document", title: "Préparez une consultation", text: "Notez le motif et vos observations dans une pré-consultation, seul ou avec un infirmier qui remplit sur votre téléphone. Le médecin la lit grâce à votre QR, avec votre accord, puis la clôture en signant la consultation." },
      { icon: "qr", title: "Autorisez, ou refusez", text: "Présentez votre QR code à un professionnel : il est valable 5 minutes. Le professionnel fait alors une demande. Vous voyez qui demande, depuis quel établissement et pour quel contenu, puis vous autorisez ou refusez. Aucun accès n’est ouvert avant votre choix." },
      { icon: "clock", title: "Suivez et arrêtez un accès", text: "Un accès autorisé dure 2 heures, avec au plus deux prolongations d’une heure. Vous pouvez le révoquer depuis votre espace et retrouver la liste de vos accès, en cours ou passés." },
    ],
  },
  {
    id: "professional",
    label: "Je suis professionnel de santé",
    icon: "stethoscope",
    summary: "Rejoindre un établissement et consulter un carnet avec l’accord du patient.",
    steps: [
      { icon: "user", title: "Créez votre compte", text: "Comme un patient : e-mail et mot de passe, ou un fournisseur de connexion. Choisissez le rôle « professionnel »." },
      { icon: "stethoscope", title: "Indiquez votre fonction", text: "Votre titre et votre spécialité, à titre déclaratif. L’application ne vous demande ici aucun numéro professionnel et ne certifie ni diplôme ni compétence." },
      { icon: "link", title: "Rejoignez votre établissement", text: "L’administrateur de votre établissement vous remet un code à usage unique, valable 48 h. Saisissez-le dans votre espace : votre demande lui est envoyée." },
      { icon: "building", title: "Attendez la confirmation", text: "Tant que l’établissement n’a pas confirmé votre rattachement, vous ne pouvez pas demander d’accès à un carnet." },
      { icon: "qr", title: "Demandez un accès", text: "Faites une demande pour le patient qui vous présente son QR code. Vous ne voyez aucune information tant qu’il n’a pas autorisé." },
      { icon: "document", title: "Consultez, puis enregistrez", text: "Dans le contenu autorisé et pendant la durée de l’autorisation, lisez les informations utiles, puis enregistrez et validez votre consultation. Les corrections sont historisées." },
    ],
  },
  {
    id: "establishment",
    label: "Je gère un établissement",
    icon: "building",
    summary: "Ouvrir l’établissement et rattacher mes médecins.",
    steps: ESTABLISHMENT_STEPS,
  },
];

export type HelpFaqItem = { q: string; a: string; profiles?: HelpProfileId[] };
export type HelpFaqGroup = { id: string; title: string; items: HelpFaqItem[] };

export const HELP_FAQ: HelpFaqGroup[] = [
  {
    id: "premiers-pas",
    title: "Premiers pas",
    items: [
      { q: "À quoi sert Mon E-Carnet ?", a: "Mon E‑Carnet aide à organiser des informations de santé, préparer les consultations et gérer les demandes d’accès au carnet. Le service ne remplace pas un avis médical ni les services d’urgence.", profiles: ["patient", "professional", "establishment"] },
      { q: "Comment créer un compte patient ou professionnel ?", a: "Ouvrez Connexion ou inscription, choisissez Nouveau compte, puis le rôle souhaité. Les moyens de connexion disponibles sont présentés dans le formulaire.", profiles: ["patient", "professional"] },
      { q: "Puis-je l’utiliser sur mon téléphone ?", a: "Oui. Mon E‑Carnet s’ouvre dans le navigateur d’un téléphone ou d’un ordinateur, et peut s’installer comme une application lorsque votre navigateur le permet. Hors connexion, aucune donnée médicale n’est conservée.", profiles: ["patient", "professional", "establishment"] },
    ],
  },
  {
    id: "acces",
    title: "Accès et autorisations",
    items: [
      { q: "Un professionnel voit-il mon carnet automatiquement ?", a: "Non. Il doit être rattaché à un établissement actif, puis recevoir votre autorisation pour un contenu précis et une durée limitée.", profiles: ["patient", "professional", "establishment"] },
      { q: "À quoi sert le QR code ?", a: "Il permet à un professionnel de lancer une demande d’accès à votre carnet. Il ne contient aucune donnée médicale, n’est valable que 5 minutes et ne sert qu’une fois. Le scanner n’ouvre pas votre carnet : c’est vous qui décidez ensuite.", profiles: ["patient", "professional"] },
      { q: "Combien de temps dure une autorisation ?", a: "Deux heures, avec au plus deux prolongations d’une heure. Elle prend fin à son expiration ou si vous la révoquez depuis votre espace.", profiles: ["patient", "professional"] },
      { q: "Que voit le professionnel ?", a: "Seulement le contenu que vous avez autorisé : votre pré-consultation et vos déclarations, et vos consultations passées si vous les sélectionnez. Les documents restent privés et ne sont pas inclus dans le périmètre QR professionnel.", profiles: ["patient", "professional"] },
      { q: "Puis-je refuser ou arrêter un accès ?", a: "Oui. Vous pouvez refuser une demande, ou révoquer un accès en cours depuis votre espace. La révocation n’efface pas les consultations déjà validées ni les traces d’audit.", profiles: ["patient"] },
      { q: "Qui a écrit cette information ?", a: "Chaque information indique son origine : « Déclaré par le patient » (vous l’avez saisie), « Saisi dans le compte patient » (pré-consultation) ou « Consultation médicale validée » (saisie par un professionnel). Les corrections de consultations sont historisées.", profiles: ["patient", "professional"] },
    ],
  },
  {
    id: "comptes",
    title: "Comptes et rôles",
    items: [
      { q: "Un professionnel est-il vérifié par Mon E-Carnet ?", a: "Non. Mon E-Carnet ne certifie ni l’identité, ni les diplômes, ni la compétence d’un professionnel. L’établissement confirme le rattachement du professionnel à sa structure.", profiles: ["patient", "professional", "establishment"] },
      { q: "L’administrateur d’un établissement voit-il les dossiers ?", a: "Non. Il gère l’établissement et les rattachements, mais ne consulte pas les dossiers depuis son espace.", profiles: ["patient", "establishment"] },
      { q: "Comment ouvrir l’espace de mon établissement ?", a: "L’ouverture est gérée par l’équipe Mon E‑Carnet. Écrivez-nous avec les informations de l’établissement, depuis le formulaire de contact de l’accueil (objet « Ouvrir un espace établissement »). Nous créons votre accès administrateur et vous envoyons une invitation personnelle valable 48 h. Les justificatifs sont envoyés par e-mail, en dehors de l’application.", profiles: ["establishment"] },
      { q: "Comment un médecin rejoint-il un établissement ?", a: "L’administrateur de l’établissement lui remet un code à usage unique, valable 48 h. Le médecin le saisit dans son espace : sa demande est envoyée à l’établissement. Tant que le rattachement n’est pas confirmé, il ne peut demander l’accès à aucun carnet.", profiles: ["professional", "establishment"] },
      { q: "Que se passe-t-il si l’invitation ou le code expire ?", a: "L’invitation d’un administrateur et le code d’un médecin sont valables 48 heures et ne s’utilisent qu’une fois. Demandez-en un nouveau : l’ancien ne fonctionnera plus.", profiles: ["professional", "establishment"] },
      { q: "Un médecin peut-il lire tous les carnets de l’établissement ?", a: "Non. Un rattachement ne donne accès à aucun dossier : chaque patient autorise ou refuse, demande par demande.", profiles: ["establishment", "professional"] },
      { q: "Un infirmier possède-t-il un compte ?", a: "Non. L’aide éventuelle se fait dans le compte du patient, avec son accord. Une aide éventuelle se fait dans le compte du patient.", profiles: ["patient", "establishment"] },
      { q: "Un proche peut-il m’aider à remplir mon carnet ?", a: "La pré-consultation permet d’indiquer la personne qui vous a aidé. Cette personne n’a ni compte, ni droit d’accès propre.", profiles: ["patient"] },
      { q: "Puis-je me connecter de plusieurs façons ?", a: "Oui. Vous pouvez lier Google, Facebook ou Apple à votre compte depuis les paramètres. Deux comptes ne sont jamais fusionnés sur la seule base d’une adresse e-mail.", profiles: ["patient", "professional"] },
    ],
  },
  {
    id: "preferences",
    title: "Compte et préférences",
    items: [
      { q: "Comment modifier mon nom ou ma photo ?", a: "Dans Paramètres → Informations personnelles, modifiez votre nom ou choisissez un nouvel avatar.", profiles: ["patient", "professional", "establishment"] },
      { q: "Comment changer l’apparence de l’application ?", a: "Le thème choisi dans les paramètres du compte (couleurs, police, taille du texte) est enregistré avec votre compte et suit votre connexion sur vos appareils.", profiles: ["patient", "professional", "establishment"] },
      { q: "Où gérer mes méthodes de connexion et me déconnecter ?", a: "Les fournisseurs de connexion se gèrent dans Sécurité et connexion, dans les paramètres. Le bouton Déconnexion est disponible dans chaque espace.", profiles: ["patient", "professional", "establishment"] },
    ],
  },
  {
    id: "donnees",
    title: "Données et sécurité",
    items: [
      { q: "Puis-je saisir mes vraies données de santé ?", a: "Oui, utilisez des informations exactes dans votre espace personnel.", profiles: ["patient", "professional", "establishment"] },
      { q: "Les données sont-elles disponibles hors connexion ?", a: "Les pages publiques peuvent offrir un repli limité. Aucune donnée médicale ni réponse de l’API n’est conservée hors connexion.", profiles: ["patient", "professional", "establishment"] },
      { q: "Comment sont protégées mes informations ?", a: "Le service applique les mesures techniques décrites dans les pages Sécurité et Confidentialité.", profiles: ["patient", "professional", "establishment"] },
      { q: "Quelles données de fréquentation sont collectées ?", a: "Avec votre accord, un cookie aléatoire aide à compter les catégories de pages, certains clics publics et des événements de connexion. Le suivi ne conserve ni URL complète, ni adresse IP, ni texte de bouton.", profiles: ["patient", "professional", "establishment"] },
    ],
  },
  {
    id: "retours",
    title: "Questions et retours",
    items: [
      { q: "Où poser une question ou faire une suggestion ?", a: "Pour une question qui appelle une réponse, utilisez le formulaire de contact de l’accueil. Pour une suggestion ou un problème, envoyez un retour depuis le bouton « Donner votre avis ».", profiles: ["patient", "professional", "establishment"] },
      { q: "Quand une enquête peut-elle apparaître ?", a: "Une enquête courte peut apparaître après cinq pages publiques. Une seconde enquête est proposée une fois, après une première action réussie dans un espace connecté.", profiles: ["patient", "professional", "establishment"] },
      { q: "Que deviennent mes retours ?", a: "Les retours et réponses d’enquête sont pseudonymes ou anonymes côté administration. N’y indiquez aucun nom, identifiant ou renseignement médical.", profiles: ["patient", "professional", "establishment"] },
    ],
  },
];

export const HELP_TROUBLESHOOTING: { problem: string; solution: string; profiles?: HelpProfileId[] }[] = [
  { problem: "Je n’arrive pas à me connecter", solution: "Vérifiez votre adresse e-mail et votre mot de passe (12 caractères au moins). Après plusieurs essais, le service limite les tentatives : patientez un peu avant de recommencer. Si vous avez lié Google, Facebook ou Apple, essayez cette méthode." },
  { problem: "Ma session s’est fermée", solution: "Elle expire après environ 8 heures sans activité. Reconnectez-vous pour continuer." },
  { problem: "Mon QR code ne fonctionne plus", solution: "Il n’est valable que 5 minutes et ne sert qu’une fois. Affichez-en un nouveau depuis l’onglet « Accès ».", profiles: ["patient", "professional"] },
  { problem: "Une demande d’accès attend toujours", solution: "Elle attend votre décision dans l’onglet « Accès ». Vous pouvez l’autoriser ou la refuser.", profiles: ["patient"] },
  { problem: "L’accès à un carnet s’est arrêté", solution: "L’autorisation dure 2 heures, avec deux prolongations possibles d’une heure. Ensuite, faites une nouvelle demande : le patient décide à nouveau.", profiles: ["professional"] },
  { problem: "Mon rattachement n’est pas confirmé", solution: "Il faut attendre la confirmation de l’administrateur de l’établissement. Si votre code a plus de 48 heures, demandez-en un nouveau.", profiles: ["professional", "establishment"] },
];

export const HELP_GLOSSARY: { term: string; definition: string }[] = [
  { term: "Carnet", definition: "Votre espace personnel : profil, déclarations de santé, pré-consultations, consultations et accès." },
  { term: "Déclaration", definition: "Un antécédent, une allergie ou un traitement que vous avez saisi vous-même." },
  { term: "Pré-consultation", definition: "Une préparation de consultation : motif et observations, destinés à un établissement." },
  { term: "Autorisation d’accès", definition: "Votre décision d’autoriser un professionnel à lire un contenu précis, pendant une durée limitée." },
  { term: "Périmètre", definition: "Le contenu couvert par une autorisation : par exemple pré-consultation et déclarations." },
  { term: "Rattachement", definition: "Le lien confirmé entre un professionnel et un établissement. Il ne donne accès à aucun carnet." },
  { term: "Consultation validée", definition: "Une consultation saisie et validée par un professionnel autorisé. Elle apparaît dans le carnet du patient." },
  { term: "Journal d’audit", definition: "La liste des actions sensibles enregistrées (qui, quoi, quand), sans le contenu médical." },
];

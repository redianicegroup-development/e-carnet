import type { IconName } from "../ui/Icon";
import { DATA_POLICY } from "../../lib/data-policy";

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
      { icon: "users", title: "Proches et enfants", text: "Un proche de confiance lit votre fiche d’urgence, un profil enfant a son propre dossier. Une page dédiée explique les deux pas à pas." },
      { icon: "building", title: "Validez un adressage", text: "Lorsqu’un professionnel propose de partager certains éléments avec un autre établissement, vous choisissez précisément les éléments et la durée. L’établissement destinataire ne voit rien avant votre décision." },
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
      { icon: "building", title: "Consultez un historique partagé", text: "Avec la portée autorisée par le patient, vous pouvez lire temporairement des soins validés provenant des structures sources sélectionnées. L’accès est en lecture seule, audité et ne crée pas de copie dans votre établissement." },
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

export type HelpFaqItem = { q: string; a: string; profiles?: HelpProfileId[]; href?: string; linkLabel?: string };
export type HelpFaqGroup = { id: string; title: string; items: HelpFaqItem[] };

export const HELP_FAQ: HelpFaqGroup[] = [
  {
    id: "premiers-pas",
    title: "Premiers pas",
    items: [
      { q: "À quoi sert Mon E-Carnet ?", a: "Mon E‑Carnet aide à organiser des informations de santé, préparer les consultations et gérer les demandes d’accès au carnet. Le service ne remplace pas un avis médical ni les services d’urgence.", profiles: ["patient", "professional", "establishment"] },
      { q: "Comment créer un compte patient ou professionnel ?", a: "Ouvrez Connexion ou inscription, choisissez Nouveau compte, puis le rôle souhaité. Les moyens de connexion disponibles sont présentés dans le formulaire.", profiles: ["patient", "professional"] },
      { q: "Puis-je l’utiliser sur mon téléphone ?", a: "Oui. Mon E‑Carnet s’ouvre dans le navigateur d’un téléphone ou d’un ordinateur, et peut s’installer comme une application lorsque votre navigateur le permet. Sans réseau, vous pouvez relire en lecture seule ce que vous avez déjà consulté ; toute modification demande la connexion.", profiles: ["patient", "professional", "establishment"] },
      { q: "Quelles informations puis-je enregistrer dans mon carnet ?", a: "Vos antécédents, allergies et traitements (déclarations), des documents (PDF, PNG, JPEG ou WebP, 10 Mo au plus par fichier), vos vaccinations, des mesures de santé, des rappels de médicaments et vos rendez-vous. Les consultations sont saisies par un professionnel autorisé. Chaque information indique son origine." },
      { q: "Où sont conservés mes documents et ma photo ?", a: "Les fichiers sont conservés chez un prestataire d’hébergement de fichiers, Cloudinary, lorsqu’il est configuré. Les documents médicaux y sont dans un espace privé et ne sont transmis qu’aux personnes autorisées ; la photo de profil, elle, est affichée par une adresse web accessible sans connexion. Le détail figure dans la politique de confidentialité." },
      { q: "Mes vaccinations sont-elles confirmées ?", a: "Une vaccination est « Déclarée » lorsque vous l’avez saisie, « Documentée » lorsqu’un document y est joint, et « Confirmée par un professionnel » seulement lorsqu’un professionnel l’a confirmée." },
      { q: "Comment fonctionnent les rendez-vous, les rappels et les notifications ?", a: "Les rendez-vous apparaissent dans l’Agenda avec leur motif, leur horaire et leur statut ; un autre horaire peut être proposé. Un rappel de médicament indique le nom, le dosage, les horaires et les jours choisis, avec un suivi du stock. Les notifications s’affichent dans l’application ; elles arrivent aussi sur votre appareil si vous les activez dans les paramètres et si l’envoi est configuré." },
      { q: "Qu’est-ce qu’un plan de suivi ?", a: "Un professionnel autorisé peut proposer un plan de suivi avec un objectif, des consignes et des mesures à suivre (fréquence, cible). Vous le retrouvez dans votre espace patient, avec le professionnel et l’établissement à l’origine du plan." },
    ],
  },
  {
    id: "acces",
    title: "Accès et autorisations",
    items: [
      { q: "Un professionnel voit-il mon carnet automatiquement ?", a: "Non. Il doit être rattaché à un établissement actif, puis recevoir votre autorisation pour un contenu précis et une durée limitée.", profiles: ["patient", "professional", "establishment"] },
      { q: "À quoi sert le QR code ?", a: "Il permet à un professionnel d’ouvrir l’accès à votre carnet. Il ne contient aucune donnée médicale, n’est valable que 5 minutes et ne sert qu’une fois. Quand le professionnel le scanne, il consulte votre pré-consultation, vos déclarations et vos documents (lecture seule) pendant 2 heures, sans autre validation : montrer votre QR est votre accord. Un seul professionnel peut être connecté à la fois, et vous pouvez mettre fin à son accès depuis l’historique.", profiles: ["patient", "professional"] },
      { q: "Combien de temps dure une autorisation ?", a: "Deux heures, avec au plus deux prolongations d’une heure. Elle prend fin à son expiration ou si vous la révoquez depuis votre espace.", profiles: ["patient", "professional"] },
      { q: "Que voit le professionnel ?", a: "Seulement ce que vous avez autorisé : votre pré-consultation, vos déclarations et vos documents en lecture seule (demandés avec le QR), et vos consultations passées si vous les sélectionnez. Rien n’est visible avant votre accord.", profiles: ["patient", "professional"] },
      { q: "Puis-je refuser ou arrêter un accès ?", a: "Oui. Vous pouvez refuser une demande, ou révoquer un accès en cours depuis votre espace. La révocation n’efface pas les consultations déjà validées ni les traces d’audit.", profiles: ["patient"] },
      { q: "Qui a écrit cette information ?", a: "Chaque information indique son origine : « Déclaré par le patient » (vous l’avez saisie), « Saisi dans le compte patient » (pré-consultation) ou « Consultation médicale validée » (saisie par un professionnel). Les corrections de consultations sont historisées.", profiles: ["patient", "professional"] },
    ],
  },
  {
    id: "comptes",
    title: "Comptes et rôles",
    items: [
      { q: "Un professionnel est-il vérifié par Mon E-Carnet ?", a: "Non. Mon E-Carnet ne certifie ni l’identité, ni les diplômes, ni la compétence d’un professionnel. L’établissement confirme le rattachement du professionnel à sa structure.", profiles: ["patient", "professional", "establishment"] },
      { q: "Quels dossiers l’administrateur d’un établissement peut-il consulter ?", a: "Dans la configuration de référence, l’accès clinique de l’administrateur est désactivé par défaut : il ne peut pas ouvrir le contenu d’un dossier par cette fonction. Le code prévoit un mécanisme temporaire avec motif, audit et notification, mais aucun écran utilisateur ne l’expose et il ne doit pas être activé avant la décision juridique applicable. La liste de l’établissement ne contient pas le contenu clinique.", profiles: ["patient", "establishment", "professional"] },
      { q: "Comment ouvrir l’espace de mon établissement ?", a: "L’ouverture est gérée par l’équipe Mon E‑Carnet. Écrivez-nous avec les informations de l’établissement, depuis le formulaire de contact de l’accueil (objet « Ouvrir un espace établissement »). Nous créons votre accès administrateur et vous envoyons une invitation personnelle valable 48 h. Les justificatifs sont envoyés par e-mail, en dehors de l’application.", profiles: ["establishment"] },
      { q: "Comment un médecin rejoint-il un établissement ?", a: "L’administrateur de l’établissement lui remet un code à usage unique, valable 48 h. Le médecin le saisit dans son espace : sa demande est envoyée à l’établissement. Tant que le rattachement n’est pas confirmé, il ne peut demander l’accès à aucun carnet.", profiles: ["professional", "establishment"] },
      { q: "Que se passe-t-il si l’invitation ou le code expire ?", a: "L’invitation d’un administrateur et le code d’un médecin sont valables 48 heures et ne s’utilisent qu’une fois. Demandez-en un nouveau : l’ancien ne fonctionnera plus.", profiles: ["professional", "establishment"] },
      { q: "Un médecin peut-il lire tous les carnets de l’établissement ?", a: "Non. Un rattachement ne donne accès à aucun dossier : chaque patient autorise ou refuse, demande par demande.", profiles: ["establishment", "professional"] },
      { q: "Proche de confiance ou profil enfant : comment ça marche ?", a: "Le proche de confiance est un adulte qui lit votre fiche d’urgence, en lecture seule, avec un mot de rattachement temporaire. Le profil enfant est un dossier séparé pour un mineur sans compte, ouvert par son représentant légal. La page dédiée explique les deux pas à pas.", profiles: ["patient"], href: "/proches-et-enfants", linkLabel: "Lire la page Proches et enfants" },
      { q: "Qu’est-ce qu’un adressage vers un autre établissement ?", a: "Un professionnel peut proposer un partage ciblé vers un établissement destinataire. Le patient reçoit la demande, choisit les éléments et la durée, puis peut refuser ou retirer l’accès. L’établissement destinataire ne peut pas rechercher librement des patients.", profiles: ["patient", "professional", "establishment"] },
      { q: "Un infirmier possède-t-il un compte ?", a: "Non. L’infirmier n’a pas de compte propre. Avec l’accord du patient, il peut l’aider à saisir la pré-consultation depuis l’espace du patient.", profiles: ["patient", "establishment"] },
      { q: "Un proche peut-il m’aider à remplir mon carnet ?", a: "La pré-consultation permet d’indiquer la personne qui vous a aidé. Cette personne n’a ni compte, ni droit d’accès propre.", profiles: ["patient"] },
      { q: "Puis-je me connecter de plusieurs façons ?", a: "Oui. Vous pouvez lier Google, Facebook ou Apple à votre compte depuis les paramètres. Deux comptes ne sont jamais fusionnés sur la seule base d’une adresse e-mail.", profiles: ["patient", "professional"] },
    ],
  },
  {
    id: "preferences",
    title: "Compte et préférences",
    items: [
      { q: "Comment revoir la visite guidée ?", a: "Ouvrez le menu de votre compte (en bas de la barre latérale sur ordinateur, en haut à droite sur téléphone) puis choisissez « Revoir la visite guidée ». Elle se lance aussi toute seule à la première connexion de chaque espace, une fois votre choix sur les cookies fait. Si vous effacez les données du site dans votre navigateur, elle reprend à la connexion suivante.", profiles: ["patient", "professional", "establishment"] },
      { q: "Comment modifier mon nom ou ma photo ?", a: "Dans Paramètres → Informations personnelles, modifiez votre nom ou choisissez un nouvel avatar.", profiles: ["patient", "professional", "establishment"] },
      { q: "Comment changer l’apparence de l’application ?", a: "Le thème choisi dans les paramètres du compte (couleurs, police, taille du texte) est enregistré avec votre compte et suit votre connexion sur vos appareils.", profiles: ["patient", "professional", "establishment"] },
      { q: "Où gérer mes méthodes de connexion et me déconnecter ?", a: "Les fournisseurs de connexion se gèrent dans Sécurité et connexion, dans les paramètres. Le bouton Déconnexion est disponible dans chaque espace.", profiles: ["patient", "professional", "establishment"] },
      { q: "Comment exporter mon carnet ?", a: "Dans votre carnet, rubrique « Exporter mon carnet » : choisissez une période (ou laissez les dates vides pour tout le carnet), puis un fichier Excel ou PDF." },
      { q: "Comment suspendre ou supprimer mon compte ?", a: "Dans les paramètres du compte, vous pouvez demander une suspension temporaire, traitée par l’équipe, ou la suppression. Après votre confirmation, la suppression coupe immédiatement l’accès, anonymise votre identité et supprime vos déclarations, documents, vaccinations, mesures, rappels, plans de suivi, rendez-vous et notifications. Les consultations validées et les traces d’audit peuvent être conservées sous forme protégée." },
      { q: "J’ai oublié mon mot de passe : que faire ?", a: "Utilisez la récupération de compte depuis la page de connexion. Elle repose sur la question de récupération que vous avez choisie ; après plusieurs échecs, la récupération est bloquée pendant un temps." },
      { q: "Comment activer ou désactiver les notifications sur mon appareil ?", a: "Dans les paramètres de votre espace patient, activez ou désactivez les notifications sur cet appareil. L’abonnement est aussi retiré à la déconnexion. Elles ne sont disponibles que si l’envoi est configuré dans l’environnement." },
    ],
  },
  {
    id: "donnees",
    title: "Données et sécurité",
    items: [
      { q: DATA_POLICY.faq.q, a: DATA_POLICY.faq.a, profiles: ["patient", "professional", "establishment"] },
      { q: "Les données sont-elles disponibles hors connexion ?", a: "Sans réseau, vous pouvez relire les écrans déjà ouverts en ligne, en lecture seule, à partir de leurs dernières lectures : aucune modification n’est enregistrée ou envoyée. Le cache des lectures de l’API est chiffré sur l’appareil ; il s’efface à la déconnexion ou après 7 jours (24 heures pour les informations de patients dans les espaces professionnel et établissement), et se désactive dans Paramètres › Hors connexion. La carte d’urgence ouverte par QR est une copie séparée : elle est conservée jusqu’à 24 heures dans IndexedDB sans chiffrement applicatif, sur l’appareil qui l’a ouverte. Utilisez-la sur un appareil de confiance. Un bandeau en haut de l’écran indique l’absence de réseau puis son retour.", profiles: ["patient", "professional", "establishment"] },
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
  { problem: "Dois-je me reconnecter après avoir fermé la PWA ?", solution: "Si vous ne vous êtes pas déconnecté, le cookie de session persiste sur cet appareil après fermeture de la PWA. Dans la configuration de référence, la session expire après 7 jours sans activité et se prolonge lors des échanges avec le serveur ; les comptes professionnels et établissement sont déconnectés après 30 minutes sans activité. L’environnement peut avoir un réglage différent. Dans Paramètres, « Se déconnecter de tous les appareils » ferme toutes vos sessions. Si la session a expiré ou si vous avez choisi Déconnexion, reconnectez-vous. Sans réseau, seuls les écrans et les données déjà enregistrés localement restent accessibles en lecture seule." },
  { problem: "Mon QR code ne fonctionne plus", solution: "Il n’est valable que 5 minutes et ne sert qu’une fois. Affichez-en un nouveau depuis l’onglet « Accès ».", profiles: ["patient", "professional"] },
  { problem: "Une demande d’accès attend toujours", solution: "Seules les demandes qui dépassent le périmètre du QR (consultations passées, historique d’autres établissements) attendent votre décision, dans l’onglet « Accès ». Vous pouvez l’autoriser ou la refuser.", profiles: ["patient"] },
  { problem: "Le scan du QR est refusé : « déjà connecté à un autre professionnel »", solution: "Un seul professionnel peut être connecté à un patient à la fois. Le patient peut mettre fin à l’accès en cours (Historique, « Révoquer maintenant »), ou le professionnel connecté peut le terminer lui-même. Le QR n’est pas perdu : il fonctionne dès que l’accès en cours est terminé.", profiles: ["patient", "professional"] },
  { problem: "L’accès à un carnet s’est arrêté", solution: "L’autorisation dure 2 heures, avec deux prolongations possibles d’une heure. Ensuite, le patient doit présenter un nouveau QR : l’accès se rouvre dès que vous le scannez. Si le scan est refusé parce qu’un autre professionnel est connecté, attendez qu’il termine son accès.", profiles: ["professional"] },
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

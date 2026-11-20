import type { IconName } from "../ui/Icon";
import { DATA_POLICY } from "../../lib/data-policy";

/**
 * Contenu de l'aide. Chaque phrase décrit ce que le produit fait réellement (parcours patient, professionnel,
 * établissement) et reprend les réserves de la revue juridique : pas de « à tout moment », pas de « vérifié »,
 * pas de promesse de sécurité absolue. À mettre à jour avec le produit.
 * Langage : phrases courtes, mots de tous les jours. Pas de vocabulaire de développeur (API, cache, PWA, cookie de session,
 * environnement, audit…) : si un terme technique est indispensable, il est expliqué entre parenthèses.
 */
export type HelpProfileId = "patient" | "professional" | "establishment";
export type HelpStep = { icon: IconName; title: string; text: string };
export type HelpProfile = { id: HelpProfileId; label: string; icon: IconName; summary: string; steps: HelpStep[] };

export const ESTABLISHMENT_STEPS: HelpStep[] = [
  { icon: "mail", title: "Votre établissement est ouvert par notre équipe", text: "Vous nous écrivez avec les informations de l’établissement. Nous créons votre accès administrateur et vous transmettons un mot de passe temporaire, valable 7 jours." },
  { icon: "lock", title: "Vous activez votre compte", text: "Dans « Connexion », saisissez exactement votre e-mail et ce mot de passe temporaire : un message « Accès accordé » confirme l’établissement, puis vous choisissez votre mot de passe personnel. L’accès est personnel : il n’existe pas de compte partagé." },
  { icon: "link", title: "Vous remettez un code à chaque médecin", text: "Un code utilisable une seule fois, valable 48 h. Le médecin le saisit dans son espace et vous recevez sa demande." },
  { icon: "check", title: "Vous confirmez le rattachement", text: "Le médecin fait alors partie de votre établissement. Il ne voit un carnet que si le patient l’y autorise." },
  { icon: "alert", title: "Vous pouvez retirer un accès, en disant pourquoi", text: "Dans la fiche d’un médecin, ou dans le « Profil » d’un administrateur du laboratoire, « Révoquer » demande un motif obligatoire. L’accès s’arrête aussitôt ; la personne lit le motif à sa prochaine connexion et reçoit une notification." },
  { icon: "building", title: "Vous rattachez le laboratoire de l’établissement", text: "Dans la rubrique « Laboratoire », indiquez le prénom, le nom et l’e-mail d’un administrateur. Il n’y a aucun nom de laboratoire à saisir : c’est le laboratoire interne de votre établissement." },
];

export const HELP_PROFILES: HelpProfile[] = [
  {
    id: "patient",
    label: "Je suis patient",
    icon: "heart",
    summary: "Tenir mon carnet et décider qui peut le consulter.",
    steps: [
      { icon: "user", title: "Créez votre compte", text: "Avec votre adresse e-mail et un mot de passe d’au moins 12 caractères, ou avec Google, Facebook ou Apple. Choisissez ensuite le rôle « patient »." },
      { icon: "idcard", title: "Complétez votre profil", text: "Votre nom, puis ce que vous souhaitez enregistrer : téléphone, date de naissance, couverture santé… Les informations obligatoires sont signalées dans les formulaires." },
      { icon: "heart", title: "Remplissez votre carnet", text: "Ajoutez vos antécédents, vos allergies et vos traitements. Ils restent marqués « Déclaré par le patient » : c’est vous qui les avez saisis." },
      { icon: "document", title: "Préparez une consultation", text: "Notez le motif et vos observations dans une pré-consultation, seul ou avec un infirmier qui remplit sur votre téléphone. Le médecin la lit quand vous lui montrez votre QR code, puis termine la consultation en la signant." },
      { icon: "qr", title: "Montrez votre QR code", text: "Le QR code est valable 5 minutes et ne sert qu’une fois. Dès que le professionnel le scanne, il peut lire votre carnet en lecture seule pendant 2 heures : montrer votre QR, c’est donner votre accord. Pour aller plus loin (consultations passées, autre établissement), il doit vous envoyer une demande : vous voyez qui la fait et ce qu’il demande, puis vous acceptez ou vous refusez." },
      { icon: "clock", title: "Suivez et arrêtez un accès", text: "Un accès dure 2 heures, avec au plus deux prolongations d’une heure. Vous pouvez y mettre fin depuis votre espace et retrouver la liste de vos accès, en cours ou terminés." },
      { icon: "users", title: "Proches et enfants", text: "Un proche de confiance peut lire votre fiche d’urgence, et un profil enfant a son propre dossier. Une page dédiée explique les deux pas à pas." },
      { icon: "building", title: "Acceptez ou refusez un partage avec un autre établissement", text: "Quand un professionnel propose de partager certains éléments avec un autre établissement, vous choisissez exactement lesquels et pour combien de temps. L’autre établissement ne voit rien avant votre décision." },
    ],
  },
  {
    id: "professional",
    label: "Je suis professionnel de santé",
    icon: "stethoscope",
    summary: "Rejoindre un établissement et consulter un carnet avec l’accord du patient.",
    steps: [
      { icon: "user", title: "Créez votre compte", text: "Comme un patient : e-mail et mot de passe, ou Google, Facebook ou Apple. Choisissez le rôle « professionnel »." },
      { icon: "stethoscope", title: "Indiquez votre fonction", text: "Votre titre et votre spécialité, tels que vous les déclarez. L’application ne vous demande pas de numéro professionnel à cette étape, et elle ne vérifie ni votre diplôme ni votre compétence." },
      { icon: "link", title: "Rejoignez votre établissement", text: "L’administrateur de votre établissement vous remet un code utilisable une seule fois, valable 48 h. Saisissez-le dans votre espace : votre demande lui est envoyée." },
      { icon: "building", title: "Attendez la confirmation", text: "Tant que l’établissement n’a pas confirmé votre rattachement, vous ne pouvez ouvrir le carnet d’aucun patient." },
      { icon: "qr", title: "Scannez le QR du patient", text: "Le patient vous montre son QR code : scannez-le pour lire son carnet, en lecture seule, pendant 2 heures. Un seul professionnel à la fois. Tant que le patient ne vous a pas montré son QR, vous ne voyez aucune information." },
      { icon: "building", title: "Consultez un historique partagé", text: "Si le patient l’a autorisé, vous pouvez lire pendant un temps limité des soins déjà validés dans d’autres établissements. C’est en lecture seule, chaque consultation est notée dans le journal des accès, et rien n’est copié dans votre établissement." },
      { icon: "document", title: "Consultez, puis enregistrez", text: "Lisez les informations que le patient vous a ouvertes, pendant la durée de l’accès, puis enregistrez et validez votre consultation. Chaque correction est gardée avec sa date." },
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
      { q: "À quoi sert Mon E-Carnet ?", a: "Mon E‑Carnet aide à ranger des informations de santé, à préparer les consultations et à gérer qui peut ouvrir votre carnet. Le service ne remplace pas un avis médical ni les services d’urgence.", profiles: ["patient", "professional", "establishment"] },
      { q: "Comment créer un compte patient ou professionnel ?", a: "Ouvrez Connexion ou inscription, choisissez « Nouveau compte », puis votre rôle. Les façons de se connecter sont indiquées dans le formulaire.", profiles: ["patient", "professional"] },
      { q: "Puis-je l’utiliser sur mon téléphone ?", a: "Oui. Mon E‑Carnet s’ouvre dans le navigateur d’un téléphone ou d’un ordinateur, et vous pouvez l’installer comme une application si votre navigateur le propose. Sans réseau, vous pouvez relire ce que vous aviez déjà ouvert, mais pas le modifier : pour modifier quoi que ce soit, il faut une connexion.", profiles: ["patient", "professional", "establishment"] },
      { q: "Quelles informations puis-je enregistrer dans mon carnet ?", a: "Vos antécédents, allergies et traitements (ce que vous déclarez), des documents (PDF, PNG, JPEG ou WebP, 10 Mo au plus par fichier), vos vaccinations, des mesures de santé, des rappels de médicaments et vos rendez-vous. Les consultations sont saisies par un professionnel autorisé. Chaque information indique qui l’a écrite." },
      { q: "Où sont conservés mes documents et ma photo ?", a: "Vos fichiers sont conservés chez un prestataire spécialisé dans le stockage de fichiers, Cloudinary, quand il est activé. Vos documents médicaux sont rangés dans un espace privé et ne sont montrés qu’aux personnes autorisées. Votre photo de profil, elle, s’affiche à partir d’un lien internet que n’importe qui peut ouvrir s’il le connaît. Le détail est dans la politique de confidentialité." },
      { q: "Mes vaccinations sont-elles confirmées ?", a: "Une vaccination est « Déclarée » quand vous l’avez saisie, « Documentée » quand un document y est joint, et « Confirmée par un professionnel » seulement quand un professionnel l’a confirmée." },
      { q: "Comment fonctionnent les rendez-vous, les rappels et les notifications ?", a: "Les rendez-vous apparaissent dans l’Agenda avec leur motif, leur horaire et leur statut ; un autre horaire peut être proposé. Un rappel de médicament indique le nom, la dose, les horaires et les jours choisis, avec un suivi du stock. Les notifications s’affichent dans l’application ; elles arrivent aussi sur votre appareil si vous les activez dans les paramètres et si le service d’envoi est en place." },
      { q: "Qu’est-ce qu’un plan de suivi ?", a: "Un professionnel autorisé peut vous proposer un plan de suivi : un objectif, des consignes et des mesures à relever (à quelle fréquence, quelle valeur viser). Vous le retrouvez dans votre espace patient, avec le nom du professionnel et de l’établissement qui l’ont créé." },
    ],
  },
  {
    id: "acces",
    title: "Accès et autorisations",
    items: [
      { q: "Un professionnel voit-il mon carnet automatiquement ?", a: "Non. Il doit d’abord être rattaché à un établissement actif, puis vous devez lui donner accès : en lui montrant votre QR code, pour une durée limitée, ou en acceptant sa demande pour aller plus loin.", profiles: ["patient", "professional", "establishment"] },
      { q: "À quoi sert le QR code ?", a: "Il permet à un professionnel d’ouvrir l’accès à votre carnet. Il ne contient aucune information de santé, il est valable 5 minutes et ne sert qu’une fois. Quand le professionnel le scanne, il peut lire votre pré-consultation, vos déclarations et vos documents (en lecture seule) pendant 2 heures, sans autre validation : montrer votre QR, c’est donner votre accord. Un seul professionnel peut être connecté à la fois, et vous pouvez mettre fin à son accès depuis l’historique.", profiles: ["patient", "professional"] },
      { q: "Combien de temps dure une autorisation ?", a: "Deux heures, avec au plus deux prolongations d’une heure. Il s’arrête à la fin du temps prévu, ou si vous y mettez fin depuis votre espace.", profiles: ["patient", "professional"] },
      { q: "Que voit le professionnel ?", a: "Seulement ce que vous avez ouvert : votre pré-consultation, vos déclarations et vos documents en lecture seule (avec le QR), et vos consultations passées si vous les choisissez. Rien n’est visible avant votre accord.", profiles: ["patient", "professional"] },
      { q: "Puis-je refuser ou arrêter un accès ?", a: "Oui. Vous pouvez refuser une demande, ou mettre fin à un accès en cours depuis votre espace. Cela n’efface ni les consultations déjà validées, ni le journal des accès (la liste de qui a ouvert quoi, et quand).", profiles: ["patient"] },
      { q: "Qui a écrit cette information ?", a: "Chaque information indique son origine : « Déclaré par le patient » (vous l’avez saisie), « Saisi dans le compte patient » (pré-consultation) ou « Consultation médicale validée » (saisie par un professionnel). Les corrections de consultations sont gardées avec leur date.", profiles: ["patient", "professional"] },
    ],
  },
  {
    id: "comptes",
    title: "Comptes et rôles",
    items: [
      { q: "Un professionnel est-il vérifié par Mon E-Carnet ?", a: "Non. Mon E-Carnet ne certifie ni l’identité, ni les diplômes, ni la compétence d’un professionnel. L’établissement confirme seulement que le professionnel fait partie de sa structure.", profiles: ["patient", "professional", "establishment"] },
      { q: "Quels dossiers l’administrateur d’un établissement peut-il consulter ?", a: "Par défaut, l’administrateur ne peut pas ouvrir le contenu d’un dossier : il voit la liste des patients, sans leurs informations de santé. Une ouverture exceptionnelle, avec un motif, enregistrée et signalée au patient, est prévue ; elle reste désactivée tant que la décision juridique nécessaire n’a pas été prise.", profiles: ["patient", "establishment", "professional"] },
      { q: "Comment ouvrir l’espace de mon établissement ?", a: "L’ouverture est faite par l’équipe Mon E‑Carnet. Écrivez-nous avec les informations de l’établissement, depuis le formulaire de contact de l’accueil (objet « Ouvrir un espace établissement »). Nous créons votre accès administrateur et vous transmettons un mot de passe temporaire, valable 7 jours : vous vous connectez avec votre e-mail et ce mot de passe, puis vous choisissez le vôtre. Les justificatifs sont envoyés par e-mail, en dehors de l’application.", profiles: ["establishment"] },
      { q: "Comment un médecin rejoint-il un établissement ?", a: "L’administrateur de l’établissement lui remet un code utilisable une seule fois, valable 48 h. Le médecin le saisit dans son espace : sa demande est envoyée à l’établissement. Tant que le rattachement n’est pas confirmé, il ne peut ouvrir le carnet d’aucun patient.", profiles: ["professional", "establishment"] },
      { q: "Que se passe-t-il si le mot de passe temporaire ou le code expire ?", a: "Le mot de passe temporaire d’un administrateur est valable 7 jours ; le code d’un médecin, 48 heures, une seule fois. Demandez-en un nouveau : l’ancien ne marchera plus.", profiles: ["professional", "establishment"] },
      { q: "Comment me connecter la première fois avec un mot de passe temporaire ?", a: "Dans « Connexion », saisissez exactement l’adresse e-mail et le mot de passe temporaire qu’on vous a transmis. Si tout est bon, un message « Accès accordé » indique l’établissement concerné ; sinon, un message explique pourquoi (identifiants incorrects, mot de passe expiré, trop d’essais). Vous choisissez ensuite votre propre mot de passe, à saisir deux fois : le mot de passe temporaire ne peut pas être gardé.", profiles: ["establishment", "professional", "patient"] },
      { q: "Comment rattacher le laboratoire de mon établissement ?", a: "Dans la rubrique « Laboratoire » de votre espace, saisissez le prénom, le nom et l’e-mail de la personne qui l’administrera : aucun nom de laboratoire n’est demandé, car c’est le laboratoire interne de votre établissement. Elle reçoit un mot de passe temporaire, que vous lui transmettez. Vous pouvez ajouter d’autres administrateurs, dix au plus ; en ajouter un ne retire l’accès à personne. Un bouton « Profil » ouvre ses informations (prénom, nom, e-mail, accès) et permet de lui retirer l’accès.", profiles: ["establishment"] },
      { q: "Comment retirer un médecin ou un administrateur du laboratoire ?", a: "Ouvrez la fiche du médecin, ou le « Profil » de l’administrateur du laboratoire, puis choisissez « Révoquer ». Un motif est obligatoire. L’accès s’arrête tout de suite ; la personne lit le motif à sa prochaine connexion, et une notification la prévient sans afficher ce motif. Le journal des accès et les dossiers déjà constitués sont conservés.", profiles: ["establishment"] },
      { q: "Pourquoi mon rattachement ou mon accès a-t-il été retiré ?", a: "Quand un établissement retire un professionnel ou un administrateur de son laboratoire, il doit indiquer un motif. Vous le lisez dans une fenêtre à votre prochaine connexion, et, pour un médecin, dans « Mes rattachements ». Pour le contester, adressez-vous à l’établissement : Mon E-Carnet ne tranche pas ce désaccord.", profiles: ["professional", "establishment"] },
      { q: "Que voit un laboratoire ?", a: "Quand un médecin attend des résultats, le patient montre au laboratoire un QR d’examen. Le laboratoire voit alors le prénom, le nom et la date de naissance du patient, et la liste des examens demandés, puis dépose un fichier PDF par examen. Il ne lit ni le carnet, ni les consultations, ni les documents.", profiles: ["patient", "professional", "establishment"] },
      { q: "Comment partager un code ou un mot de passe temporaire ?", a: "Le bouton Partager, à côté du code, ouvre le menu de partage de votre téléphone (messagerie, SMS, e-mail). Le message contient le lien de l’application, l’adresse e-mail et le code. Si le partage n’est pas possible, le message est copié : collez-le dans votre messagerie. Ne le donnez qu’à la personne concernée.", profiles: ["patient", "professional", "establishment"] },
      { q: "Un médecin peut-il lire tous les carnets de l’établissement ?", a: "Non. Faire partie d’un établissement ne donne accès à aucun dossier : chaque patient autorise ou refuse, à chaque fois.", profiles: ["establishment", "professional"] },
      { q: "Proche de confiance ou carnet enfant : comment ça marche ?", a: "Le proche de confiance est un adulte qui peut lire votre fiche d’urgence, en lecture seule, grâce à un mot de rattachement temporaire : dans Moi › Proches de confiance, « Donner accès » le génère et « Reçu accès » sert à saisir celui qu’on vous a remis. Le carnet enfant est un dossier à part pour un mineur sans compte, ouvert par son représentant légal dans Moi › Carnet enfant, avec sa photo, sa date de naissance et son carnet : on passe de son compte à celui de l’enfant avec la flèche de la carte « Compte patient ». Ces rubriques restent les mêmes quand le compte d’un enfant est ouvert. La page dédiée explique les deux pas à pas.", profiles: ["patient"], href: "/proches-et-enfants", linkLabel: "Lire la page Proches et enfants" },
      { q: "Comment ajouter ou changer la photo de mon enfant ?", a: "Dans Moi › Carnet enfant, touchez la photo (ou les initiales) de votre enfant : sa fiche s’ouvre, avec « Ajouter une photo » ou « Modifier la photo ». Quand son compte est ouvert, vous pouvez aussi la changer dans « Mes informations personnelles ». La nouvelle photo apparaît aussitôt partout dans votre compte : liste des carnets enfants, choix « Pour qui est cette consultation ? » et menu de changement de compte.", profiles: ["patient"] },
      { q: "Comment supprimer le carnet d’un enfant ?", a: "Dans Moi › Carnet enfant, ouvrez la fiche de l’enfant puis touchez « Supprimer le profil ». Vous choisissez un motif et vous confirmez : la suppression est définitive. Son identité, sa photo et ce qui a été saisi pour lui (déclarations, documents, vaccins, mesures, rappels, rendez-vous, carte d’urgence) sont effacés, et les accès ouverts sont retirés. Les consultations déjà signées par un professionnel et la liste des accès restent, sans son identité. Pour seulement couper votre lien sans rien effacer, utilisez « Révoquer » : le dossier est conservé et le lien peut être réactivé.", profiles: ["patient"] },
      { q: "Comment trouver un établissement proche de moi ?", a: "Dans Moi › Établissements proches de moi, une page affiche la carte et la liste des hôpitaux, cliniques et centres de santé partenaires, avec leur logo. La barre de recherche accepte un nom ou une recherche libre (« hôpital Cocody », « pharmacie »). Touchez un établissement pour l’appeler ou voir l’itinéraire. Le bouton « Autour de moi » trie la liste par distance : votre position reste sur votre téléphone, elle n’est ni envoyée à Mon E‑Carnet ni enregistrée. Le fond de carte vient d’OpenStreetMap, qui reçoit les parties de carte affichées (par exemple votre quartier). Seuls les partenaires qui ont choisi d’apparaître sont affichés. Ce n’est pas un service d’urgence.", profiles: ["patient", "professional", "establishment"] },
      { q: "Qu’est-ce qu’un partage avec un autre établissement ?", a: "Un professionnel peut proposer de partager certains éléments avec un autre établissement. Vous recevez la demande, vous choisissez les éléments et la durée, et vous pouvez refuser ou retirer l’accès. L’autre établissement ne peut pas chercher des patients librement.", profiles: ["patient", "professional", "establishment"] },
      { q: "Un infirmier possède-t-il un compte ?", a: "Non. L’infirmier n’a pas de compte propre. Avec l’accord du patient, il peut l’aider à remplir la pré-consultation depuis l’espace du patient.", profiles: ["patient", "establishment"] },
      { q: "Un proche peut-il m’aider à remplir mon carnet ?", a: "La pré-consultation permet d’indiquer la personne qui vous a aidé. Cette personne n’a ni compte, ni droit d’accès à votre carnet.", profiles: ["patient"] },
      { q: "Puis-je me connecter de plusieurs façons ?", a: "Oui. Vous pouvez relier Google, Facebook ou Apple à votre compte depuis les paramètres. Deux comptes ne sont jamais fusionnés simplement parce qu’ils ont la même adresse e-mail.", profiles: ["patient", "professional"] },
    ],
  },
  {
    id: "preferences",
    title: "Compte et préférences",
    items: [
      { q: "À quoi sert le guide « Comment ça marche ? » et comment le revoir ?", a: "Ce guide suit le parcours de votre espace pas à pas (par exemple, pour un patient : préparer la consultation, montrer le QR, retrouver l’historique). Il se lance tout seul lors de vos deux premières utilisations, après la visite guidée. Ensuite, ouvrez le menu de votre compte puis choisissez « Comment ça marche ? » : il s’ouvre à la demande, autant de fois que vous voulez.", profiles: ["patient", "professional", "establishment"] },
      { q: "Comment revoir la visite guidée ?", a: "Ouvrez le menu de votre compte (en bas de la barre latérale sur ordinateur, en haut à droite sur téléphone) puis choisissez « Revoir la visite guidée ». Elle se lance aussi toute seule à la première connexion de chaque espace, une fois votre choix sur les cookies fait. Si vous effacez les données du site dans votre navigateur, elle reprend à la connexion suivante.", profiles: ["patient", "professional", "establishment"] },
      { q: "Comment modifier mon nom ou ma photo ?", a: "Dans Paramètres → Informations personnelles, modifiez votre nom ou choisissez un nouvel avatar.", profiles: ["patient", "professional", "establishment"] },
      { q: "Comment changer l’apparence de l’application ?", a: "Le thème choisi dans les paramètres du compte (couleurs, police, taille du texte) est enregistré avec votre compte : vous le retrouvez sur tous vos appareils.", profiles: ["patient", "professional", "establishment"] },
      { q: "Où gérer mes moyens de connexion et me déconnecter ?", a: "Les moyens de connexion (Google, Facebook, Apple) se gèrent dans Sécurité et connexion, dans les paramètres. Le bouton Déconnexion est dans chaque espace.", profiles: ["patient", "professional", "establishment"] },
      { q: "Comment exporter mon carnet ?", a: "Dans votre carnet, rubrique « Exporter mon carnet » : choisissez une période (ou laissez les dates vides pour tout le carnet), puis un fichier Excel ou PDF." },
      { q: "Comment suspendre ou supprimer mon compte ?", a: "Dans les paramètres du compte, vous pouvez demander une suspension temporaire, traitée par l’équipe, ou la suppression. Après votre confirmation, la suppression coupe tout de suite l’accès, rend votre identité anonyme et supprime vos déclarations, documents, vaccinations, mesures, rappels, plans de suivi, rendez-vous et notifications. Les consultations validées et le journal des accès peuvent être conservés, sous une forme protégée." },
      { q: "J’ai oublié mon mot de passe : que faire ?", a: "Utilisez la récupération de compte depuis la page de connexion. Elle repose sur la question de récupération que vous avez choisie ; après plusieurs erreurs, elle est bloquée un moment." },
      { q: "Comment activer ou désactiver les notifications sur mon appareil ?", a: "Dans les paramètres de votre espace patient, activez ou coupez les notifications sur cet appareil. Elles sont aussi retirées quand vous vous déconnectez. Elles ne marchent que si le service d’envoi est en place." },
    ],
  },
  {
    id: "donnees",
    title: "Données et sécurité",
    items: [
      { q: DATA_POLICY.faq.q, a: DATA_POLICY.faq.a, profiles: ["patient", "professional", "establishment"] },
      { q: "Les données sont-elles disponibles hors connexion ?", a: "Sans réseau, vous pouvez relire les écrans que vous aviez déjà ouverts en ligne, mais pas les modifier : rien n’est enregistré ni envoyé. Ces copies sont chiffrées (rendues illisibles pour les autres) sur votre appareil. Elles s’effacent quand vous vous déconnectez ou après 7 jours (24 heures pour les informations de patients vues dans les espaces professionnel et établissement), et vous pouvez les désactiver dans Paramètres › Hors connexion. La carte d’urgence ouverte avec un QR est une copie séparée : elle reste jusqu’à 24 heures sur l’appareil qui l’a ouverte, sans chiffrement applicatif (l’application ne la rend pas illisible). Utilisez-la seulement sur un appareil de confiance. Un bandeau en haut de l’écran vous prévient quand le réseau disparaît, puis quand il revient.", profiles: ["patient", "professional", "establishment"] },
      { q: "Comment sont protégées mes informations ?", a: "Le service applique les mesures de protection décrites dans les pages Sécurité et Confidentialité.", profiles: ["patient", "professional", "establishment"] },
      { q: "Quelles données de fréquentation sont collectées ?", a: "Si vous l’acceptez, un petit fichier (cookie) au contenu aléatoire aide à compter les pages visitées, certains clics sur les pages publiques et les connexions. Il ne garde ni l’adresse complète des pages, ni votre adresse IP (le numéro de votre connexion internet), ni le texte des boutons.", profiles: ["patient", "professional", "establishment"] },
    ],
  },
  {
    id: "retours",
    title: "Questions et retours",
    items: [
      { q: "Où poser une question ou faire une suggestion ?", a: "Pour une question qui attend une réponse, utilisez le formulaire de contact de l’accueil. Pour une suggestion ou un problème, envoyez un retour depuis le bouton « Noter l’application » (Moi › Noter l’application) : vous pouvez aussi donner une note de 1 à 5 étoiles, avec ou sans message.", profiles: ["patient", "professional", "establishment"] },
      { q: "Quand une enquête peut-elle apparaître ?", a: "Une enquête courte peut apparaître après cinq pages publiques. Une seconde enquête est proposée une seule fois, après une première action réussie dans un espace connecté.", profiles: ["patient", "professional", "establishment"] },
      { q: "Que deviennent mes retours ?", a: "Quand l’équipe les lit, vos retours et vos réponses aux enquêtes ne montrent pas votre nom : ils sont anonymes, ou liés seulement à un numéro sans nom. Votre note en étoiles est comptée avec les autres : l’équipe en voit la moyenne.  N’y indiquez aucun nom, aucun identifiant et aucune information médicale.", profiles: ["patient", "professional", "establishment"] },
    ],
  },
];

export const HELP_TROUBLESHOOTING: { problem: string; solution: string; profiles?: HelpProfileId[] }[] = [
  { problem: "Je n’arrive pas à me connecter", solution: "Vérifiez votre adresse e-mail et votre mot de passe (12 caractères au moins). Après plusieurs essais, le service limite les tentatives : patientez un peu avant de recommencer. Si vous avez relié Google, Facebook ou Apple, essayez cette méthode." },
  { problem: "Dois-je me reconnecter quand je ferme l’application ?", solution: "Non, tant que vous ne vous êtes pas déconnecté : votre connexion reste mémorisée sur cet appareil. En principe, elle s’arrête après 7 jours sans utilisation (chaque fois que vous utilisez l’application, ce délai repart) ; pour les comptes professionnels et établissement, elle s’arrête après 30 minutes sans activité. Ces durées peuvent être réglées autrement selon l’installation. Pour fermer toutes vos connexions d’un coup, ouvrez Paramètres › Sécurité et connexion, puis « Se déconnecter de tous les appareils ». Si votre connexion s’est arrêtée, ou si vous avez choisi Déconnexion, reconnectez-vous. Sans réseau, vous ne pouvez que relire, sans rien modifier, les écrans déjà ouverts sur cet appareil." },
  { problem: "Mon QR code ne fonctionne plus", solution: "Il n’est valable que 5 minutes et ne sert qu’une fois. Affichez-en un nouveau depuis l’onglet « Accès ».", profiles: ["patient", "professional"] },
  { problem: "Une demande d’accès attend toujours", solution: "Seules les demandes qui vont plus loin que le QR (consultations passées, historique d’autres établissements) attendent votre décision, dans l’onglet « Accès ». Vous pouvez l’accepter ou la refuser.", profiles: ["patient"] },
  { problem: "Le scan du QR est refusé : « déjà connecté à un autre professionnel »", solution: "Un seul professionnel peut être connecté à un patient à la fois. Le patient peut mettre fin à l’accès en cours (Historique, « Révoquer maintenant »), ou le professionnel connecté peut le terminer lui-même. Le QR n’est pas perdu : il marche dès que l’accès en cours est terminé.", profiles: ["patient", "professional"] },
  { problem: "L’accès à un carnet s’est arrêté", solution: "L’accès dure 2 heures, avec deux prolongations possibles d’une heure. Ensuite, le patient doit vous montrer un nouveau QR : l’accès se rouvre dès que vous le scannez. Si le scan est refusé parce qu’un autre professionnel est connecté, attendez qu’il termine son accès.", profiles: ["professional"] },
  { problem: "Un établissement m’a retiré mon accès", solution: "Le motif indiqué par l’établissement s’affiche à votre prochaine connexion (pour un médecin, aussi dans « Mes rattachements »). Pour reprendre votre activité, demandez un nouveau code à l’établissement ; les dossiers déjà constitués restent conservés.", profiles: ["professional", "establishment"] },
  { problem: "Mon rattachement n’est pas confirmé", solution: "Il faut attendre la confirmation de l’administrateur de l’établissement. Si votre code a plus de 48 heures, demandez-en un nouveau.", profiles: ["professional", "establishment"] },
];

export const HELP_GLOSSARY: { term: string; definition: string }[] = [
  { term: "Carnet", definition: "Votre espace personnel : profil, déclarations de santé, pré-consultations, consultations et accès." },
  { term: "Déclaration", definition: "Un antécédent, une allergie ou un traitement que vous avez saisi vous-même." },
  { term: "Pré-consultation", definition: "La préparation d’une consultation : le motif et vos observations, destinés à un établissement." },
  { term: "Autorisation d’accès", definition: "Votre accord pour qu’un professionnel lise une partie précise de votre carnet, pendant un temps limité." },
  { term: "Périmètre", definition: "Ce que votre accord permet de lire : par exemple la pré-consultation et les déclarations." },
  { term: "Rattachement", definition: "Le lien confirmé entre un professionnel et un établissement. Il ne donne accès à aucun carnet. L’établissement peut le retirer, en indiquant un motif que la personne lit à sa prochaine connexion." },
  { term: "Consultation validée", definition: "Une consultation saisie et validée par un professionnel autorisé. Elle apparaît dans le carnet du patient." },
  { term: "Journal des accès", definition: "La liste des actions importantes (qui, quoi, quand), sans aucune information médicale." },
];

import type { Metadata } from "next";
import { DATA_POLICY } from "../../lib/data-policy";
import Link from "next/link";
import { Fill, LegalDocument, LegalTable, type LegalSectionDef } from "../../components/public/LegalDocument";
import { CookiePreferencesLink } from "../../components/CookieConsentBanner";
import { CookiesFigure } from "../../components/public/figures/CookiesFigure";
import { RecipientsFigure } from "../../components/public/figures/RecipientsFigure";
import { COOKIES, HOSTS, TECH_VALIDITY } from "../../lib/legal/config";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Mon E-Carnet",
  description: "Données traitées, finalités, destinataires, prestataires, conservation, droits et cookies du service Mon E-Carnet.",
  robots: { index: false, follow: true },
};

const HEALTH = <span className="legal__tag">Donnée de santé</span>;

const summary = (
  <ul>
    <li>Le service protège les informations enregistrées dans votre espace.</li>
    <li>Selon votre rôle, le service traite des données de compte, de profil, de santé déclarées par le patient, de consultation et d’autorisation d’accès.</li>
    <li>L’accès d’un professionnel dépend d’une autorisation du patient, d’un périmètre et d’une durée limitée.</li>
    <li>Le service ne compte ses visites, avec un cookie interne pseudonymisé, qu’après votre accord. Aucune publicité ni outil de suivi tiers n’est utilisé.</li>
    <li>Les documents, vaccinations, mesures, rappels et rendez-vous que vous enregistrez sont des données de santé ; les fichiers sont conservés chez un prestataire d’hébergement de fichiers.</li>
    <li>Sans réseau, les lectures de l’API peuvent être relues en lecture seule depuis un cache chiffré ; la carte d’urgence ouverte par QR est une copie séparée conservée jusqu’à 24 heures sans chiffrement applicatif.</li>
    <li>Les durées de conservation ne sont pas encore approuvées.</li>
    <li>Pour exercer vos droits, voir la section « Vos droits ».</li>
  </ul>
);

const sections: LegalSectionDef[] = [
  {
    id: "responsable",
    title: "Responsable du traitement",
    body: (
      <>
        <p>Le service est exploité par <Fill k="publisher.name" />. Responsable du traitement : <Fill k="privacy.controller" />.</p>
        <p>Selon les traitements, le rôle de responsable peut être partagé ou différent entre l’éditeur et un établissement de santé. Qualification retenue : <Fill k="privacy.roles" />.</p>
        <p>Contact pour la protection des données : <Fill k="privacy.dpoContact" />.</p>
        <p>Formalités accomplies auprès de l’Autorité de protection : <Fill k="privacy.formalities" />.</p>
      </>
    ),
  },
  {
    id: "donnees",
    title: "Données traitées",
    body: (
      <>
        <p>Le tableau décrit les données que le service enregistre dans sa version actuelle. Les champs obligatoires sont indiqués dans les formulaires.</p>
        <LegalTable
          caption="Données traitées par le service"
          head={["Catégorie", "Données", "Origine", "Caractère"]}
          rows={[
            ["Compte et connexion", "Prénom, nom, adresse e-mail, mot de passe (conservé sous forme d’empreinte irréversible), dates de création du compte et de dernière connexion.", "Vous", "Nécessaire pour créer un compte"],
            ["Récupération du compte", "Question de récupération choisie par vous et empreinte irréversible de la réponse, nombre d’échecs et éventuel verrouillage temporaire ; date d’expiration d’un mot de passe temporaire remis par un administrateur de structure, lorsqu’il y en a un.", "Vous, le service", "Facultatif"],
            ["Profil et apparence", "Identifiant public du compte, photo de profil (image choisie sur votre appareil, réduite au format WebP, 250 Ko au plus, envoyée chez le prestataire d’hébergement de fichiers Cloudinary ; son adresse est conservée dans la base du service), palette et police choisies.", "Vous", "Facultatif"],
            ["Connexion par un fournisseur", "Identifiant attribué par Google, Facebook ou Apple, adresse e-mail, nom, adresse de l’image de profil.", "Le fournisseur, si vous choisissez cette méthode", "Facultatif"],
            ["Rôle et usage", "Rôle choisi (patient, professionnel, établissement), état d’avancement de l’activation du profil.", "Vous, le service", "Nécessaire"],
            ["Profil patient", "Téléphone, date de naissance, adresse, organisme de couverture santé, numéro et date d’expiration de la couverture.", "Vous", "Facultatif selon les champs du formulaire"],
            [<>Déclarations du patient {HEALTH}</>, "Antécédents, allergies, traitements : intitulé et détails libres. Le statut « déclaré par le patient » est conservé.", "Le patient", "Facultatif"],
            [<>Pré-consultation {HEALTH}</>, "Motif, observations, mention éventuelle de la personne ayant aidé à la saisie, statut, établissement du médecin qui la clôture, historique des clôtures et corrections.", "Le patient, ou une personne qui l’aide dans son compte", "Facultatif"],
            ["Autorisations et délégations", "Professionnel, établissement ou proche concernés, périmètre, statut, dates de demande, de début, de fin, de prolongation, de refus ou de révocation. Pour les codes et QR, seule l’empreinte du secret est conservée.", "Le patient, le professionnel, le proche, le service", "Nécessaire au fonctionnement"],
            [<>Consultations {HEALTH}</>, "Motif, observations, conclusion, plan de soins, attestation graphique (SVG) avec son empreinte et son horodatage, historique des révisions.", "Le professionnel autorisé", "Selon la consultation"],
            [<>Prescriptions et examens {HEALTH}</>, "Rattachés à une consultation : médicament, dosage, posologie, durée, instructions ; examens demandés (type, intitulé, statut).", "Le professionnel autorisé", "Selon la consultation"],
            [<>Documents {HEALTH}</>, "Fichier au format PDF, PNG, JPEG ou WebP (10 Mo au plus par fichier ; 100 fichiers et 200 Mo au plus par patient), nom d’origine, type, date, émetteur, taille, état de vérification, professionnel et établissement à l’origine de l’ajout lorsqu’il y en a. Lorsque Cloudinary est configuré, le fichier est conservé chez lui dans un espace privé et le service ne le transmet qu’à une personne autorisée ; sinon il reste sur le stockage du serveur de l’API.", "Le patient, ou un professionnel autorisé", "Facultatif"],
            [<>Vaccinations {HEALTH}</>, "Nom du vaccin, numéro de dose, date, numéro de lot, lieu, professionnel, prochaine échéance, statut, notes ; confirmation par un professionnel lorsqu’elle a lieu.", "Le patient, le professionnel autorisé", "Facultatif"],
            [<>Mesures de santé {HEALTH}</>, "Type, valeur et unité, source, date de la mesure, note ; validation par un professionnel lorsqu’elle a lieu.", "Le patient, le professionnel autorisé", "Facultatif"],
            [<>Plans de suivi {HEALTH}</>, "Titre, objectif, consignes, statut, dates ; mesures à suivre (fréquence, cible, notes) ; professionnel et établissement à l’origine du plan ; historique des modifications.", "Le professionnel autorisé", "Selon le suivi proposé"],
            [<>Rappels de médicaments {HEALTH}</>, "Nom, dosage, consignes, horaires, jours, dates de début et de fin, stock restant et seuil de réapprovisionnement ; prises prévues et leur statut.", "Le patient", "Facultatif"],
            ["Rendez-vous", "Motif, début et fin, proposition d’un autre horaire, statut, notes, motif de changement, numéro dans la file ; patient, professionnel et établissement concernés.", "Le patient, le professionnel", "Facultatif"],
            ["Profil professionnel", "Titre, spécialité, statut de rattachement, établissement actif, version et date d’acceptation des conditions de rattachement.", "Le professionnel, l’établissement", "Nécessaire au rattachement"],
            ["Établissement", "Nom, type, ville, adresse, téléphone, e-mail, nom du responsable ; administrateurs successifs ; invitations (e-mail, prénom, nom, empreinte du lien) ; codes de rattachement (empreinte) ; demandes de rattachement ; logo, en-tête, pied de page, téléphone, e-mail et adresse des ordonnances ; modèles de pré-consultation.", "L’établissement, l’équipe de Mon E-Carnet", "Nécessaire"],
            ["Journal d’audit", "Type d’événement, compte auteur et son rôle, éléments concernés (patient, établissement, autorisation, délégation, adressage, consultation), date, informations limitées (action, périmètre, statut, fournisseur). Il ne reprend pas le contenu médical ni les secrets de rattachement.", "Le service", "Nécessaire à la sécurité et à la traçabilité"],
            ["Ouvertures établissement", "Motif catégorisé, structure, auteur, patient, heure d’ouverture, expiration et quantité de ressources lues. Le texte libre du motif n’est pas copié dans l’audit.", "L’administrateur de la structure, le patient, le service", "Sécurité et traçabilité"],
            ["Proche de confiance", "Identité du proche, état de la délégation, périmètre limité à la fiche d’urgence, dates et événements de création, acceptation, sélection et révocation. Le mot de rattachement n’est jamais conservé en clair.", "Le patient, le proche, le service", "Partage choisi par le patient"],
            ["Carte d’urgence", "Ville, nom et téléphone du contact d’urgence, déclarations choisies pour la carte, état du QR (activé, version). Le QR ne contient aucune donnée médicale.", "Le patient", "Partage choisi par le patient"],
            ["Profils représentés", "Lien entre un représentant et le patient qu’il représente (par exemple un enfant), statut ; demande de transfert de la représentation avec indication de vérification de l’âge et de l’identité, auteur et date de la décision.", "Le représentant, le service", "Nécessaire à la représentation"],
            ["Notifications", "Notifications du service (type, titre, texte, lu ou non lu) ; si vous activez les notifications sur un appareil : adresse de l’abonnement auprès du service de notification du navigateur, clés de chiffrement associées, navigateur utilisé.", "Le service, votre navigateur", "Facultatif"],
            ["Adressage inter-établissements", "Établissements source et destinataire, professionnel initiateur, éléments proposés puis acceptés, durée, décision du patient et événements de lecture. Aucun contenu n’est copié dans l’établissement destinataire en V1.", "Le patient, les professionnels autorisés, le service", "Consentement et continuité des soins"],
            ["Avis, messages et enquêtes", "Avis sur le site (catégorie, message, catégorie de la page) ; messages du formulaire de contact (prénom, nom, moyen et coordonnée de contact, objet, message) ; réponses aux enquêtes (note, points appréciés ou difficiles, suggestions), rattachées à l’identifiant aléatoire de visiteur et non à votre compte.", "Vous", "Facultatif"],
            ["Demandes sur le compte", "Demande de suspension temporaire (durée) ou de suppression du compte, motif, précisions, statut, date. Après une suppression, la demande est conservée sans lien avec l’identité supprimée.", "Vous", "À votre initiative"],
            ["Données techniques", "Identifiant de session ; compteurs de limitation des tentatives (adresse IP, adresse e-mail sous forme d’empreinte) conservés pendant la fenêtre de limitation, au plus une heure dans la configuration par défaut ; journaux techniques des hébergeurs.", "Le service, les hébergeurs", "Nécessaire"],
            ["Mesure de fréquentation", "Identifiant aléatoire de visiteur (dans un cookie de 30 jours), nombre de pages vues, dates de première et de dernière visite, dernière catégorie de page vue (accueil, page publique, connexion, espace patient, professionnel ou établissement) et compteurs d’événements de connexion (page de connexion vue, connexion réussie ou échouée, inscription, connexion ou liaison d’un fournisseur). Ni adresse complète de page, ni adresse IP, ni identifiant de dossier : l’identifiant n’est pas rattaché à votre compte dans la base.", "Le service, après votre accord", "Facultatif : activée seulement si vous acceptez la mesure (voir « Cookies »)"],
            ["Pièces justificatives d’une structure", "Documents envoyés par e-mail à l’adresse officielle de Mon E-Carnet, en dehors de l’application.", "L’établissement", "Nécessaire à l’ouverture d’un espace établissement"],
          ]}
        />
        <p>Les journaux techniques des hébergeurs : <Fill k="privacy.hostLogs" />.</p>
        <p>Une photo choisie sur votre appareil est enregistrée chez Cloudinary (voir « Prestataires et services tiers »), et son adresse dans la base du service. Cette adresse permet d’afficher l’image sans être connecté : ne choisissez pas une photo que vous ne voulez pas rendre accessible à quiconque en connaît l’adresse. À la suppression du compte, l’adresse est effacée de la base du service ; la destruction du fichier de la photo chez Cloudinary n’est pas encore automatique. Si votre image de profil est une adresse fournie par votre fournisseur de connexion (Google, Facebook), votre navigateur la charge depuis le site qui l’héberge : ce site peut voir votre adresse IP et des informations sur votre navigateur.</p>
      </>
    ),
  },
  {
    id: "finalites",
    title: "Finalités et base juridique",
    body: (
      <>
        <ul>
          <li>Créer, authentifier et sécuriser les comptes.</li>
          <li>Permettre au patient de tenir son carnet : déclarations de santé, documents, vaccinations, mesures, rappels de médicaments, rendez-vous et préparation d’une consultation.</li>
          <li>Gérer les accès : ouverture par le scan du QR code présenté par le patient, demandes de périmètre élargi et décision du patient, durée, prolongation, fin d’accès, refus et révocation.</li>
          <li>Gérer les délégations limitées à un proche de confiance et permettre leur retrait.</li>
          <li>Gérer les adressages ciblés entre établissements avec le consentement granulaire du patient.</li>
          <li>Tracer les ouvertures motivées de dossiers locaux par un administrateur d’établissement et informer le patient.</li>
          <li>Permettre à un professionnel autorisé d’enregistrer une consultation et d’en conserver l’historique.</li>
          <li>Gérer les établissements, leurs administrateurs et le rattachement des professionnels.</li>
          <li>Assurer la sécurité du service, limiter les abus et conserver une trace des actions sensibles.</li>
          <li>Mesurer la fréquentation du service et l’usage du parcours de connexion, après votre accord, sous forme de statistiques consultées par les superadministrateurs.</li>
          <li>Envoyer les e-mails nécessaires au service, par exemple l’invitation d’un administrateur d’établissement.</li>
          <li>Envoyer les notifications que vous activez (rendez-vous, rappels, mises à jour du carnet).</li>
          <li>Permettre aux professionnels autorisés de proposer des plans de suivi, de confirmer des vaccinations et de valider des mesures.</li>
          <li>Recueillir les avis, les messages de contact et les réponses aux enquêtes, et traiter les demandes de suspension ou de suppression de compte.</li>
          <li>Permettre de relire, sans réseau et en lecture seule, les écrans déjà consultés, au moyen d’une copie chiffrée gardée sur l’appareil.</li>
        </ul>
        <p>Base ou condition juridique de chaque finalité : <Fill k="privacy.legalBasis" />.</p>
        <p>Aucune finalité publicitaire ni de prospection commerciale n’est prévue dans la version actuelle.</p>
      </>
    ),
  },
  {
    id: "destinataires",
    title: "Qui peut recevoir ces données",
    body: (
      <>
        <RecipientsFigure />
        <LegalTable
          caption="Destinataires des données"
          head={["Destinataire", "Ce qu’il peut recevoir", "Condition"]}
          rows={[
            ["Vous", "Les informations de votre compte et de votre carnet.", "Connexion à votre compte."],
            ["Professionnel autorisé", "Le périmètre autorisé : pré-consultation, déclarations et documents en lecture seule (ouverts par le scan du QR que le patient présente lui-même, à un seul professionnel à la fois) ; consultations si le patient les accepte. Rien n’est accessible avant que le patient ait présenté son QR.", `Rattachement actif à un établissement actif, autorisation du patient, durée limitée (${TECH_VALIDITY.accessInitial}, ${TECH_VALIDITY.accessExtension}).`],
            ["Administrateur d’établissement", "Les demandes de rattachement et, après motif obligatoire, les soins produits dans sa propre structure pendant une ouverture temporaire.", "Liste sans contenu avant ouverture; audit et notification au patient; aucune donnée d’un autre établissement."],
            ["Proche de confiance", "La fiche d’urgence dans le périmètre choisi par le patient, en lecture seule.", "Compte propre du proche, mot de rattachement à usage unique, délégation active et non révoquée."],
            ["Professionnel de l’établissement destinataire", "Les éléments d’un adressage ou les soins historiques des structures sources sélectionnées par le patient, en lecture seule.", "Rattachement actif, autorisation du patient, durée limitée et audit ; aucune copie conservée en V1."],
            ["Équipe de Mon E-Carnet (console interne)", "Les demandes d’établissements et de rattachements et leurs statuts.", <>Règles d’accès aux autres données : <Fill key="s" k="privacy.staffAccess" /></>],
            ["Superadministrateurs de Mon E-Carnet", "Les statistiques de visites : total, visiteurs actifs sur 24 heures et liste des visiteurs les plus récents sous forme pseudonymisée.", "Console d’administration réservée aux comptes superadministrateurs ; elle n’affiche pas de dossier patient."],
            ["Prestataires techniques", "Les données nécessaires à l’hébergement, à la base de données et à l’envoi d’e-mails.", <>Voir la section « Prestataires » ci-dessous.</>],
          ]}
        />
        <p>Un rattachement à un établissement ne donne pas, à lui seul, accès à un dossier patient.</p>
      </>
    ),
  },
  {
    id: "sous-traitants",
    title: "Prestataires et services tiers",
    body: (
      <>
        <p>Liste des prestataires de l’<strong>{DATA_POLICY.environmentLabel}</strong>. {DATA_POLICY.providersNote}</p>
        <LegalTable
          caption="Prestataires et services tiers"
          head={["Service", "Rôle", "Données concernées", "Lieu de traitement"]}
          rows={[
            ...HOSTS.map((host) => [host.name, host.role, host.id === "web" ? "Données transmises par votre navigateur (adresse IP, journaux techniques)." : host.id === "api" ? "Données traitées par l’API." : "Données enregistrées par le service, y compris de santé.", <Fill key={host.id} k={host.regionKey} />]),
            ["Prestataire d’envoi d’e-mails", "Envoi des invitations et messages du service.", "Adresse e-mail, prénom, nom de l’établissement, lien d’invitation.", <Fill key="smtp" k="privacy.smtpProvider" />],
            ["Cloudinary (hébergement d’images et de fichiers)", "Conservation des photos de profil, des logos et en-têtes d’établissement, des documents médicaux et des images de cachet et de signature d’un professionnel (ces deux dernières catégories dans un espace privé).", "Les fichiers eux-mêmes ; pour les documents, leur nom d’origine.", "Région d’hébergement et accès d’assistance non confirmés."],
            ["Google Translate (traduction automatique, facultative)", "Traduire l’application en anglais ou en arabe, uniquement si vous choisissez l’une de ces langues dans Paramètres › Langue et que vous l’acceptez.", "Le texte des pages que vous ouvrez, y compris les informations de santé qui y sont affichées, est envoyé à Google pour être traduit. Rien n’est envoyé tant que le français est la langue choisie.", "Selon les conditions de Google, qui agit pour son propre compte."],
            ["Services de notification des navigateurs", "Acheminement des notifications que vous activez sur un appareil ; le service dépend du navigateur (Google, Mozilla, Apple ou Microsoft).", "Adresse de l’abonnement, clés de chiffrement associées, titre et texte de la notification, transmis chiffrés pour votre appareil.", "Seulement si vous activez les notifications et si l’envoi est configuré dans l’environnement."],
            ["Google, Facebook (Meta), Apple", "Connexion, uniquement si vous choisissez cette méthode.", "Identifiant, adresse e-mail, nom, adresse de l’image de profil.", "Selon les conditions de chaque fournisseur, qui agit pour son propre compte."],
          ]}
        />
        <p>{DATA_POLICY.inputNote}</p>
      </>
    ),
  },
  {
    id: "transferts",
    title: "Transferts hors de Côte d’Ivoire",
    body: (
      <>
        <p>Les prestataires de l’environnement actuel sont des services internationaux. Leurs régions d’hébergement et l’emplacement de leurs copies de sauvegarde ne sont pas confirmés. <strong>Aucune garantie de localisation des données en Côte d’Ivoire n’est donnée pour cet environnement.</strong></p>
        <p>Régime applicable aux transferts : <Fill k="privacy.transfers" />.</p>
        <p>{DATA_POLICY.hostingNote}</p>
      </>
    ),
  },
  {
    id: "conservation",
    title: "Conservation",
    body: (
      <>
        <p>Les durées de conservation <strong>ne sont pas encore approuvées</strong>. Elles doivent être définies par catégorie pour l’usage interne actuel, puis publiées avant toute ouverture au grand public.</p>
        <LegalTable
          caption="Durées de conservation par catégorie"
          head={["Catégorie", "Durée de conservation"]}
          rows={[
            ["Données de compte", <Fill key="a" k="retention.account" />],
            ["Déclarations de santé et pré-consultations", <Fill key="b" k="retention.health" />],
            ["Consultations et attestations", <Fill key="c" k="retention.consultations" />],
            ["Autorisations d’accès et leur preuve", <Fill key="d" k="retention.access" />],
            ["Journal d’audit", <Fill key="e" k="retention.audit" />],
            ["Rattachements, invitations et codes", <Fill key="f" k="retention.membership" />],
            ["Pièces justificatives de structure reçues par e-mail", <Fill key="g" k="retention.proofs" />],
            ["Sauvegardes", <Fill key="h" k="retention.backups" />],
            ["Statistiques de visites", <Fill key="i" k="retention.visits" />],
          ]}
        />
        <h3>Durées de validité technique</h3>
        <p>Ces durées limitent l’usage d’un élément. Ce ne sont pas des durées de conservation.</p>
        <LegalTable
          caption="Durées de validité technique"
          head={["Élément", "Durée de validité"]}
          rows={[
            ["Session de connexion", TECH_VALIDITY.session],
            ["QR code d’accès", TECH_VALIDITY.qr],
            ["Autorisation d’accès accordée", `${TECH_VALIDITY.accessInitial}, puis ${TECH_VALIDITY.accessExtension}`],
            ["Invitation d’un administrateur d’établissement", TECH_VALIDITY.invitation],
            ["Code de rattachement d’un médecin", TECH_VALIDITY.joinCode],
          ]}
        />
        <p>La fin d’un rattachement ou d’une autorisation n’efface pas les traces d’audit ni les consultations déjà constituées. Leur conservation dépend des règles applicables et de la politique de conservation, non encore approuvée. Le journal d’audit est conçu pour ne pas être modifié depuis l’application.</p>
      </>
    ),
  },
  {
    id: "securite",
    title: "Sécurité",
    body: (
      <>
        <p>Mesures techniques présentes dans le code de la version actuelle :</p>
        <ul>
          <li>mots de passe conservés sous forme d’empreinte irréversible (Argon2id) ;</li>
          <li>sessions gérées par le serveur, cookie de session non lisible par les scripts de la page, protection contre les requêtes non voulues (CSRF) ;</li>
          <li>limitation du nombre de tentatives de connexion, d’inscription et d’utilisation de codes ;</li>
          <li>contrôle côté serveur des demandes sensibles selon la session, le rôle, l’établissement, l’autorisation, le périmètre et l’expiration ;</li>
          <li>QR code opaque, à usage unique, sans donnée médicale ; invitations et codes conservés sous forme d’empreinte ;</li>
          <li>journal d’audit des actions sensibles ;</li>
          <li>documents médicaux conservés dans un espace privé de l’hébergeur de fichiers lorsqu’il est configuré, et transmis par le service aux seules personnes autorisées ;</li>
          <li>copie hors connexion chiffrée sur l’appareil (AES‑GCM), effacée à la déconnexion ;</li>
          <li>échanges chiffrés (HTTPS) dans les environnements déployés.</li>
        </ul>
        <p>Ces mesures n’ont pas encore fait l’objet d’un contrôle indépendant et la recette de sécurité n’est pas terminée. Aucun système n’est exempt de risque. Voir aussi la page <Link href="/securite">Sécurité</Link>.</p>
      </>
    ),
  },
  {
    id: "droits",
    title: "Vos droits",
    body: (
      <>
        <p>Selon la loi applicable, notamment la loi n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel, vous pouvez demander l’accès à vos données et leur rectification. Vous pouvez vous opposer à certains traitements pour des motifs légitimes et, dans les cas prévus, demander leur suppression.</p>
        <p>Après votre confirmation, la suppression du compte désactive immédiatement l’accès, sans agrément préalable de l’administration. Les identifiants de connexion et informations de profil sont anonymisés, les accès sont révoqués, et les déclarations, pré-consultations, documents (fichiers détruits chez l’hébergeur de fichiers), vaccinations, mesures, rappels, plans de suivi, rendez-vous et notifications du patient sont supprimés ; les images de cachet et de signature d’un professionnel sont également détruites. La photo de profil n’est pas encore détruite chez Cloudinary à ce stade.</p>
        <p>Les consultations validées et les journaux d’audit immuables peuvent être conservés sous forme protégée lorsque l’intégrité de l’historique médical ou les obligations applicables l’exigent. La console d’administration conserve une trace anonymisée du motif de suppression, sans email ni nom de compte. Les corrections de consultations validées restent historisées.</p>
        <p>Pour exercer vos droits, écrivez à : <Fill k="privacy.dpoContact" />, en indiquant le compte concerné. Procédure et délais : <Fill k="privacy.rights" />.</p>
        <p>Vous pouvez aussi saisir l’Autorité de protection des données à caractère personnel de Côte d’Ivoire, selon les procédures qu’elle publie.</p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies et stockage dans le navigateur",
    body: (
      <>
        <CookiesFigure />
        <LegalTable
          caption="Cookies déposés par le service"
          head={["Nom", "Type", "Finalité", "Durée", "Attributs"]}
          rows={COOKIES.map((cookie) => [cookie.name, cookie.essential ? "Strictement nécessaire" : "Mesure de fréquentation", cookie.purpose, cookie.duration, cookie.attributes])}
        />
        <p>Les cookies <code>sessionid</code> et <code>csrftoken</code> sont strictement nécessaires au fonctionnement du service. Le cookie <code>ecarnet_visitor</code> sert à mesurer la fréquentation uniquement après votre accord explicite ; si vous refusez, les visites, clics et événements d’authentification ne sont pas envoyés à l’outil interne. Votre choix est conservé sur cet appareil et peut être modifié à tout moment.</p>
        <p><CookiePreferencesLink /></p>
        <ul>
          <li><strong>Mesure de fréquentation :</strong> facultative, elle n’est activée qu’après avoir choisi « Accepter la mesure ». Vous pouvez la refuser ou retirer votre choix depuis ce bandeau ou cette rubrique. Elle est réalisée par un outil interne, sans service tiers. <strong>Publicité et suivi par des tiers :</strong> aucun outil de ce type n’est utilisé à ce jour.</li>
          <li><strong>Stockage local et de session :</strong> <code>localStorage</code> conserve une copie du thème d’apparence choisi (palette et police), propre au compte actif sur cet appareil, pour l’appliquer rapidement, et une date indiquant que la visite guidée de chaque espace a déjà été vue (pour ne pas la rejouer à chaque connexion ; « Revoir la visite guidée » la relance). Le thème enregistré sur votre compte dans la base du service reste la référence et se synchronise lorsque vous utilisez un autre appareil. Cette copie locale ne contient ni donnée de santé ni secret d’authentification ; effacer les données du navigateur la supprime sans effacer votre préférence enregistrée sur le compte. <code>sessionStorage</code> conserve brièvement le chemin de destination et l’heure d’un clic sur un lien interne du pied de page public afin d’afficher la nouvelle page en haut ; cette indication expire après 10 secondes et ne contient ni donnée de santé ni information de compte. Les copies conservées pour l’affichage sans réseau (<code>IndexedDB</code> et fichiers de l’application) sont détaillées ci-dessous.</li>
          <li><strong>Langue de l’application (localStorage et cookie) :</strong> <code>localStorage</code> conserve la langue choisie dans Paramètres › Langue (français par défaut, anglais ou arabe) et, si vous avez accepté la traduction, la trace de cet accord ; ces deux réglages restent sur l’appareil. Pour l’anglais et l’arabe, le cookie <code>googtrans</code> est posé par l’application pour le traducteur de Google (un an au plus, SameSite=Lax) : il indique la traduction demandée, et le texte des pages est alors envoyé à Google Translate (voir « Prestataires et services tiers »). En français, aucun contenu n’est envoyé et ce cookie est retiré. La traduction est automatique et peut contenir des erreurs : pour un médicament, une dose ou un résultat, fiez-vous au texte français.</li>
          <li><strong>Économie de données (localStorage) :</strong> <code>localStorage</code> conserve votre choix dans Paramètres › Économie de données (automatique, toujours ou jamais). Ce réglage reste sur l’appareil : il ne contient aucune information de santé, n’est jamais envoyé au serveur et ne change ni vos autorisations d’accès ni la sécurité de votre carnet. En mode automatique, l’application lit seulement ce que le navigateur annonce de la connexion (économie de données demandée, réseau lent).</li>
          <li><strong>Copie hors connexion chiffrée (IndexedDB) :</strong> les lectures JSON éligibles de l’API déjà consultées (par exemple déclarations et écrans des trois espaces) sont conservées en lecture seule, chiffrées (AES‑GCM 256) avec une clé générée sur l’appareil et non exportable. Les fichiers, images et signatures ne sont pas mis dans ce cache ; les jetons et routes QR sont exclus de ce cache API. Aucune modification n’est mise en attente hors connexion. Le cache est supprimé à la déconnexion, quand le service indique que la session n’existe plus, au changement de compte, de profil ou d’établissement actif, après 7 jours (24 heures pour les informations de patients dans les espaces professionnel et établissement), ou à votre demande dans Paramètres › Hors connexion, où vous pouvez aussi le désactiver. La clé étant sur le même appareil, ce chiffrement protège le stockage, pas un navigateur ouvert : sur un appareil partagé, désactivez ce cache.</li>
          <li><strong>Carte d’urgence ouverte par QR (IndexedDB, copie séparée) :</strong> la carte consultée et le jeton de son QR sont conservés jusqu’à 24 heures dans une base IndexedDB distincte, sans chiffrement applicatif, pour permettre une relecture hors réseau. Cette copie n’est pas gérée par le réglage du cache API. Elle est supprimée à l’expiration et lorsque le serveur indique que le QR n’existe plus (404/410). Utilisez cette carte uniquement sur un appareil de confiance ; la désactivation ou le renouvellement du QR ne peut pas effacer immédiatement une copie déjà enregistrée sur un appareil hors ligne.</li>
          <li><strong>Fichiers de l’application :</strong> un service worker garde sur l’appareil les pages publiques, la coquille des écrans de l’application (sans donnée personnelle : les données viennent du service, jamais de la page) et les fichiers de l’application, afin qu’ils se rechargent sans réseau. Il ne garde jamais les réponses de l’API.</li>
          <li><strong>Notifications sur l’appareil :</strong> l’abonnement aux notifications est retiré de l’appareil et du service à la déconnexion ou quand vous les désactivez.</li>
          <li><strong>Polices :</strong> elles sont servies par le site lui-même et ne sont pas demandées à un service de polices tiers à l’affichage.</li>
          <li><strong>Fournisseurs de connexion :</strong> si vous choisissez Google, Facebook ou Apple, ces fournisseurs déposent leurs propres cookies sur leurs domaines, selon leurs règles.</li>
        </ul>
      </>
    ),
  },
  {
    id: "situations",
    title: "Mineurs, aide à la saisie et urgence",
    body: (
      <>
        <p><strong>Mineurs et représentants légaux :</strong> <Fill k="privacy.minors" />.</p>
        <p><strong>Aide à la saisie :</strong> le formulaire de pré-consultation permet d’indiquer la personne qui a aidé à la saisie. Règles applicables : <Fill k="privacy.helper" />. Aucun compte ni droit d’accès distinct n’existe pour cette personne.</p>
        <p><strong>Urgence :</strong> le service n’est pas un service d’urgence.</p>
      </>
    ),
  },
  {
    id: "incidents",
    title: "Incidents de sécurité",
    body: <p>Procédure de gestion et de notification des incidents : <Fill k="privacy.incident" />.</p>,
  },
  {
    id: "modifications",
    title: "Modification de cette politique",
    body: (
      <p>Cette politique peut être modifiée. La version et la date de mise à jour figurent en haut de la page. En cas de modification substantielle, les utilisateurs concernés peuvent être informés selon les modalités adaptées au service : message dans l’application, e-mail ou bandeau.</p>
    ),
  },
];

export default function ConfidentialitePage() {
  return <LegalDocument doc="privacy" summary={summary} sections={sections} />;
}

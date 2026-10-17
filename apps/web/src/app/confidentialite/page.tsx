import type { Metadata } from "next";
import Link from "next/link";
import { Fill, LegalDocument, LegalTable, type LegalSectionDef } from "../../components/public/LegalDocument";
import { CookiePreferencesLink } from "../../components/CookieConsentBanner";
import { COOKIES, HOSTS, TECH_VALIDITY } from "../../lib/legal/config";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Mon E-Carnet",
  description: "Données traitées, finalités, destinataires, prestataires, conservation, droits et cookies du service Mon E-Carnet.",
  robots: { index: false, follow: true },
};

const HEALTH = <span className="legal__tag">Donnée de santé</span>;

const summary = (
  <ul>
    <li>Le service est une <strong>version de test</strong> : n’enregistrez que des données fictives.</li>
    <li>Selon votre rôle, le service traite des données de compte, de profil, de santé déclarées par le patient, de consultation et d’autorisation d’accès.</li>
    <li>L’accès d’un professionnel dépend d’une autorisation du patient, d’un périmètre et d’une durée limitée.</li>
    <li>Le service compte ses visites avec un cookie interne pseudonymisé. Aucune publicité ni outil de suivi tiers n’est utilisé.</li>
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
            ["Profil et apparence", "Identifiant public du compte, photo de profil (image choisie sur votre appareil, réduite puis enregistrée dans la base du service, 250 Ko au plus), palette et police choisies.", "Vous", "Facultatif"],
            ["Connexion par un fournisseur", "Identifiant attribué par Google, Facebook ou Apple, adresse e-mail, nom, adresse de l’image de profil.", "Le fournisseur, si vous choisissez cette méthode", "Facultatif"],
            ["Rôle et usage", "Rôle choisi (patient, professionnel, établissement), état d’avancement de l’activation du profil.", "Vous, le service", "Nécessaire"],
            ["Profil patient", "Téléphone, date de naissance, adresse, organisme de couverture santé, numéro et date d’expiration de la couverture.", "Vous", "Facultatif selon les champs du formulaire"],
            [<>Déclarations du patient {HEALTH}</>, "Antécédents, allergies, traitements : intitulé et détails libres. Le statut « déclaré par le patient » est conservé.", "Le patient", "Facultatif"],
            [<>Pré-consultation {HEALTH}</>, "Motif, observations, mention éventuelle de la personne ayant aidé à la saisie, statut, établissement du médecin qui la clôture, historique des clôtures et corrections.", "Le patient, ou une personne qui l’aide dans son compte", "Facultatif"],
            ["Autorisations d’accès", "Professionnel et établissement concernés, périmètre, statut, dates de demande, de début, de fin, de prolongation, de refus ou de révocation. Pour le QR code, seule l’empreinte du jeton est conservée.", "Le patient, le professionnel, le service", "Nécessaire au fonctionnement"],
            [<>Consultations {HEALTH}</>, "Motif, observations, conclusion, plan de soins, attestation graphique (SVG) avec son empreinte et son horodatage, historique des révisions.", "Le professionnel autorisé", "Selon la consultation"],
            ["Profil professionnel", "Titre, spécialité, statut de rattachement, établissement actif, version et date d’acceptation des conditions de rattachement.", "Le professionnel, l’établissement", "Nécessaire au rattachement"],
            ["Établissement", "Nom, type, ville, adresse, téléphone, e-mail, nom du responsable ; administrateurs successifs ; invitations (e-mail, prénom, nom, empreinte du lien) ; codes de rattachement (empreinte) ; demandes de rattachement.", "L’établissement, l’équipe de Mon E-Carnet", "Nécessaire"],
            ["Journal d’audit", "Type d’événement, compte auteur et son rôle, éléments concernés (patient, établissement, autorisation, consultation), date, informations limitées (action, périmètre, statut, fournisseur). Il ne reprend pas le contenu médical.", "Le service", "Nécessaire à la sécurité et à la traçabilité"],
            ["Données techniques", "Identifiant de session ; compteurs de limitation des tentatives (adresse IP, adresse e-mail sous forme d’empreinte) conservés pendant la fenêtre de limitation, au plus une heure dans la configuration par défaut ; journaux techniques des hébergeurs.", "Le service, les hébergeurs", "Nécessaire"],
            ["Mesure de fréquentation", "Identifiant aléatoire de visiteur (dans un cookie de 30 jours), nombre de pages vues, dates de première et de dernière visite, dernière catégorie de page vue (accueil, page publique, connexion, espace patient, professionnel ou établissement) et compteurs d’événements de connexion (page de connexion vue, connexion réussie ou échouée, inscription, connexion ou liaison d’un fournisseur). Ni adresse complète de page, ni adresse IP, ni identifiant de dossier : l’identifiant n’est pas rattaché à votre compte dans la base.", "Le service, dès la première visite", "Non demandé à ce jour (voir « Cookies »)"],
            ["Pièces justificatives d’une structure", "Documents envoyés par e-mail à l’adresse officielle de Mon E-Carnet, en dehors de l’application.", "L’établissement", "Nécessaire à l’ouverture d’un espace établissement"],
          ]}
        />
        <p>Les journaux techniques des hébergeurs : <Fill k="privacy.hostLogs" />.</p>
        <p>Une photo choisie sur votre appareil est enregistrée par le service dans sa base de données. Si votre image de profil est une adresse fournie par votre fournisseur de connexion (Google, Facebook), votre navigateur la charge depuis le site qui l’héberge : ce site peut voir votre adresse IP et des informations sur votre navigateur.</p>
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
          <li>Permettre au patient de tenir son carnet : déclarations de santé et préparation d’une consultation.</li>
          <li>Gérer les demandes d’accès : demande d’un professionnel, décision du patient, périmètre, durée, prolongation, refus et révocation.</li>
          <li>Permettre à un professionnel autorisé d’enregistrer une consultation et d’en conserver l’historique.</li>
          <li>Gérer les établissements, leurs administrateurs et le rattachement des professionnels.</li>
          <li>Assurer la sécurité du service, limiter les abus et conserver une trace des actions sensibles.</li>
          <li>Mesurer la fréquentation du service et l’usage du parcours de connexion, sous forme de statistiques consultées par les superadministrateurs.</li>
          <li>Envoyer les e-mails nécessaires au service, par exemple l’invitation d’un administrateur d’établissement.</li>
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
        <LegalTable
          caption="Destinataires des données"
          head={["Destinataire", "Ce qu’il peut recevoir", "Condition"]}
          rows={[
            ["Vous", "Les informations de votre compte et de votre carnet.", "Connexion à votre compte."],
            ["Professionnel autorisé", "Le périmètre autorisé : pré-consultation et déclarations ; consultations si le patient les sélectionne. Les documents ne sont pas accessibles dans cette version.", `Rattachement actif à un établissement actif, autorisation du patient, durée limitée (${TECH_VALIDITY.accessInitial}, ${TECH_VALIDITY.accessExtension}).`],
            ["Administrateur d’établissement", "Les données de son établissement, les demandes de rattachement et leur statut.", "Il ne consulte pas les dossiers patients depuis son espace, selon les contrôles d’accès actifs."],
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
        <p>Liste des prestataires de l’<strong>environnement de test actuel</strong>. Elle sera mise à jour avant toute ouverture à des données réelles.</p>
        <LegalTable
          caption="Prestataires et services tiers"
          head={["Service", "Rôle", "Données concernées", "Lieu de traitement"]}
          rows={[
            ...HOSTS.map((host) => [host.name, host.role, host.id === "web" ? "Données transmises par votre navigateur (adresse IP, journaux techniques)." : host.id === "api" ? "Données traitées par l’API." : "Données enregistrées par le service, y compris de santé.", <Fill key={host.id} k={host.regionKey} />]),
            ["Prestataire d’envoi d’e-mails", "Envoi des invitations et messages du service.", "Adresse e-mail, prénom, nom de l’établissement, lien d’invitation.", <Fill key="smtp" k="privacy.smtpProvider" />],
            ["Google, Facebook (Meta), Apple", "Connexion, uniquement si vous choisissez cette méthode.", "Identifiant, adresse e-mail, nom, adresse de l’image de profil.", "Selon les conditions de chaque fournisseur, qui agit pour son propre compte."],
          ]}
        />
        <p>Aucune donnée de santé réelle ne doit être enregistrée chez ces prestataires pendant la phase de test.</p>
      </>
    ),
  },
  {
    id: "transferts",
    title: "Transferts hors de Côte d’Ivoire",
    body: (
      <>
        <p>Les prestataires de l’environnement de test sont des services internationaux. Leurs régions d’hébergement et l’emplacement de leurs copies de sauvegarde ne sont pas confirmés. <strong>Aucune garantie de localisation des données en Côte d’Ivoire n’est donnée pour cet environnement.</strong></p>
        <p>Régime applicable aux transferts : <Fill k="privacy.transfers" />.</p>
        <p>Un hébergement en Côte d’Ivoire est à l’étude pour la suite. Une localisation du serveur principal ne signifie pas que toutes les copies, journaux et accès d’assistance restent dans le même pays : ces éléments seront décrits séparément avant toute ouverture à des données réelles.</p>
      </>
    ),
  },
  {
    id: "conservation",
    title: "Conservation",
    body: (
      <>
        <p>Les durées de conservation <strong>ne sont pas encore approuvées</strong>. Elles seront publiées, par catégorie, avant toute ouverture à des données réelles.</p>
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
        <p>Mesures techniques présentes dans le code de la version de test :</p>
        <ul>
          <li>mots de passe conservés sous forme d’empreinte irréversible (Argon2id) ;</li>
          <li>sessions gérées par le serveur, cookie de session non lisible par les scripts de la page, protection contre les requêtes non voulues (CSRF) ;</li>
          <li>limitation du nombre de tentatives de connexion, d’inscription et d’utilisation de codes ;</li>
          <li>contrôle côté serveur des demandes sensibles selon la session, le rôle, l’établissement, l’autorisation, le périmètre et l’expiration ;</li>
          <li>QR code opaque, à usage unique, sans donnée médicale ; invitations et codes conservés sous forme d’empreinte ;</li>
          <li>journal d’audit des actions sensibles ;</li>
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
        <p>Après votre confirmation, la suppression du compte désactive immédiatement l’accès, sans agrément préalable de l’administration. Les identifiants de connexion et informations de profil sont anonymisés, les accès sont révoqués et les données déclaratives/preconsultations supprimées.</p>
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
        <LegalTable
          caption="Cookies déposés par le service"
          head={["Nom", "Type", "Finalité", "Durée", "Attributs"]}
          rows={COOKIES.map((cookie) => [cookie.name, cookie.essential ? "Strictement nécessaire" : "Mesure de fréquentation", cookie.purpose, cookie.duration, cookie.attributes])}
        />
        <p>Les cookies <code>sessionid</code> et <code>csrftoken</code> sont strictement nécessaires au fonctionnement du service. Le cookie <code>ecarnet_visitor</code> sert à mesurer la fréquentation uniquement après votre accord explicite ; si vous refusez, les visites, clics et événements d’authentification ne sont pas envoyés à l’outil interne. Votre choix est conservé sur cet appareil et peut être modifié à tout moment.</p>
        <p><CookiePreferencesLink /></p>
        <ul>
          <li><strong>Mesure de fréquentation :</strong> facultative, elle n’est activée qu’après avoir choisi « Accepter la mesure ». Vous pouvez la refuser ou retirer votre choix depuis ce bandeau ou cette rubrique. Elle est réalisée par un outil interne, sans service tiers. <strong>Publicité et suivi par des tiers :</strong> aucun outil de ce type n’est utilisé à ce jour.</li>
          <li><strong>Stockage local :</strong> <code>localStorage</code> conserve une copie du thème d’apparence choisi (palette et police), propre au compte actif sur cet appareil, pour l’appliquer rapidement. Le thème enregistré sur votre compte dans la base du service reste la référence et se synchronise lorsque vous utilisez un autre appareil. Cette copie locale ne contient ni donnée de santé ni secret d’authentification ; effacer les données du navigateur la supprime sans effacer votre préférence enregistrée sur le compte. L’application n’utilise pas <code>sessionStorage</code> ni <code>IndexedDB</code>. Un service worker conserve quelques pages publiques pour l’affichage sans connexion ; il ne conserve ni donnée de santé ni réponse de l’API.</li>
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

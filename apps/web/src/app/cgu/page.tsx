import type { Metadata } from "next";
import Link from "next/link";
import { Fill, LegalDocument, type LegalSectionDef } from "../../components/public/LegalDocument";
import { ActorsFigure } from "../../components/public/figures/ActorsFigure";
import { Steps } from "../../components/public/figures/Steps";
import { TECH_VALIDITY } from "../../lib/legal/config";

export const metadata: Metadata = {
  title: "Conditions générales d’utilisation — Mon E-Carnet",
  description: "Conditions d’utilisation du service Mon E-Carnet : comptes, rôles, accès aux informations, obligations et droit applicable.",
  robots: { index: false, follow: true },
};

const summary = (
  <ul>
    <li>La <strong>version actuellement disponible</strong> n’est pas destinée à recevoir des dossiers de santé réels. Donnez des informations exactes et gardez votre compte personnel.</li>
    <li>Le service ne pose pas de diagnostic, ne remplace pas un avis médical et n’est pas un service d’urgence.</li>
    <li>Un professionnel ne lit le carnet d’un patient que si ce patient lui en a donné l’accès.</li>
    <li>Chacun protège ses identifiants (e-mail, mot de passe) et reste responsable de ce qu’il saisit.</li>
  </ul>
);

const sections: LegalSectionDef[] = [
  {
    id: "objet",
    title: "Objet et statut du service",
    body: (
      <>
        <p>Les présentes conditions encadrent l’utilisation du service « <span className="notranslate" translate="no">Mon E‑Carnet</span> », édité par <Fill k="publisher.name" /> (voir les <Link href="/mentions-legales">mentions légales</Link>).</p>
        <p>Le service permet de tenir un carnet de santé personnel (déclarations, documents, vaccinations, mesures, rappels de médicaments, rendez-vous), de préparer une consultation et de gérer des autorisations d’accès ; pour les professionnels autorisés, il permet aussi d’enregistrer des consultations, des ordonnances et des plans de suivi, dans les limites prévues par le service.</p>
        <p>La <strong>version actuellement disponible</strong> n’est pas destinée à recevoir des dossiers de santé réels. Elle n’a pas encore été validée de façon complète sur les plans juridique, médical et technique.</p>
      </>
    ),
  },
  {
    id: "definitions",
    title: "Définitions",
    body: (
      <dl>
        <div><dt>Service</dt><dd>L’application web et mobile « <span className="notranslate" translate="no">Mon E-Carnet</span> ».</dd></div>
        <div><dt>Éditeur</dt><dd>La personne identifiée dans les mentions légales.</dd></div>
        <div><dt>Patient</dt><dd>Titulaire d’un carnet. Il décide qui peut ouvrir son carnet.</dd></div>
        <div><dt>Professionnel</dt><dd>Professionnel de santé rattaché à un établissement, qui peut ouvrir le carnet d’un patient si celui-ci lui en donne l’accès.</dd></div>
        <div><dt>Établissement</dt><dd>Structure de santé disposant d’un espace dans le service, gérée par un administrateur nominatif.</dd></div>
        <div><dt>Laboratoire</dt><dd>Laboratoire interne d’un établissement, géré par un ou plusieurs administrateurs nominatifs que l’établissement désigne. Il dépose le résultat d’un examen demandé par un médecin ; il ne consulte pas le carnet.</dd></div>
        <div><dt>Autorisation d’accès</dt><dd>Accord d’un patient pour qu’un professionnel consulte une partie précise de son carnet pendant une durée limitée.</dd></div>
        <div><dt>Périmètre</dt><dd>Ce que couvre une autorisation : la pré-consultation, les déclarations et, si le patient les choisit, les consultations passées.</dd></div>
      </dl>
    ),
  },
  {
    id: "acceptation",
    title: "Acceptation des conditions",
    body: (
      <>
        <p>L’utilisation du service suppose d’avoir pris connaissance des présentes conditions et de la <Link href="/confidentialite">politique de confidentialité</Link>.</p>
        <p>Comment ces conditions sont acceptées, et comment l’acceptation est conservée : <Fill k="terms.acceptance" />.</p>
        <p>Les médecins qui demandent un rattachement à un établissement acceptent en plus les <Link href="/conditions-rattachement">conditions de rattachement</Link>, distinctes des présentes conditions.</p>
      </>
    ),
  },
  {
    id: "compte",
    title: "Compte",
    body: (
      <>
        <p>Un compte se crée avec une adresse e-mail et un mot de passe, ou avec Google, Facebook ou Apple. Un compte correspond à une personne. Plusieurs moyens de connexion peuvent être reliés à un même compte, à la demande de l’utilisateur ; deux comptes ne sont jamais fusionnés simplement parce qu’ils ont la même adresse e-mail.</p>
        <p>L’utilisateur donne des informations exactes, selon ce que son rôle demande, et les met à jour. Il protège ses moyens de connexion, ne les partage pas et signale sans délai toute utilisation qu’il n’a pas autorisée.</p>
        <p>L’administrateur d’un établissement ou d’un laboratoire reçoit un mot de passe temporaire, valable 7 jours. Il se connecte avec son adresse e-mail et ce mot de passe, puis choisit aussitôt son mot de passe personnel ; le mot de passe temporaire ne peut pas être conservé. Celui qui le remet (y compris avec le bouton « Partager ») ne le communique qu’à la personne concernée et répond de cette transmission.</p>
        <p>Un patient, un professionnel, un administrateur d’établissement, un administrateur de laboratoire et le personnel de l’éditeur n’ont pas les mêmes droits. Un même compte peut disposer de plusieurs rôles.</p>
        <p>Mineurs : <Fill k="privacy.minors" />.</p>
        <p><strong>Carnet enfant.</strong> Un titulaire adulte peut ouvrir, depuis Moi › Carnet enfant, le dossier distinct d’un enfant mineur sans compte dont il est le représentant légal. Il confirme y être autorisé, renseigne l’identité et la date de naissance de l’enfant, peut ajouter sa photo et compléter son carnet. Cette confirmation est déclarée par lui : l’éditeur ne la vérifie pas. Le représentant répond de l’exactitude de ces informations et de l’usage qu’il fait de ce dossier ; chacun de ses accès au dossier de l’enfant est enregistré. Il peut couper son lien (le dossier est alors conservé et le lien peut être réactivé) ou supprimer le profil en indiquant un motif, après une fenêtre de confirmation ; cette suppression est immédiate et irréversible : les données de l’enfant sont effacées de la base (voir « Suspension et clôture »). Devenu adulte, l’enfant ouvre son propre compte et demande lui-même le transfert de son dossier.</p>
      </>
    ),
  },
  {
    id: "roles",
    title: "Rôles et responsabilités de chacun",
    body: (
      <>
        <ActorsFigure variant="terms" />
        <p><strong>Le patient</strong> décide qui peut ouvrir son carnet, pour quoi et pour combien de temps. Il peut refuser une demande ou mettre fin à un accès depuis son espace.</p>
        <p><strong>Le professionnel</strong> n’ouvre un carnet que pendant un accès accordé par le patient. Il reste responsable de ses actes, des informations qu’il saisit et du respect de ses obligations professionnelles, sous réserve du droit applicable et des contrats conclus avec son établissement.</p>
        <p><strong>L’établissement</strong> confirme le rattachement d’un professionnel à sa structure. Cette confirmation ne vaut pas certification par l’éditeur de l’identité, des diplômes ou de la compétence du professionnel. Par défaut, l’administrateur d’un établissement voit une liste de patients sans leurs informations de santé, et il ne peut pas ouvrir le dossier d’un patient. Une ouverture exceptionnelle, avec un motif, enregistrée et signalée au patient, est prévue ; ce mécanisme reste désactivé par défaut, tant que la décision juridique et pratique nécessaire n’a pas été prise. Le professionnel ne consulte que le dossier du patient dont il s’occupe, selon l’accord de ce patient. Aucun accès automatique aux données d’un autre établissement. Quand un établissement retire le rattachement d’un professionnel ou l’accès d’un administrateur de son laboratoire, il doit indiquer un motif. La personne concernée le lit à sa prochaine connexion ; une notification la prévient, sans afficher ce motif. L’accès s’arrête aussitôt ; le journal des accès et les dossiers déjà constitués sont conservés.</p>
        <p><strong>Le laboratoire</strong> est le laboratoire interne d’un établissement : l’établissement désigne ses administrateurs nominatifs (prénom, nom, adresse e-mail), dix au plus, et en répond ; il peut retirer l’accès de l’un d’eux, avec un motif obligatoire. Lorsqu’un médecin attend des résultats d’examens, le patient peut présenter au laboratoire un QR d’examen, distinct de son QR d’accès : il ne contient aucune information de santé, ne dure qu’un temps limité et peut être désactivé par le patient. Le laboratoire y voit le prénom, le nom et la date de naissance du patient et la liste des examens demandés ; il confirme l’identité de la personne présente avant de déposer un fichier PDF par examen. Il n’a accès ni au carnet, ni aux consultations, ni aux documents du patient. Le médecin reprend ensuite la consultation avec un nouveau QR d’accès du patient.</p>
        <p><strong>L’éditeur</strong> fournit le service et ne remplace ni le patient, ni le professionnel, ni l’établissement dans leurs décisions.</p>
      </>
    ),
  },
  {
    id: "acces",
    title: "Accès aux informations du carnet",
    body: (
      <>
        <Steps
          title="En un coup d’œil"
          steps={[
            { icon: "qr", title: "Le patient montre son QR code", text: `Il ne contient aucune information de santé. Validité : ${TECH_VALIDITY.qr}.` },
            { icon: "request", title: "Le professionnel le scanne", text: "L’accès s’ouvre aussitôt, en lecture seule : en montrant son QR, le patient donne son accord. Un seul professionnel à la fois." },
            { icon: "decide", title: "Pour aller plus loin", text: "Consultations passées ou autre établissement : le professionnel fait une demande, que le patient accepte ou refuse." },
            { icon: "clock", title: "L’accès prend fin", text: `Après ${TECH_VALIDITY.accessInitial} (avec ${TECH_VALIDITY.accessExtension}), ou si le patient y met fin.` },
          ]}
        />
        <ol>
          <li>Le patient peut présenter un QR code. Ce QR code ne contient aucune information de santé : il sert seulement à ouvrir un accès. Sa validité est de {TECH_VALIDITY.qr} et il ne sert qu’une fois.</li>
          <li>Lorsque le professionnel scanne le QR code, l’accès aux informations de base (pré-consultation, déclarations) s’ouvre sans autre validation : en montrant lui-même son QR code, le patient donne son accord. Un seul professionnel peut être connecté à un patient à la fois. Pour aller plus loin (consultations passées, historique d’autres établissements), le professionnel envoie une demande : le patient l’accepte ou la refuse après avoir vu qui la fait, de quel établissement, et ce qui est demandé.</li>
          <li>L’accès est valable {TECH_VALIDITY.accessInitial}, avec {TECH_VALIDITY.accessExtension}. Il prend fin au bout de ce temps, si le patient y met fin ou si le professionnel le termine.</li>
          <li>L’accès inclut la lecture seule des documents du patient. Aucun document n’est visible avant que le patient ait montré son QR code.</li>
        </ol>
        <p>Avant d’accepter une demande, le patient vérifie qui la fait, de quel établissement, ce qui est demandé et pour combien de temps. Il peut aussi remettre à un proche de confiance un mot de rattachement (un code utilisable une seule fois) : le proche utilise son propre compte et peut seulement lire la fiche d’urgence. Ce n’est ni un partage de mot de passe, ni une représentation légale. Quand un accès ou un partage prend fin, les consultations déjà validées et le journal des accès (la liste de qui a ouvert quoi, et quand) ne sont pas effacés.</p>
        <p>Un partage avec un autre établissement reste limité à ce que le patient a choisi, et dépend de sa décision. Dans la version actuelle, l’établissement qui reçoit ne peut pas chercher des patients librement, son administrateur ne reçoit pas automatiquement le contenu médical, et aucune copie n’est gardée une fois la période de lecture terminée.</p>
      </>
    ),
  },
  {
    id: "annuaire",
    title: "Établissements proches de moi",
    body: (
      <>
        <p>Un utilisateur connecté peut consulter, sur une page dédiée (Moi › Établissements proches de moi), la carte et la liste des établissements partenaires qui ont choisi d’y apparaître. Chaque établissement renseigne lui-même ses informations (nom, type, ville, adresse, téléphone, position et logo) et en répond : l’éditeur ne garantit ni leur exactitude, ni la disponibilité des soins, ni les horaires. Cette page n’est pas un service d’urgence.</p>
        <p>Le bouton « Autour de moi » demande la position de l’appareil, uniquement quand l’utilisateur le touche, pour trier la liste par distance. Cette position est calculée sur l’appareil : elle n’est ni envoyée à l’éditeur, ni enregistrée. L’utilisateur peut la refuser et chercher à la main. Le fond de carte est fourni par OpenStreetMap, un service tiers qui reçoit les parties de carte affichées, par exemple le quartier de l’utilisateur (voir la politique de confidentialité).</p>
      </>
    ),
  },
  {
    id: "obligations",
    title: "Obligations de l’utilisateur",
    body: (
      <>
        <ul>
          <li>Saisissez uniquement des informations qui vous appartiennent et que vous êtes autorisé à conserver.</li>
          <li>Ne saisissez pas d’informations sur une autre personne sans en avoir le droit.</li>
          <li>Pour un professionnel : saisissez des informations exactes et de bonne foi, distinguez ce que dit le patient de vos propres constatations, et ne modifiez pas frauduleusement une consultation ou une attestation.</li>
          <li>N’essayez pas d’ouvrir un compte, un carnet ou une fonction sans y avoir droit, ne contournez pas les protections et ne perturbez pas le service.</li>
          <li>Respectez la confidentialité des informations que vous ouvrez.</li>
        </ul>
      </>
    ),
  },
  {
    id: "editeur-obligations",
    title: "Obligations de l’éditeur",
    body: (
      <>
        <p>L’éditeur met en place les mesures de protection décrites dans la <Link href="/confidentialite#securite">politique de confidentialité</Link>.</p>
        <p>Ce à quoi l’éditeur s’engage, et jusqu’où : <Fill k="terms.publisherDuties" />.</p>
      </>
    ),
  },
  {
    id: "contenus",
    title: "Contenus saisis par les utilisateurs",
    body: (
      <>
        <p>Le service indique qui a écrit chaque information : le patient (déclaration) ou un professionnel. Chaque auteur répond du contenu qu’il saisit.</p>
        <p>Les corrections apportées aux consultations validées sont gardées avec leur date. L’utilisateur conserve ses droits sur ce qu’il saisit. Il autorise l’éditeur à utiliser ces contenus uniquement pour faire fonctionner le service, comme l’explique la politique de confidentialité.</p>
      </>
    ),
  },
  {
    id: "role-medical",
    title: "Absence de rôle médical",
    body: (
      <p>Le service est un outil pour ranger des informations et préparer les consultations. Il ne pose pas de diagnostic, ne remplace pas l’avis d’un professionnel de santé et ne doit pas être utilisé en cas d’urgence. En cas d’urgence, contactez immédiatement les services de secours de votre pays.</p>
    ),
  },
  {
    id: "propriete",
    title: "Propriété intellectuelle",
    body: (
      <>
        <p>Titulaire des droits sur le service, son nom, son logo, son interface, ses textes et son code : <Fill k="ip.holder" />.</p>
        <p>L’utilisateur reçoit un droit d’usage personnel, non exclusif et non transférable du service, pour la durée de son compte. Conditions d’utilisation du nom, du logo et des contenus : <Fill k="ip.terms" />.</p>
      </>
    ),
  },
  {
    id: "disponibilite",
    title: "Disponibilité, maintenance et sauvegardes",
    body: (
      <>
        <p>Le service peut évoluer. Les informations et les conditions qui s’appliquent sont indiquées dans les documents du service.</p>
        <p>Sans réseau, le service permet de relire, sans rien modifier, les écrans déjà ouverts, grâce à une copie protégée (chiffrée) gardée sur l’appareil. Cette copie peut ne pas montrer les dernières modifications, et rien ne peut être créé, modifié ou validé sans réseau. Sur un appareil partagé, l’utilisateur désactive cette copie ou se déconnecte ; la politique de confidentialité explique comment.</p>
        <p>Le service ne remplace pas un avis médical, une prise en charge urgente ou les services de secours.</p>
      </>
    ),
  },
  {
    id: "securite",
    title: "Sécurité et incidents",
    body: (
      <>
        <p>L’utilisateur signale à l’éditeur tout problème de sécurité ou tout accès suspect dont il a connaissance, à l’adresse indiquée dans les mentions légales.</p>
        <p>Comment les incidents de sécurité sont traités et signalés : <Fill k="privacy.incident" />.</p>
      </>
    ),
  },
  {
    id: "responsabilite",
    title: "Responsabilité",
    body: <p>Clauses de responsabilité : <Fill k="terms.liability" />.</p>,
  },
  {
    id: "suspension",
    title: "Suspension et clôture",
    body: (
      <>
        <p>L’éditeur peut suspendre un accès en cas de menace pour la sécurité, d’usage contraire aux présentes conditions ou de demande d’une autorité compétente.</p>
        <p>Le représentant d’un enfant peut supprimer le profil de cet enfant depuis Moi › Carnet enfant, en indiquant un motif et en confirmant. La suppression est immédiate et irréversible : l’identité, la photo et toutes les données de l’enfant (déclarations, documents, vaccins, mesures, rappels, plans de suivi, rendez-vous, consultations, carte d’urgence) sont effacées de la base et les accès ouverts sont retirés. Seules subsistent, vidées de leur contenu et sans identité, les lignes que le journal des accès, protégé contre toute modification, référence.</p>
        <p>L’utilisateur peut demander, depuis les paramètres de son compte, une suspension temporaire (pour une durée proposée, 90 jours au plus, traitée par l’équipe) ou la suppression de son compte. Après sa confirmation, la suppression coupe tout de suite l’accès et efface les données du compte de la base, de façon irréversible (y compris les carnets des enfants représentés) ; ses effets sur les données sont expliqués dans la politique de confidentialité, section « Vos droits ».</p>
        <p>Comment un compte est fermé et ce que cela change pour les données : <Fill k="terms.closure" />.</p>
      </>
    ),
  },
  {
    id: "donnees",
    title: "Données personnelles",
    body: <p>Les données utilisées, leurs destinataires, les prestataires, les durées de conservation et vos droits sont expliqués dans la <Link href="/confidentialite">politique de confidentialité</Link>.</p>,
  },
  {
    id: "modification",
    title: "Modification des conditions",
    body: <p>Les présentes conditions peuvent être modifiées. La version et la date figurent en haut de la page. En cas de modification substantielle, les utilisateurs concernés peuvent être informés selon les modalités adaptées au service : message dans l’application, e-mail ou bandeau.</p>,
  },
  {
    id: "droit",
    title: "Droit applicable et litiges",
    body: (
      <>
        <p>Les présentes conditions sont régies par le droit de la Côte d’Ivoire, sous réserve de dispositions impératives contraires.</p>
        <p>Juridiction compétente et règlement amiable : <Fill k="terms.court" />.</p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Contact de l’éditeur : <Fill k="publisher.email" />.</p>,
  },
];

export default function CguPage() {
  return <LegalDocument doc="terms" summary={summary} sections={sections} />;
}

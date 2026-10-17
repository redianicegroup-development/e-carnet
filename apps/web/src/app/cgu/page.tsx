import type { Metadata } from "next";
import Link from "next/link";
import { Fill, LegalDocument, type LegalSectionDef } from "../../components/public/LegalDocument";
import { TECH_VALIDITY } from "../../lib/legal/config";

export const metadata: Metadata = {
  title: "Conditions générales d’utilisation — Mon E-Carnet",
  description: "Conditions d’utilisation du service Mon E-Carnet : comptes, rôles, accès aux informations, obligations et droit applicable.",
  robots: { index: false, follow: true },
};

const summary = (
  <ul>
    <li>Le service est une <strong>version de test fermée</strong> : seules des données fictives doivent être saisies.</li>
    <li>Le service ne pose pas de diagnostic, ne remplace pas un avis médical et n’est pas un service d’urgence.</li>
    <li>Un professionnel ne lit le carnet d’un patient que dans le cadre d’une autorisation de ce patient.</li>
    <li>Chaque utilisateur protège ses identifiants et reste responsable de ce qu’il saisit.</li>
  </ul>
);

const sections: LegalSectionDef[] = [
  {
    id: "objet",
    title: "Objet et statut du service",
    body: (
      <>
        <p>Les présentes conditions encadrent l’utilisation du service « Mon E‑Carnet », édité par <Fill k="publisher.name" /> (voir les <Link href="/mentions-legales">mentions légales</Link>).</p>
        <p>Le service permet de tenir un carnet de santé personnel, de préparer une consultation et de gérer des autorisations d’accès dans les limites décrites dans le service.</p>
        <p>La version actuellement disponible est une <strong>version de test fermée</strong>. Elle n’est pas destinée à recevoir des dossiers de santé réels. Elle n’a pas fait l’objet d’une validation juridique, médicale et technique complète.</p>
      </>
    ),
  },
  {
    id: "definitions",
    title: "Définitions",
    body: (
      <dl>
        <div><dt>Service</dt><dd>L’application web et mobile « Mon E-Carnet ».</dd></div>
        <div><dt>Éditeur</dt><dd>La personne identifiée dans les mentions légales.</dd></div>
        <div><dt>Patient</dt><dd>Titulaire d’un carnet. Il décide des accès à son carnet.</dd></div>
        <div><dt>Professionnel</dt><dd>Professionnel de santé rattaché à un établissement, qui peut demander un accès au carnet d’un patient.</dd></div>
        <div><dt>Établissement</dt><dd>Structure de santé disposant d’un espace dans le service, gérée par un administrateur nominatif.</dd></div>
        <div><dt>Autorisation d’accès</dt><dd>Décision d’un patient qui autorise un professionnel à consulter un périmètre défini de son carnet pendant une durée limitée.</dd></div>
        <div><dt>Périmètre</dt><dd>Ensemble des informations couvertes par une autorisation : pré-consultation, déclarations et, si le patient les sélectionne, consultations.</dd></div>
      </dl>
    ),
  },
  {
    id: "acceptation",
    title: "Acceptation des conditions",
    body: (
      <>
        <p>L’utilisation du service suppose d’avoir pris connaissance des présentes conditions et de la <Link href="/confidentialite">politique de confidentialité</Link>.</p>
        <p>Mécanisme d’acceptation et de preuve : <Fill k="terms.acceptance" />.</p>
        <p>Les médecins qui demandent un rattachement à un établissement acceptent en plus les <Link href="/conditions-rattachement">conditions de rattachement</Link>, distinctes des présentes conditions.</p>
      </>
    ),
  },
  {
    id: "compte",
    title: "Compte",
    body: (
      <>
        <p>Un compte se crée avec une adresse e-mail et un mot de passe, ou avec Google, Facebook ou Apple. Un compte correspond à une personne. Plusieurs méthodes de connexion peuvent être liées à un même compte après une connexion volontaire de l’utilisateur ; deux comptes ne sont jamais fusionnés sur la seule base d’une adresse e-mail.</p>
        <p>L’utilisateur fournit des informations exactes dans la mesure requise par son rôle, et les met à jour. Il protège ses moyens de connexion, ne les partage pas et signale sans délai toute utilisation qu’il n’a pas autorisée.</p>
        <p>Les droits d’un patient, d’un professionnel, d’un administrateur d’établissement et du personnel de l’éditeur sont distincts. Un même compte peut disposer de plusieurs rôles.</p>
        <p>Mineurs : <Fill k="privacy.minors" />.</p>
      </>
    ),
  },
  {
    id: "roles",
    title: "Rôles et responsabilités de chacun",
    body: (
      <>
        <p><strong>Le patient</strong> décide des accès à son carnet, choisit le périmètre et la durée, et peut refuser ou révoquer une autorisation depuis son espace.</p>
        <p><strong>Le professionnel</strong> n’accède à un carnet que dans le cadre d’une autorisation active. Il reste responsable de ses actes, des informations qu’il saisit et du respect de ses obligations professionnelles, sous réserve du droit applicable et des contrats conclus avec son établissement.</p>
        <p><strong>L’établissement</strong> confirme le rattachement d’un professionnel à sa structure. Cette confirmation ne vaut pas certification par l’éditeur de l’identité, des diplômes ou de la compétence du professionnel. L’administrateur gère l’établissement et les rattachements ; il ne consulte pas les dossiers patients depuis son espace.</p>
        <p><strong>L’éditeur</strong> fournit le service et ne remplace ni le patient, ni le professionnel, ni l’établissement dans leurs décisions.</p>
      </>
    ),
  },
  {
    id: "acces",
    title: "Accès aux informations du carnet",
    body: (
      <>
        <ol>
          <li>Le patient peut présenter un QR code. Ce QR code ne contient aucune donnée médicale : il permet seulement d’initier une demande. Sa validité est de {TECH_VALIDITY.qr}.</li>
          <li>Le professionnel adresse une demande d’accès. Le patient reçoit cette demande, qui indique le professionnel, l’établissement et le périmètre demandé, avant de décider.</li>
          <li>Si le patient accepte, l’autorisation est valable {TECH_VALIDITY.accessInitial}, avec {TECH_VALIDITY.accessExtension}. Elle prend fin à son expiration ou si le patient la révoque.</li>
          <li>Les documents ne sont pas accessibles dans la version actuelle.</li>
        </ol>
        <p>Le patient vérifie le professionnel, l’établissement, le périmètre et la durée avant d’autoriser. La révocation ou l’expiration d’une autorisation n’efface pas les consultations déjà validées ni les traces d’audit.</p>
      </>
    ),
  },
  {
    id: "obligations",
    title: "Obligations de l’utilisateur",
    body: (
      <>
        <ul>
          <li>Pendant la version de test, ne saisir que des <strong>données fictives</strong>. Ne pas saisir de dossier de santé réel ni de justificatif réel.</li>
          <li>Ne pas saisir d’informations concernant une autre personne sans en avoir le droit.</li>
          <li>Pour un professionnel : saisir des informations exactes et de bonne foi, distinguer les déclarations du patient de ses propres constatations, ne pas altérer ni falsifier une consultation ou une attestation.</li>
          <li>Ne pas tenter d’accéder à un compte, à un carnet ou à une fonction sans autorisation, ne pas contourner les mesures de sécurité et ne pas perturber le service.</li>
          <li>Respecter la confidentialité des informations auxquelles il accède.</li>
        </ul>
      </>
    ),
  },
  {
    id: "editeur-obligations",
    title: "Obligations de l’éditeur",
    body: (
      <>
        <p>L’éditeur met en œuvre les mesures techniques décrites dans la <Link href="/confidentialite#securite">politique de confidentialité</Link>.</p>
        <p>Nature et étendue des obligations de l’éditeur : <Fill k="terms.publisherDuties" />.</p>
      </>
    ),
  },
  {
    id: "contenus",
    title: "Contenus saisis par les utilisateurs",
    body: (
      <>
        <p>Le service affiche l’origine de chaque information : déclarée par le patient ou saisie par un professionnel. Chaque auteur répond du contenu qu’il saisit.</p>
        <p>Les corrections apportées aux consultations validées sont historisées. L’utilisateur conserve ses droits sur les contenus qu’il saisit. Il autorise l’éditeur à les traiter dans la mesure nécessaire au fonctionnement du service, selon la politique de confidentialité.</p>
      </>
    ),
  },
  {
    id: "role-medical",
    title: "Absence de rôle médical",
    body: (
      <p>Le service est un outil de gestion d’informations et de préparation. Il ne pose pas de diagnostic, ne remplace pas l’avis d’un professionnel de santé et ne doit pas être utilisé en cas d’urgence. En cas d’urgence, contactez immédiatement les services de secours de votre pays.</p>
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
        <p>Pendant la version de test, des interruptions, des modifications ou des suppressions d’environnement peuvent survenir sans préavis. Les données de test peuvent être effacées.</p>
        <p>L’utilisateur ne doit pas dépendre de la version de test pour sa prise en charge. Aucune garantie de disponibilité, de sauvegarde ou d’assistance n’est donnée à ce stade ; elles seront précisées après définition du service et validation des conditions contractuelles.</p>
      </>
    ),
  },
  {
    id: "securite",
    title: "Sécurité et incidents",
    body: (
      <>
        <p>L’utilisateur signale à l’éditeur toute faille ou tout accès suspect dont il a connaissance, à l’adresse indiquée dans les mentions légales.</p>
        <p>Procédure de gestion et de notification des incidents : <Fill k="privacy.incident" />.</p>
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
        <p>L’éditeur peut suspendre un accès en cas d’atteinte à la sécurité, d’usage contraire aux présentes conditions ou de demande d’une autorité compétente.</p>
        <p>Modalités et effets de la clôture d’un compte : <Fill k="terms.closure" />.</p>
      </>
    ),
  },
  {
    id: "donnees",
    title: "Données personnelles",
    body: <p>Les données traitées, leurs destinataires, les prestataires, les durées et vos droits sont décrits dans la <Link href="/confidentialite">politique de confidentialité</Link>.</p>,
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

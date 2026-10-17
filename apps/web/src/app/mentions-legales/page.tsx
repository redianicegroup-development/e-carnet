import type { Metadata } from "next";
import Link from "next/link";
import { Fill, LegalDocument, LegalTable, type LegalSectionDef } from "../../components/public/LegalDocument";
import { HOSTS, fieldValue } from "../../lib/legal/config";

export const metadata: Metadata = {
  title: "Mentions légales — Mon E-Carnet",
  description: "Identification de l’éditeur, de l’hébergeur et conditions générales d’information du service Mon E-Carnet.",
  robots: { index: false, follow: true },
};

const sections: LegalSectionDef[] = [
  {
    id: "editeur",
    title: "Éditeur du service",
    body: (
      <>
        <p>Le service « Mon E‑Carnet » est édité et exploité par :</p>
        <dl>
          <div><dt>Dénomination ou nom</dt><dd><Fill k="publisher.name" /></dd></div>
          <div><dt>Forme juridique</dt><dd><Fill k="publisher.legalForm" /></dd></div>
          <div><dt>Immatriculation</dt><dd><Fill k="publisher.registration" /></dd></div>
          <div><dt>Adresse</dt><dd><Fill k="publisher.address" /></dd></div>
          <div><dt>Contact</dt><dd><Fill k="publisher.email" /></dd></div>
        </dl>
      </>
    ),
  },
  {
    id: "publication",
    title: "Direction de la publication",
    body: <p>Directeur ou directrice de la publication : <Fill k="publisher.director" />.</p>,
  },
  {
    id: "hebergement",
    title: "Hébergement",
    body: (
      <>
        <p>Les informations ci-dessous concernent l’<strong>environnement de test actuel</strong>. L’environnement de production pourra utiliser d’autres hébergeurs ; cette page sera alors mise à jour avant toute ouverture.</p>
        <LegalTable
          caption="Hébergeurs de l’environnement de test"
          head={["Rôle", "Hébergeur", "Coordonnées", "Région d’hébergement"]}
          rows={HOSTS.map((host) => [host.role, host.name, <Fill key="d" k={host.detailsKey} />, <Fill key="r" k={host.regionKey} />])}
        />
        <p>Cette liste ne garantit pas que les données soient conservées en Côte d’Ivoire. Les lieux de traitement et de sauvegarde sont décrits dans la <Link href="/confidentialite#sous-traitants">politique de confidentialité</Link>.</p>
      </>
    ),
  },
  {
    id: "statut",
    title: "Statut du service",
    body: (
      <>
        <p>Le service est une <strong>version de test fermée</strong>. Il ne doit recevoir que des données fictives. Il n’est pas ouvert au grand public.</p>
        <p>Il n’a pas fait l’objet d’une validation juridique, médicale et technique complète. Il ne remplace ni un avis médical ni un dispositif d’urgence.</p>
      </>
    ),
  },
  {
    id: "propriete-intellectuelle",
    title: "Propriété intellectuelle",
    body: (
      <>
        <p>Titulaire des droits sur le service, son nom, son logo, son interface, ses textes et son code : <Fill k="ip.holder" />.</p>
        <p>Conditions d’utilisation du nom, du logo et des contenus : <Fill k="ip.terms" />.</p>
        <p>Les informations saisies par les utilisateurs dans leur carnet restent soumises aux règles décrites dans les <Link href="/cgu#contenus">conditions d’utilisation</Link>.</p>
      </>
    ),
  },
  {
    id: "donnees",
    title: "Données personnelles et cookies",
    body: (
      <p>Le traitement des données personnelles, les droits des personnes, les cookies et le stockage dans le navigateur sont décrits dans la <Link href="/confidentialite">politique de confidentialité</Link>.</p>
    ),
  },
  {
    id: "liens",
    title: "Éléments provenant de sites tiers",
    body: (
      <p>Le service peut afficher des éléments hébergés ailleurs, par exemple une image de profil dont l’utilisateur fournit l’adresse. L’éditeur ne contrôle pas ces sites. La connexion avec Google, Facebook ou Apple est soumise aux conditions de ces fournisseurs.</p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>Pour toute question sur ces mentions : {fieldValue("publisher.email") ? <a href={`mailto:${fieldValue("publisher.email")}`}>{fieldValue("publisher.email")}</a> : <Fill k="publisher.email" />}.</p>
    ),
  },
];

export default function MentionsLegalesPage() {
  return <LegalDocument doc="mentions" sections={sections} />;
}

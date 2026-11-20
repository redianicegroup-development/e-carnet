import type { Metadata } from "next";
import Link from "next/link";
import { Fill, LegalDocument, LegalTable, type LegalSectionDef } from "../../components/public/LegalDocument";
import { HostingFigure } from "../../components/public/figures/HostingFigure";
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
        <p>Les informations ci-dessous concernent la <strong>version actuelle du service</strong>. La version destinée au public pourra utiliser d’autres hébergeurs ; cette page sera alors mise à jour avant son ouverture.</p>
        <HostingFigure />
        <LegalTable
          caption="Hébergeurs de la version actuelle du service"
          head={["Rôle", "Hébergeur", "Coordonnées", "Pays ou région d’hébergement"]}
          rows={HOSTS.map((host) => [host.role, host.name, <Fill key="d" k={host.detailsKey} />, <Fill key="r" k={host.regionKey} />])}
        />
        <p>Les fichiers (photos de profil, logos et en-têtes d’établissement, documents médicaux, images de cachet et de signature) sont hébergés par Cloudinary ; ses coordonnées et le pays où il stocke les fichiers ne sont pas encore confirmés. Cette liste ne garantit pas que les données soient conservées en Côte d’Ivoire. Les lieux où les informations sont utilisées et sauvegardées sont expliqués dans la <Link href="/confidentialite#sous-traitants">politique de confidentialité</Link>.</p>
      </>
    ),
  },
  {
    id: "statut",
    title: "Statut du service",
    body: (
      <>
        <p>Le service est la <strong>version actuellement disponible</strong>. Il protège les informations enregistrées, et seuls les utilisateurs autorisés peuvent y accéder.</p>
        <p>Il n’a pas encore été validé de façon complète sur les plans juridique, médical et technique. Il ne remplace ni un avis médical ni un service d’urgence.</p>
      </>
    ),
  },
  {
    id: "propriete-intellectuelle",
    title: "Propriété intellectuelle",
    body: (
      <>
        <p>Titulaire des droits sur le service, son nom, son logo, son apparence, ses textes et son programme : <Fill k="ip.holder" />.</p>
        <p>Conditions d’utilisation du nom, du logo et des contenus : <Fill k="ip.terms" />.</p>
        <p>Les informations saisies par les utilisateurs dans leur carnet restent soumises aux règles décrites dans les <Link href="/cgu#contenus">conditions d’utilisation</Link>.</p>
      </>
    ),
  },
  {
    id: "donnees",
    title: "Données personnelles et cookies",
    body: (
      <p>La façon dont vos données personnelles sont utilisées, vos droits, les cookies et les informations gardées sur votre appareil sont expliqués dans la <Link href="/confidentialite">politique de confidentialité</Link>.</p>
    ),
  },
  {
    id: "liens",
    title: "Éléments provenant de sites tiers",
    body: (
      <p>Le service s’appuie sur Cloudinary pour héberger des fichiers, affiche des cartes dont le fond est fourni par OpenStreetMap (© contributeurs d’OpenStreetMap), et peut afficher des éléments hébergés ailleurs, par exemple la photo de profil fournie par Google, Facebook ou Apple. L’éditeur ne contrôle pas ces sites. Se connecter avec Google, Facebook ou Apple, c’est aussi accepter les conditions de ces entreprises.</p>
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

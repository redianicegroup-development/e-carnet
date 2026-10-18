import Link from "next/link";
import { InfoPageMotion } from "../../components/motion/InfoPageMotion";
import { BackLink } from "../../components/public/BackLink";
import { DocHero } from "../../components/public/figures/DocHero";
import { Steps } from "../../components/public/figures/Steps";
import { PublicShell } from "../../components/public/PublicShell";
import { Icon } from "../../components/ui/Icon";

export const metadata = {
  title: "Conditions de rattachement médecin — Mon E-Carnet",
  robots: { index: false, follow: false },
};

export default function ConditionsRattachementPage() {
  return (
    <PublicShell>
      <article className="hero-page legal legal--single">
        <InfoPageMotion>
          <div className="legal__top"><BackLink fallbackHref="/professionnel/acces" /></div>
          <div className="legal__main">
            <header className="legal__head">
              <div className="legal__head-copy">
                <span className="eyebrow">Rattachement professionnel</span>
                <h1>Engagement de rattachement médecin</h1>
              </div>
              <DocHero icon="stethoscope" />
            </header>

            <div className="legal__draft" role="note">
              <Icon name="alert" size={22} />
              <div><p>Projet fonctionnel à faire valider par un conseil juridique avant tout usage contractuel réel. Ce texte ne remplace pas le contrat complet entre l’établissement et le médecin.</p></div>
            </div>

            <section className="card" aria-labelledby="engagements">
              <h2 id="engagements">En saisissant le code médecin, je m’engage à</h2>
              <ol className="legal__commitments">
                <li>Protéger les informations non publiques de l’établissement et ne pas les divulguer à des personnes non autorisées, sauf obligation légale ou autorisation documentée.</li>
                <li>Préserver la confidentialité des patients et n’accéder à leurs informations que dans le cadre de ma mission, avec les autorisations et consentements requis.</li>
                <li>Saisir des informations médicales de bonne foi et exactes, distinguer les déclarations du patient des constatations professionnelles, et ne pas inventer, altérer ou falsifier un diagnostic, une consultation, une attestation ou un dossier.</li>
                <li>Protéger mes moyens d’accès, ne pas partager mon compte, mon mot de passe ou mes codes personnels et signaler toute compromission présumée.</li>
                <li>Comprendre que l’établissement peut mettre fin au rattachement et que je peux également y mettre fin depuis mon espace privé. La fin du rattachement bloque les nouveaux accès cliniques dépendant de cette affiliation.</li>
                <li>Comprendre que cette fin n’efface pas les traces d’audit ni les consultations et documents déjà constitués ; leur conservation et leur accès demeurent soumis aux règles applicables et à la politique de conservation à approuver.</li>
              </ol>
            </section>

            <section className="card" aria-labelledby="acceptation">
              <h2 id="acceptation">Ce que l’acceptation signifie dans l’application</h2>
              <Steps
                title="En un coup d’œil"
                steps={[
                  { icon: "code", title: "Vous saisissez le code médecin", text: "Sans acceptation explicite, le code n’est pas consommé." },
                  { icon: "record", title: "Le serveur enregistre l’acceptation", text: "Le médecin, l’établissement, la version acceptée et l’horodatage UTC." },
                  { icon: "gate", title: "La demande doit être approuvée", text: "L’acceptation ne donne pas, à elle seule, accès aux dossiers patients." },
                  { icon: "consent", title: "Le patient garde la décision", text: "Les contrôles de consentement et d’autorisation clinique restent applicables." },
                ]}
              />
              <p>Le serveur enregistre le médecin, l’établissement, la version acceptée et l’horodatage UTC lorsque le code est soumis. Sans acceptation explicite, le code n’est pas consommé. L’acceptation ne donne pas, à elle seule, accès aux dossiers patients : la demande doit être approuvée et les contrôles de consentement et d’autorisation clinique restent applicables.</p>
              <p className="muted">L’identité des parties, les responsabilités, la durée, les exceptions de confidentialité, les règles de conservation, la signature électronique et les exigences locales doivent être validées par un juriste avant production.</p>
              <p><Link href="/professionnel/acces">Revenir et accepter les conditions</Link></p>
            </section>
          </div>
        </InfoPageMotion>
      </article>
    </PublicShell>
  );
}

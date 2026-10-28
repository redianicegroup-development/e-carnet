import type { Metadata } from "next";
import Link from "next/link";
import { InfoPageMotion } from "../../components/motion/InfoPageMotion";
import { BackLink } from "../../components/public/BackLink";
import { RecipientsFigure } from "../../components/public/figures/RecipientsFigure";
import { DocHero } from "../../components/public/figures/DocHero";
import { PublicShell } from "../../components/public/PublicShell";
import { Icon, type IconName } from "../../components/ui/Icon";

export const metadata: Metadata = { title: "Sécurité — Mon E-Carnet", description: "Accès au carnet, consentement patient et protection des données.", robots: { index: true, follow: true } };

type SecurityPrinciple = { icon: IconName; title: string; text: string };
const PRINCIPLES: SecurityPrinciple[] = [
  { icon: "lock", title: "Accès limités", text: "Le patient voit le périmètre et la durée d’une autorisation, puis peut la retirer à tout moment." },
  { icon: "clock", title: "Durée maîtrisée", text: "Une autorisation clinique est temporaire. Elle ne devient jamais un accès permanent par défaut." },
  { icon: "check", title: "Décision explicite", text: "Un professionnel doit être rattaché à son établissement et recevoir l’accord du patient avant de consulter le carnet. Un administrateur ne peut ouvrir que les soins de sa propre structure, avec un motif enregistré et une notification au patient." },
  { icon: "document", title: "Historique conservé", text: "Les demandes, décisions et consultations validées laissent une trace dans le carnet pour garder le fil." },
  { icon: "shield", title: "Compte personnel", text: "Gardez vos identifiants confidentiels et utilisez uniquement votre compte. Les services d’urgence restent indépendants du carnet." },
  { icon: "chart", title: "Suivi mesuré", text: "Les statistiques du site utilisent des catégories de pages et des clics publics, sans conserver les URL complètes ni les adresses IP." },
];

export default function SecurityPage() {
  return (
    <PublicShell>
      <article className="hero-page info-page security">
        <InfoPageMotion>
          <BackLink />
          <header className="info-page__head">
            <div className="info-page__head-copy">
              <span className="eyebrow">Sécurité et confidentialité</span>
              <h1>Le patient garde la maîtrise des accès.</h1>
              <p className="lead">Mon E‑Carnet organise les autorisations autour d’une règle simple : chacun ne voit que ce qui lui est destiné, pour le temps nécessaire.</p>
            </div>
            <DocHero icon="lock" />
          </header>

          <section className="security__principles" aria-labelledby="principes-titre">
            <div className="info-page__section-intro"><span className="eyebrow">Nos principes</span><h2 id="principes-titre">Une protection lisible, pas une promesse opaque.</h2><p className="muted">Les règles importantes sont visibles dans les parcours et vérifiées côté API. L’interface explique le contrôle ; le serveur l’applique.</p></div>
            <div className="security__grid">
              {PRINCIPLES.map((item) => <article className="card security__card" key={item.title}>
                <span className="security__icon" aria-hidden="true" data-draw-icon><Icon name={item.icon} size={23} /></span>
                <div><h3>{item.title}</h3><p className="muted">{item.text}</p></div>
              </article>)}
            </div>
          </section>

          <section className="security__flow" aria-labelledby="flux-titre">
            <div className="info-page__section-intro"><span className="eyebrow">Le contrôle en pratique</span><h2 id="flux-titre">Un rattachement ne suffit jamais à ouvrir un dossier.</h2><p className="muted">Le professionnel peut demander un accès, mais le patient garde la décision sur le périmètre et la durée. Les partages entre établissements sont ciblés, temporaires, en lecture seule et sans copie conservée en V1.</p></div>
            <RecipientsFigure />
          </section>

          <aside className="notice help-data-note security__notice"><strong>Informations importantes :</strong> utilisez des informations exactes et gardez votre compte personnel. Mon E‑Carnet ne remplace pas un avis médical ni les services d’urgence.</aside>
          <nav className="legal__others" aria-label="Autres informations">
            <span>À lire aussi :</span>
            <Link href="/aide#donnees">Détails sur les données</Link>
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/a-propos">À propos</Link>
            <Link href="/credits">Crédits</Link>
            <Link href="/aide">Centre d’aide</Link>
          </nav>
        </InfoPageMotion>
      </article>
    </PublicShell>
  );
}

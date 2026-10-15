import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "../../components/public/BackLink";
import { ContactLine } from "../../components/public/ContactLine";
import { PublicShell } from "../../components/public/PublicShell";
import { BrandLogo } from "../../components/ui/BrandLogo";
import { Icon } from "../../components/ui/Icon";
import { CREDITS_BUILT_WITH, CREDITS_ORIGINS, CREDITS_UPDATED } from "../../lib/credits";
import { formatLegalDate } from "../../lib/legal/config";

export const metadata: Metadata = {
  title: "Crédits et remerciements — Mon Carnet Numérique",
  description: "Découvrez l’équipe à l’origine d’E-Carnet, les contributions au projet et les outils utilisés pour le développer.",
  robots: { index: false, follow: true },
};

export default function CreditsPage() {
  return (
    <PublicShell>
      <article className="hero-page credits">
        <BackLink />
        <header className="credits__head">
          <BrandLogo height={60} />
          <span className="eyebrow">Crédits et remerciements</span>
          <h1>Une idée portée par une startup, construite avec des compétences complémentaires.</h1>
          <p className="lead">E-Carnet est un projet porté par Redianice pour répondre à un problème concret : la perte et la dispersion des informations lorsque les carnets de santé papier se perdent ou sont remplacés une fois remplis. Sa conception réunit développement numérique, accompagnement juridique, pilotage de projet et design graphique.</p>
        </header>

        <section className="stack" aria-labelledby="origine">
          <h2 id="origine">Les contributions au projet</h2>
          <div className="credits__grid">
            {CREDITS_ORIGINS.map((entry) => (
              <article className="card credits__card" key={entry.id}>
                <span className="setting-item__icon" aria-hidden="true"><Icon name={entry.icon} /></span>
                <h3>{entry.name}</h3>
                <span className="credits__role">{entry.role}</span>
                <p className="muted">{entry.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="stack" aria-labelledby="remerciements">
          <h2 id="remerciements">Remerciements</h2>
          <p>Merci aux personnes qui prennent le temps de partager leurs retours et leurs besoins. Ces contributions aident l’équipe à faire évoluer le projet en gardant comme priorités la clarté, l’utilité et la place centrale du patient.</p>
        </section>

        <section className="stack" aria-labelledby="identite">
          <h2 id="identite">Identité visuelle</h2>
          <p>L’identité visuelle d’E-Carnet a été pensée pour exprimer une idée simple : un carnet personnel, organisé et placé sous le contrôle de son utilisateur. Le branding, le logo et les choix graphiques sont travaillés pour donner au service une identité cohérente sur l’ensemble de ses interfaces.</p>
        </section>

        <section className="stack" aria-labelledby="outils">
          <h2 id="outils">Construit avec</h2>
          <ul className="credits__list">{CREDITS_BUILT_WITH.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>

        <section className="card" aria-labelledby="contact">
          <span className="eyebrow">Nous écrire</span>
          <h2 id="contact">Une question, une idée ?</h2>
          <p className="muted">Contact : <ContactLine />. Pour le fonctionnement du service, consultez d’abord l’<Link href="/faq">aide</Link>. L’éditeur légal du service est indiqué dans les <Link href="/mentions-legales">mentions légales</Link>.</p>
        </section>

        <p className="muted credits__updated">Page mise à jour le <time dateTime={CREDITS_UPDATED}>{formatLegalDate(CREDITS_UPDATED)}</time>.</p>

        <nav className="legal__others" aria-label="Autres informations">
          <span>À lire aussi :</span>
          <Link href="/faq">Aide</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/cgu">Conditions d’utilisation</Link>
          <Link href="/securite">Sécurité</Link>
        </nav>
      </article>
    </PublicShell>
  );
}

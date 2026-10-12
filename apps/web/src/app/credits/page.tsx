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
  description: "Les personnes et les équipes à l’origine de Mon Carnet Numérique, et les outils sur lesquels il s’appuie.",
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
          <h1>Merci à celles et ceux qui ont rendu ce carnet possible.</h1>
          <p className="lead">Mon Carnet Numérique est conçu par AKATech Studio. Redianice, une startup, a contacté AKATech Studio pour proposer une collaboration autour d’outils simples au service du domaine de la santé.</p>
        </header>

        <section className="stack" aria-labelledby="origine">
          <h2 id="origine">À l’origine du projet</h2>
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
          <p>Merci aux patients, aux professionnels de santé et aux établissements qui testent le pilote et partagent leurs retours. Leurs remarques orientent chaque amélioration, pour que l’expérience reste simple, claire et sous le contrôle du patient.</p>
        </section>

        <section className="stack" aria-labelledby="identite">
          <h2 id="identite">Identité visuelle</h2>
          <p>Le signe réunit un carnet relié et un interrupteur : c’est mon carnet, et c’est moi qui décide. Il accompagne toute l’application, de la page d’accueil aux paramètres.</p>
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

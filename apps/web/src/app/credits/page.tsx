import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "../../components/public/BackLink";
import { ContactLine } from "../../components/public/ContactLine";
import { InfoPageMotion } from "../../components/motion/InfoPageMotion";
import { BrandSwitchFigure, CreditsStackFigure, CreditsTeamFigure } from "../../components/public/figures/CreditsFigures";
import { PublicShell } from "../../components/public/PublicShell";
import { BrandLogo } from "../../components/ui/BrandLogo";
import { Icon } from "../../components/ui/Icon";
import { CREDITS_BUILT_WITH, CREDITS_ORIGINS, CREDITS_TEAM, CREDITS_UPDATED } from "../../lib/credits";
import { formatLegalDate } from "../../lib/legal/config";

export const metadata: Metadata = {
  title: "Crédits et remerciements — Mon E-Carnet",
  description: "Les personnes et les structures à l’origine de Mon E-Carnet : l’équipe Redianice, AKATech Studio et les outils sur lesquels le service s’appuie.",
  robots: { index: false, follow: true },
};

export default function CreditsPage() {
  return (
    <PublicShell>
      <article className="hero-page credits">
        <InfoPageMotion>
        <BackLink />
        <header className="credits__head">
          <BrandLogo height={60} />
          <span className="eyebrow">Crédits et remerciements</span>
          <h1>Merci à celles et ceux qui ont rendu ce carnet possible.</h1>
          <p className="lead">Mon E-Carnet est porté par Redianice, une startup qui construit des outils simples au service de la santé. L’application est développée par AKATech Studio, dont le fondateur fait partie de l’équipe.</p>
        </header>

        <section className="stack" aria-labelledby="equipe">
          <h2 id="equipe">L’équipe</h2>
          <div className="credits__split">
            <p>Une petite équipe, avec des rôles clairs : du pilotage du projet au logo, en passant par le code et le cadre juridique.</p>
            <CreditsTeamFigure />
          </div>
          <ul className="credits__team">
            {CREDITS_TEAM.map((member) => (
              <li className="credits__member" key={member.id}>
                <span className="setting-item__icon" aria-hidden="true" data-draw-icon><Icon name={member.icon} /></span>
                <div>
                  <h3>{member.role}</h3>
                  <span className="credits__role">{member.org}</span>
                  <p className="muted">{member.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="stack" aria-labelledby="origine">
          <h2 id="origine">Les structures</h2>
          <div className="credits__grid">
            {CREDITS_ORIGINS.map((entry) => (
              <article className="card credits__card" key={entry.id}>
                <span className="setting-item__icon" aria-hidden="true" data-draw-icon><Icon name={entry.icon} /></span>
                <h3>{entry.name}</h3>
                <span className="credits__role">{entry.role}</span>
                <p className="muted">{entry.text}</p>
                {entry.href && <a className="credits__ext" href={entry.href} target="_blank" rel="noopener noreferrer">Visiter le site<span className="sr-only"> d’{entry.name} (s’ouvre dans un nouvel onglet)</span><Icon name="chevron" size={14} /></a>}
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
          <div className="credits__identity">
            <BrandSwitchFigure />
            <p>Le logo, le branding et l’identité visuelle sont l’œuvre de deux graphistes de l’équipe. Le signe réunit un carnet relié et un interrupteur : c’est mon carnet, et c’est moi qui décide. Il accompagne toute l’application, de la page d’accueil aux paramètres.</p>
          </div>
        </section>

        <section className="stack" aria-labelledby="outils">
          <h2 id="outils">Construit avec</h2>
          <div className="credits__split">
            <ul className="credits__list">{CREDITS_BUILT_WITH.map((item) => <li key={item}>{item}</li>)}</ul>
            <CreditsStackFigure />
          </div>
        </section>

        <section className="card" aria-labelledby="contact">
          <span className="eyebrow">Nous écrire</span>
          <h2 id="contact">Une question, une idée ?</h2>
          <p className="muted">Contact : <ContactLine />. Pour le fonctionnement du service, consultez d’abord l’<Link href="/aide">aide</Link>. L’éditeur légal du service est indiqué dans les <Link href="/mentions-legales">mentions légales</Link>. Pour comprendre d’où vient le projet, lisez la page <Link href="/a-propos">À propos</Link>.</p>
        </section>

        <p className="muted credits__updated">Page mise à jour le <time dateTime={CREDITS_UPDATED}>{formatLegalDate(CREDITS_UPDATED)}</time>.</p>

        <nav className="legal__others" aria-label="Autres informations">
          <span>À lire aussi :</span>
          <Link href="/a-propos">À propos</Link>
          <Link href="/aide">Aide</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/cgu">Conditions d’utilisation</Link>
          <Link href="/securite">Sécurité</Link>
        </nav>
        </InfoPageMotion>
      </article>
    </PublicShell>
  );
}

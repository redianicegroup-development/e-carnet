import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../../components/public/PublicShell";
import { Icon, type IconName } from "../../components/ui/Icon";
import { CREDITS_TEAM } from "../../lib/credits";

export const metadata: Metadata = {
  title: "À propos — Mon E-Carnet",
  description: "Pourquoi Mon E‑Carnet existe : les carnets de santé papier se perdent et coupent le suivi. Le problème, la solution et l’équipe de la startup Redianice.",
  robots: { index: true, follow: true },
};

const SOLUTION: { icon: IconName; title: string; text: string }[] = [
  { icon: "folder", title: "Un historique qui continue", text: "Antécédents, allergies, traitements et consultations restent au même endroit, d’une année à l’autre. Il n’y a plus de carnet à remplacer." },
  { icon: "lock", title: "Des accès que vous choisissez", text: "Un professionnel envoie une demande. Vous autorisez ou refusez, pour un contenu précis et une durée limitée." },
  { icon: "pencil", title: "Des consultations préparées", text: "Notez le motif et vos observations avant le rendez-vous, pour que le temps de consultation serve à l’essentiel." },
  { icon: "stethoscope", title: "Un lien avec les professionnels", text: "Les professionnels et leurs établissements ont chacun leur espace. Ils consultent ce que le patient a autorisé, pas davantage." },
];

const AUDIENCES = [
  { label: "Patients", text: "Préparez vos rendez-vous et gardez vos informations au même endroit." },
  { label: "Professionnels", text: "Consultez uniquement les informations autorisées par le patient." },
  { label: "Établissements", text: "Gérez les rattachements des professionnels de votre structure." },
];

export default function AboutPage() {
  return (
    <PublicShell>
      <article className="about">
        <header className="about__head">
          <span className="eyebrow">À propos</span>
          <h1>Un carnet qui suit votre santé dans la durée.</h1>
          <p className="lead">Mon E‑Carnet est un carnet de santé numérique porté par la startup Redianice. Il garde vos informations au même endroit, et c’est vous qui décidez qui peut les consulter.</p>
        </header>

        <section className="about__block about__problem" aria-labelledby="constat">
          <div className="about__copy">
            <h2 id="constat">Le constat : un carnet papier ne suit pas toute une vie</h2>
            <p>Les carnets de santé se perdent. Et quand le petit livre est fini ou rempli, on en commence un autre.</p>
            <p>Chaque nouveau carnet repart de zéro. L’historique est coupé en morceaux, et il n’y a pas de suivi sur une longue période.</p>
          </div>
          <figure className="about-chain" role="img" aria-label="Schéma : des carnets papier successifs séparés par des coupures, dont un perdu, face à un historique continu dans Mon E‑Carnet">
            <div className="about-chain__row" aria-hidden="true">
              <span className="about-chain__label">Carnets papier</span>
              <div className="about-chain__track">
                <i className="about-chain__seg">Carnet 1</i>
                <i className="about-chain__seg about-chain__seg--lost">Carnet 2 perdu</i>
                <i className="about-chain__seg">Carnet 3</i>
              </div>
            </div>
            <div className="about-chain__row about-chain__row--ok" aria-hidden="true">
              <span className="about-chain__label">Mon E‑Carnet</span>
              <div className="about-chain__track"><i className="about-chain__seg about-chain__seg--full">Un seul historique</i></div>
            </div>
          </figure>
        </section>

        <section className="about__block" aria-labelledby="solution">
          <div className="about__intro">
            <h2 id="solution">La solution : un seul carnet, qui continue</h2>
            <p className="muted">C’est pour cela que la startup a développé Mon E‑Carnet : garder le suivi sur la durée, sans jamais perdre le fil, avec le patient aux commandes.</p>
          </div>
          <ul className="about-points">
            {SOLUTION.map((item) => (
              <li className="about-point" key={item.title}>
                <span className="about-point__icon" aria-hidden="true"><Icon name={item.icon} size={22} /></span>
                <h3>{item.title}</h3>
                <p className="muted">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="about__block" aria-labelledby="pour-qui">
          <div className="about__intro"><h2 id="pour-qui">Pour qui</h2></div>
          <dl className="about-audiences">
            {AUDIENCES.map((item) => <div key={item.label}><dt>{item.label}</dt><dd className="muted">{item.text}</dd></div>)}
          </dl>
        </section>

        <section className="about__block" aria-labelledby="equipe">
          <div className="about__intro">
            <h2 id="equipe">L’équipe</h2>
            <p className="muted">Une petite équipe, réunie autour de la startup Redianice. Le développeur du projet est aussi le fondateur d’AKATech Studio.</p>
          </div>
          <ul className="about-team">
            {CREDITS_TEAM.map((member) => (
              <li className="about-team__member" key={member.id}>
                <h3>{member.role}</h3>
                <span className="about-team__org">{member.org}</span>
                <p className="muted">{member.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <footer className="about__foot">
          <p className="muted">Version pilote : utilisez uniquement des données fictives pour le moment.</p>
          <p className="actions">
            <Link className="button primary" href="/credits">Crédits et remerciements</Link>
            <Link className="button" href="/securite">Sécurité</Link>
            <Link className="button" href="/aide">Centre d’aide</Link>
          </p>
        </footer>
      </article>
    </PublicShell>
  );
}

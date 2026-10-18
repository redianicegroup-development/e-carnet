import Link from "next/link";
import { Icon } from "../ui/Icon";
import { ContactLine } from "../public/ContactLine";
import {
  HELP_FAQ,
  HELP_GLOSSARY,
  HELP_PROFILES,
  HELP_TROUBLESHOOTING,
  type HelpProfile,
  type HelpProfileId,
} from "./helpContent";

const visible = (profiles: HelpProfileId[] | undefined, profile?: HelpProfileId) => !profile || !profiles || profiles.includes(profile);

/** Étapes numérotées d'un parcours — même présentation que l'aide « établissement » d'origine. */
export function HelpSteps({ steps }: { steps: HelpProfile["steps"] }) {
  return (
    <ol className="help__steps">
      {steps.map((step, index) => (
        <li key={step.title} className="list-row help__step">
          <span className="setting-item__icon" aria-hidden="true"><Icon name={step.icon} /></span>
          <span className="list-row__body"><strong>{index + 1}. {step.title}</strong><br /><span className="muted">{step.text}</span></span>
        </li>
      ))}
    </ol>
  );
}

export function HelpFaq({ profile, groupTitles = true }: { profile?: HelpProfileId; groupTitles?: boolean }) {
  const groups = HELP_FAQ.map((group) => ({ ...group, items: group.items.filter((item) => visible(item.profiles, profile)) })).filter((group) => group.items.length);
  return (
    <div className="help__faq">
      {groups.map((group) => (
        <div className="stack" key={group.id}>
          {groupTitles && <h3>{group.title}</h3>}
          {group.items.map((item) => (
            <details className="card help__q" key={item.q}>
              <summary><strong>{item.q}</strong></summary>
              <p className="muted">{item.a}</p>
            </details>
          ))}
        </div>
      ))}
    </div>
  );
}

export function HelpTroubleshooting({ profile }: { profile?: HelpProfileId }) {
  const rows = HELP_TROUBLESHOOTING.filter((row) => visible(row.profiles, profile));
  return (
    <dl className="help__trouble">
      {rows.map((row) => (
        <div key={row.problem}><dt>{row.problem}</dt><dd>{row.solution}</dd></div>
      ))}
    </dl>
  );
}

export function HelpGlossary() {
  return (
    <dl className="help__glossary">
      {HELP_GLOSSARY.map((entry) => (
        <div key={entry.term}><dt>{entry.term}</dt><dd>{entry.definition}</dd></div>
      ))}
    </dl>
  );
}

export function HelpNotices() {
  return (
    <div className="notice help__notice" role="note">
      <p><strong>Informations importantes :</strong> n’enregistrez que des informations exactes.</p>
      <p><strong>En cas d’urgence</strong>, contactez immédiatement les services de secours de votre pays. Mon E-Carnet n’est pas un service d’urgence et ne remplace pas un avis médical.</p>
    </div>
  );
}

export function HelpContact() {
  return (
    <section className="card help__contact" aria-labelledby="aide-contact">
      <span className="eyebrow">Besoin d’aide ?</span>
      <h2 id="aide-contact">Une question qui n’est pas ici</h2>
      <p className="muted">Écrivez-nous en décrivant ce que vous avez fait et ce que vous voyez à l’écran. N’y joignez aucune information de santé.</p>
      <p><ContactLine /></p>
      <div className="actions">
        <Link className="button" href="/securite">Sécurité</Link>
        <Link className="button" href="/confidentialite">Confidentialité</Link>
        <Link className="button" href="/cgu">Conditions d’utilisation</Link>
        <Link className="button" href="/credits">Crédits et remerciements</Link>
      </div>
    </section>
  );
}

/** Page d'aide publique : choix du profil, parcours pas à pas, questions, dépannage, glossaire, contact. */
export function HelpCenter() {
  return (
    <div className="stack-lg help">
      <header className="help__head">
        <span className="eyebrow">Aide</span>
        <h1>Aide et questions fréquentes</h1>
        <p className="lead">Pas à pas pour chaque profil, des réponses sans jargon et quoi faire en cas de problème.</p>
      </header>

      <HelpNotices />

      <nav className="help__profiles" aria-label="Choisir mon profil">
        {HELP_PROFILES.map((profile) => (
          <a key={profile.id} className="setting-item help__profile" href={`#${profile.id}`}>
            <span className="setting-item__icon" aria-hidden="true"><Icon name={profile.icon} /></span>
            <span className="setting-item__meta"><strong>{profile.label}</strong><span>{profile.summary}</span></span>
            <span className="setting-item__chevron" aria-hidden="true">↓</span>
          </a>
        ))}
      </nav>

      {HELP_PROFILES.map((profile) => (
        <section key={profile.id} id={profile.id} className="help__guide" aria-labelledby={`${profile.id}-titre`}>
          <h2 id={`${profile.id}-titre`}>{profile.label}</h2>
          <p className="muted">{profile.summary}</p>
          <HelpSteps steps={profile.steps} />
        </section>
      ))}

      <section id="questions" className="stack" aria-labelledby="questions-titre">
        <h2 id="questions-titre">Questions fréquentes</h2>
        <HelpFaq />
      </section>

      <section id="depannage" className="stack" aria-labelledby="depannage-titre">
        <h2 id="depannage-titre">Un problème ?</h2>
        <HelpTroubleshooting />
      </section>

      <section id="glossaire" className="stack" aria-labelledby="glossaire-titre">
        <h2 id="glossaire-titre">Les mots du carnet</h2>
        <HelpGlossary />
      </section>

      <HelpContact />
    </div>
  );
}

import { Icon } from "../ui/Icon";
import { HELP_FAQ, HELP_GLOSSARY, HELP_TROUBLESHOOTING, type HelpProfile, type HelpProfileId } from "./helpContent";

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

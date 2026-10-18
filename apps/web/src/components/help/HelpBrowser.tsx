"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { HELP_FAQ, HELP_GLOSSARY, HELP_PROFILES, HELP_TROUBLESHOOTING, type HelpProfileId } from "./helpContent";
import { HelpSteps } from "./HelpParts";

/* Le contenu de l'aide, cherchable et filtrable par profil. Rendu complet côté serveur (rien n'est masqué sans JavaScript) :
   la recherche et le profil ne font que réduire ce qui est déjà là. */
type Filter = HelpProfileId | "all";

const fold = (value: string) => value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const shown = (profiles: HelpProfileId[] | undefined, filter: Filter) => filter === "all" || !profiles || profiles.includes(filter);

export function HelpBrowser() {
  const [profile, setProfile] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const words = useMemo(() => fold(query).split(/\s+/).filter(Boolean), [query]);
  const searching = words.length > 0;
  const hit = (...texts: string[]) => {
    if (!searching) return true;
    const haystack = fold(texts.join(" "));
    return words.every((word) => haystack.includes(word));
  };

  const groups = HELP_FAQ
    .map((group) => ({ ...group, items: group.items.filter((item) => shown(item.profiles, profile) && hit(item.q, item.a)) }))
    .filter((group) => group.items.length);
  const trouble = HELP_TROUBLESHOOTING.filter((row) => shown(row.profiles, profile) && hit(row.problem, row.solution));
  const glossary = HELP_GLOSSARY.filter((entry) => hit(entry.term, entry.definition));
  const guides = searching ? [] : HELP_PROFILES.filter((entry) => profile === "all" || entry.id === profile);
  const count = groups.reduce((total, group) => total + group.items.length, 0) + trouble.length + glossary.length;

  return (
    <div className="stack-lg help__browser">
      <section className="card help__tools" aria-label="Rechercher et choisir mon profil">
        <label className="field help__search">
          <span>Rechercher dans l’aide</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="QR code, durée d’accès, établissement…" autoComplete="off" enterKeyHint="search" />
        </label>
        <div className="help__filters" role="group" aria-label="Afficher l’aide pour">
          <button type="button" className="button small" aria-pressed={profile === "all"} onClick={() => setProfile("all")}>Tout le monde</button>
          {HELP_PROFILES.map((entry) => (
            <button key={entry.id} type="button" className="button small" aria-pressed={profile === entry.id} onClick={() => setProfile(entry.id)}><Icon name={entry.icon} size={16} />{entry.label}</button>
          ))}
        </div>
        <nav className="help__jump" aria-label="Rubriques de l’aide">
          {!searching && <a href="#guides">Guides</a>}
          <a href="#questions">Questions</a>
          <a href="#depannage">Dépannage</a>
          <a href="#glossaire">Mots du carnet</a>
        </nav>
        <p className="muted help__count" role="status" aria-live="polite">{searching ? `${count} réponse${count > 1 ? "s" : ""} pour « ${query.trim()} »` : ""}</p>
      </section>

      {searching && count === 0 && (
        <div className="empty help__empty">
          <p><strong>Aucune réponse pour « {query.trim()} ».</strong></p>
          <p>Essayez un mot plus simple, ou écrivez-nous : nous complétons l’aide avec vos questions.</p>
          <div className="actions"><button type="button" className="button small" onClick={() => setQuery("")}>Effacer la recherche</button><Link className="button primary small" href="/#contact">Nous écrire</Link></div>
        </div>
      )}

      {guides.length > 0 && (
        <div id="guides" className="stack-lg help__guides">
          {guides.map((entry) => (
            <section key={entry.id} id={entry.id} className="help__guide" aria-labelledby={`${entry.id}-titre`}>
              <h2 id={`${entry.id}-titre`}>{entry.label}</h2>
              <p className="muted">{entry.summary}</p>
              <HelpSteps steps={entry.steps} />
            </section>
          ))}
        </div>
      )}

      {groups.length > 0 && (
        <section id="questions" className="stack" aria-labelledby="questions-titre">
          <h2 id="questions-titre">Questions fréquentes</h2>
          <div className="help__faq">
            {groups.map((group) => (
              <div className="stack" key={group.id} id={group.id}>
                <h3>{group.title}</h3>
                {group.items.map((item) => (
                  <details className="card help__q" key={`${item.q}-${searching ? "open" : "closed"}`} open={searching}>
                    <summary><strong>{item.q}</strong></summary>
                    <p className="muted">{item.a}</p>
                  </details>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {trouble.length > 0 && (
        <section id="depannage" className="stack" aria-labelledby="depannage-titre">
          <h2 id="depannage-titre">Un problème ?</h2>
          <dl className="help__trouble">{trouble.map((row) => <div key={row.problem}><dt>{row.problem}</dt><dd>{row.solution}</dd></div>)}</dl>
        </section>
      )}

      {glossary.length > 0 && (
        <section id="glossaire" className="stack" aria-labelledby="glossaire-titre">
          <h2 id="glossaire-titre">Les mots du carnet</h2>
          <dl className="help__glossary">{glossary.map((entry) => <div key={entry.term}><dt>{entry.term}</dt><dd>{entry.definition}</dd></div>)}</dl>
        </section>
      )}
    </div>
  );
}

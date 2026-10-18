import Link from "next/link";
import type { ReactNode } from "react";
import { BackLink } from "./BackLink";
import { Icon, type IconName } from "../ui/Icon";
import { InfoPageMotion } from "../motion/InfoPageMotion";
import { DocHero } from "./figures/DocHero";
import { PublicShell } from "./PublicShell";
import {
  LEGAL_DOCS,
  LEGAL_REVIEW,
  fieldLabel,
  fieldValue,
  formatLegalDate,
  type FieldKey,
  type LegalDocKey,
} from "../../lib/legal/config";

export type LegalSectionDef = { id: string; title: string; body: ReactNode };

/** Valeur renseignée dans lib/legal/config.ts, sinon un repère visible « À COMPLÉTER » (jamais une valeur inventée). */
export function Fill({ k }: { k: FieldKey }) {
  const value = fieldValue(k);
  if (value) return <>{value}</>;
  return <mark className="legal-fill" data-field={k}>[À COMPLÉTER PAR LE CLIENT : {fieldLabel(k)}]</mark>;
}

/** Tableau : empilé en cartes sous 720 px (voir legal.css). Les rôles ARIA gardent la sémantique de tableau une fois le style d’affichage modifié. */
export function LegalTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="legal__table">
      <table role="table">
        <caption className="sr-only">{caption}</caption>
        <thead role="rowgroup"><tr role="row">{head.map((label) => <th key={label} scope="col" role="columnheader">{label}</th>)}</tr></thead>
        <tbody role="rowgroup">
          {rows.map((cells, index) => (
            <tr key={index} role="row">
              {cells.map((cell, position) =>
                position === 0
                  ? <th key={position} scope="row" role="rowheader">{cell}</th>
                  : <td key={position} role="cell" data-label={head[position]}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Pictogramme du badge de l'en-tête, propre à chaque document (sobre : aucun bouclier ni coche de conformité). */
const DOC_ICON: Record<LegalDocKey, IconName> = { mentions: "building", privacy: "lock", terms: "users" };

function TocList({ sections }: { sections: LegalSectionDef[] }) {
  return <ol>{sections.map((section) => <li key={section.id}><a href={`#${section.id}`} data-toc={section.id}>{section.title}</a></li>)}</ol>;
}

export function LegalDocument({ doc, summary, sections }: { doc: LegalDocKey; summary?: ReactNode; sections: LegalSectionDef[] }) {
  const meta = LEGAL_DOCS[doc];
  const provisional = LEGAL_REVIEW.status !== "validated";
  const others = (Object.keys(LEGAL_DOCS) as LegalDocKey[]).filter((key) => key !== doc);
  return (
    <PublicShell>
      <article className="hero-page legal">
        <InfoPageMotion kind="legal">
          <div className="legal__top"><BackLink /></div>
          <div className="legal__layout">
            {/* Ordinateur : sommaire collant à gauche, la rubrique à l'écran est mise en valeur. `data-lenis-prevent` : il défile seul s'il est plus haut que l'écran. */}
            <aside className="legal__side" data-lenis-prevent>
              <nav className="legal__toc" aria-label="Sommaire">
                <h2 className="legal__toc-title">Sommaire</h2>
                <TocList sections={sections} />
              </nav>
            </aside>

            <div className="legal__main">
              <header className="legal__head">
                <div className="legal__head-copy">
                  <span className="eyebrow">Informations légales</span>
                  <h1>{meta.title}</h1>
                  <ul className="legal__facts">
                    <li>Version {meta.version}</li>
                    <li>Dernière mise à jour : <time dateTime={meta.lastUpdated}>{formatLegalDate(meta.lastUpdated)}</time></li>
                    <li data-reading-time hidden />
                  </ul>
                </div>
                <DocHero icon={DOC_ICON[doc]} />
              </header>

              {provisional && (
                <div className="legal__draft" role="note">
                  <Icon name="alert" size={22} />
                  <div>
                    <p><strong>Version provisoire — validation juridique recommandée.</strong></p>
                    <p>Ce texte est un projet de rédaction établi à partir du fonctionnement réel du service. Il n’a pas été validé par un juriste ivoirien. Les informations marquées « À compléter » doivent être renseignées avant toute ouverture au public. Il ne constitue ni un avis juridique ni une déclaration de conformité.</p>
                  </div>
                </div>
              )}

              {summary && <section className="card legal__summary" aria-labelledby="resume-titre"><h2 id="resume-titre">En résumé (non contractuel)</h2>{summary}</section>}

              {/* Mobile : le même sommaire, replié (une liste de 19 rubriques ne doit pas repousser le texte). */}
              <details className="card legal__tocm">
                <summary>Sommaire <span>{sections.length} rubriques</span></summary>
                <nav className="legal__toc" aria-label="Sommaire (version mobile)"><TocList sections={sections} /></nav>
              </details>

              {sections.map((section, index) => (
                <section key={section.id} id={section.id} className="legal__section" aria-labelledby={`${section.id}-titre`} data-spy>
                  <h2 id={`${section.id}-titre`}><span className="legal__num">{index + 1}.</span><span>{section.title}</span></h2>
                  {section.body}
                </section>
              ))}

              <nav className="legal__others" aria-label="Autres informations légales">
                <span>À lire aussi :</span>
                {others.map((key) => <Link key={key} href={LEGAL_DOCS[key].path}>{LEGAL_DOCS[key].short}</Link>)}
                <Link href="/conditions-rattachement">Conditions de rattachement (médecins)</Link>
                <Link href="/securite">Sécurité</Link>
                <Link href="/aide">Aide</Link>
                <Link href="/credits">Crédits</Link>
              </nav>
            </div>
          </div>
        </InfoPageMotion>
      </article>
    </PublicShell>
  );
}

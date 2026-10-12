import Link from "next/link";
import type { ReactNode } from "react";
import { BackLink } from "./BackLink";
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

export function LegalDocument({ doc, summary, sections }: { doc: LegalDocKey; summary?: ReactNode; sections: LegalSectionDef[] }) {
  const meta = LEGAL_DOCS[doc];
  const provisional = LEGAL_REVIEW.status !== "validated";
  const others = (Object.keys(LEGAL_DOCS) as LegalDocKey[]).filter((key) => key !== doc);
  return (
    <PublicShell>
      <article className="hero-page legal">
        <BackLink />
        <header className="legal__head">
          <span className="eyebrow">Informations légales</span>
          <h1>{meta.title}</h1>
          <p className="legal__meta">
            Version {meta.version} · Dernière mise à jour : <time dateTime={meta.lastUpdated}>{formatLegalDate(meta.lastUpdated)}</time>
          </p>
        </header>

        {provisional && (
          <div className="legal__draft" role="note">
            <p><strong><span aria-hidden="true">⚠ </span>Version provisoire — validation juridique recommandée.</strong></p>
            <p>Ce texte est un projet de rédaction établi à partir du fonctionnement réel du service. Il n’a pas été validé par un juriste ivoirien. Les informations marquées « À compléter » doivent être renseignées avant toute ouverture au public. Il ne constitue ni un avis juridique ni une déclaration de conformité.</p>
          </div>
        )}

        {summary && <section className="card legal__summary" aria-labelledby="resume-titre"><h2 id="resume-titre">En résumé (non contractuel)</h2>{summary}</section>}

        <nav className="card legal__toc" aria-label="Sommaire">
          <h2>Sommaire</h2>
          <ol>{sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
        </nav>

        {sections.map((section, index) => (
          <section key={section.id} id={section.id} className="legal__section" aria-labelledby={`${section.id}-titre`}>
            <h2 id={`${section.id}-titre`}>{index + 1}. {section.title}</h2>
            {section.body}
          </section>
        ))}

        <nav className="legal__others" aria-label="Autres informations légales">
          <span>À lire aussi :</span>
          {others.map((key) => <Link key={key} href={LEGAL_DOCS[key].path}>{LEGAL_DOCS[key].short}</Link>)}
          <Link href="/conditions-rattachement">Conditions de rattachement (médecins)</Link>
          <Link href="/securite">Sécurité</Link>
          <Link href="/faq">Aide</Link>
          <Link href="/credits">Crédits</Link>
        </nav>
      </article>
    </PublicShell>
  );
}

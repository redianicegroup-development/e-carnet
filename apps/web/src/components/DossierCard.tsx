import type { ReactNode } from "react";
import { AvatarBadge, displayName, type SpaceAccount } from "./shell/SpaceShell";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { Icon, type IconName } from "./ui/Icon";
import "./dossier-card.css";

export type DossierRow = { label: string; value: ReactNode; wide?: boolean };
export type DossierTile = { key: string; title: string; icon: IconName; hint?: string; content: ReactNode };

/** Lignes d'informations d'un dossier (libellé en gris, valeur en gras), deux colonnes sur grand écran. */
export function DossierRows({ rows }: { rows: DossierRow[] }) {
  return <dl className="dossier__list">
    {rows.map((row, index) => <div key={`${row.label}-${index}`} className={row.wide ? "dossier__wide" : undefined}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
  </dl>;
}

/** « Dossier médecin » et « Dossier patient » : même présentation. Un bloc d'en-tête (photo, nom en titre, métier si c'est un professionnel),
    puis tout ce qui a été déclaré, sous forme de rubriques toujours ouvertes (`sections`) ; `tiles` reste disponible pour des tuiles carrées pliables.
    `rows` : lignes d'information laissées visibles sous le nom ; `tiles` : les tuiles ; `children` : blocs sous les lignes de l'en-tête. */
export function DossierCard({ account, eyebrow, titleId, role, rows, tiles, sections, note, actions, className = "", unified = false, children }: {
  account: Pick<SpaceAccount, "first_name" | "last_name" | "email" | "avatar_url">;
  eyebrow: string;
  titleId: string;
  /** Métier (« Médecin · Cardiologie »), affiché sous le nom. */
  role?: string;
  rows?: DossierRow[];
  tiles?: DossierTile[];
  /** Rubriques toujours ouvertes, l'une sous l'autre : le dossier se lit d'un coup d'œil, sans rien déplier. */
  sections?: DossierTile[];
  note?: string;
  actions?: ReactNode;
  className?: string;
  /** Un seul bloc : les rubriques vivent dans la même carte que l'en-tête, séparées par un filet (accueils patient et médecin). */
  unified?: boolean;
  children?: ReactNode;
}) {
  return <div className={`dossier-group stack${unified ? " dossier-group--unified" : ""}`}>
    <section className={`card dossier ${className}`.trim()} aria-labelledby={titleId}>
      <div className="dossier__head">
        <AvatarBadge account={account} size={unified ? 72 : 56} />
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2 id={titleId}>{displayName(account)}</h2>
          {role && <p className="dossier__role"><Icon name="stethoscope" size={14} />{role}</p>}
        </div>
      </div>
      {rows && rows.length > 0 && <DossierRows rows={rows} />}
      {children}
      {unified && sections && sections.length > 0 && (
        <div className="dossier-inlines">
          {sections.map((section) => (
            <div className="dossier-inline" role="group" key={section.key} aria-labelledby={`${titleId}-${section.key}`}>
              <div className="dossier-inline__head">
                <span className="orb orb--sm" aria-hidden="true"><Icon name={section.icon} size={18} /></span>
                <div><h3 id={`${titleId}-${section.key}`}>{section.title}</h3>{section.hint && <small className="muted">{section.hint}</small>}</div>
              </div>
              <div className="dossier-inline__body">{section.content}</div>
            </div>
          ))}
        </div>
      )}
      {note && <p className="muted dossier__note">{note}</p>}
      {actions && <div className="actions">{actions}</div>}
    </section>
    {!unified && sections && sections.length > 0 && (
      <div className="dossier-sections">
        {sections.map((section) => (
          <section className="card dossier-section" key={section.key} aria-labelledby={`${titleId}-${section.key}`}>
            <div className="dossier-section__head">
              <span className="orb orb--sm" aria-hidden="true"><Icon name={section.icon} size={18} /></span>
              <div><h3 id={`${titleId}-${section.key}`}>{section.title}</h3>{section.hint && <small className="muted">{section.hint}</small>}</div>
            </div>
            <div className="dossier-section__body">{section.content}</div>
          </section>
        ))}
      </div>
    )}
    {tiles && tiles.length > 0 && (
      <div className="section-grid">
        {tiles.map((tile) => <CollapsibleSection key={tile.key} title={tile.title} icon={tile.icon} hint={tile.hint}>{tile.content}</CollapsibleSection>)}
      </div>
    )}
  </div>;
}

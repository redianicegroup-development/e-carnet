import type { ReactNode } from "react";
import { AvatarBadge, displayName, type SpaceAccount } from "./shell/SpaceShell";
import { Icon } from "./ui/Icon";
import "./dossier-card.css";

export type DossierRow = { label: string; value: ReactNode; wide?: boolean };

/** Lignes d'informations d'un dossier (libellé en gris, valeur en gras), deux colonnes sur grand écran. */
export function DossierRows({ rows }: { rows: DossierRow[] }) {
  return <dl className="dossier__list">
    {rows.map((row, index) => <div key={`${row.label}-${index}`} className={row.wide ? "dossier__wide" : undefined}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
  </dl>;
}

/** « Dossier médecin » et « Dossier patient » : même présentation. Photo, nom en titre, métier (si c'est un professionnel), puis les informations en lignes.
    `children` : blocs sous les lignes (cachet et signature, déclarations) ; `after` : après la note (la carte virtuelle, côté patient). */
export function DossierCard({ account, eyebrow, titleId, role, rows, note, actions, className = "", children, after }: {
  account: Pick<SpaceAccount, "first_name" | "last_name" | "email" | "avatar_url">;
  eyebrow: string;
  titleId: string;
  /** Métier (« Médecin · Cardiologie »), affiché sous le nom. */
  role?: string;
  rows: DossierRow[];
  note?: string;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
  after?: ReactNode;
}) {
  return <section className={`card dossier ${className}`.trim()} aria-labelledby={titleId}>
    <div className="dossier__head">
      <AvatarBadge account={account} size={56} />
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2 id={titleId}>{displayName(account)}</h2>
        {role && <p className="dossier__role"><Icon name="stethoscope" size={14} />{role}</p>}
      </div>
    </div>
    <DossierRows rows={rows} />
    {children}
    {note && <p className="muted dossier__note">{note}</p>}
    {after}
    {actions && <div className="actions">{actions}</div>}
  </section>;
}

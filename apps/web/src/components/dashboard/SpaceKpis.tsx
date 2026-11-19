"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "../ui/Icon";
import "../establishment-dashboard.css";
import "./space-dashboard.css";

/* Briques communes des accueils : la même carte « Stat » que le tableau de bord de l'établissement (EstablishmentDashboard l'utilise aussi),
   la même grille (2 colonnes sur téléphone, 4 sur grand écran) et des cartes de graphiques qui vivent dans cette grille.
   Les patients, les professionnels et les laboratoires ont donc exactement les mêmes indicateurs visuels que les établissements.
   Aucune couleur propre : tout vient des variables du thème (voir establishment-dashboard.css et space-dashboard.css). */

export type KpiStatProps = {
  label: string;
  icon: IconName;
  hint: ReactNode;
  /** `null` : pas encore chargé, indisponible ou sans objet : on affiche un tiret, jamais un zéro inventé. */
  value: number | string | null;
  /** Petit mot collé à la valeur (« jours »). */
  unit?: string;
  /** Valeur en toutes lettres (« Demain ») : taille de texte réduite pour tenir dans la carte. */
  wordy?: boolean;
  href?: string;
  featured?: boolean;
};

export function KpiStat({ label, icon, hint, value, unit, wordy = false, href, featured = false }: KpiStatProps) {
  const body = <>
    <span className="edash-stat__top"><span className="edash-stat__label">{label}</span>{href && <span className="edash-stat__go" aria-hidden="true"><Icon name="arrowUp" size={16} style={{ transform: "rotate(45deg)" }} /></span>}</span>
    <span className={`edash-stat__value${wordy ? " edash-stat__value--wordy" : ""}`}>{value === null ? "—" : value}{unit && value !== null && <span className="edash-stat__unit">{unit}</span>}</span>
    <span className="edash-stat__hint"><span className="edash-stat__chip" aria-hidden="true"><Icon name={icon} size={13} /></span>{hint}</span>
  </>;
  const className = `edash-card edash-stat${featured ? " edash-stat--featured" : ""}`;
  return href ? <Link className={`${className} is-link`} href={href}>{body}</Link> : <div className={className}>{body}</div>;
}

/** Bloc d'indicateurs : `.edash` porte les variables de couleur, `.edash__grid` la grille. Les enfants sont des `KpiStat` puis des `ChartCard`. */
export function KpiSection({ label, children }: { label: string; children: ReactNode }) {
  return <section className="edash space-kpis" aria-label={label}><div className="edash__grid">{children}</div></section>;
}

/** Carte de graphique : un titre, des réglages facultatifs, puis le graphique ; sans donnée, la carte le dit au lieu d'afficher un graphique vide. */
export function ChartCard({ title, subtitle, actions, empty, children }: { title: string; subtitle?: string; actions?: ReactNode; empty?: string | null; children?: ReactNode }) {
  return (
    <article className="edash-card space-chart">
      <div className="edash-card__bar"><h3 className="edash-card__title">{title}</h3>{actions}</div>
      {subtitle && <p className="space-chart__sub">{subtitle}</p>}
      {empty ? <p className="edash-card__note" role="status">{empty}</p> : children}
    </article>
  );
}

/** Deux ou trois choix côte à côte (« 7 jours / 30 jours »). */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="space-seg" role="group" aria-label={label}>
      {options.map((option) => <button key={option.value} type="button" className={`space-seg__btn${option.value === value ? " is-on" : ""}`} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}
    </div>
  );
}

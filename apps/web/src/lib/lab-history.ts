/* PRO-21 — Historique des dépôts du laboratoire : libellés, période, regroupement par jour.
   Logique pure (aucun React, aucun appel réseau) : elle ne travaille que sur les lignes déjà reçues de l'API, qui ne contiennent ni nom
   complet ni contenu de fichier (initiales, année de naissance, libellé de l'examen). */
import { PERIOD_CHOICES, type Period } from "./list-filter";

export type LabStatus = "deposited" | "replaced" | "abandoned";
export const LAB_STATUSES: readonly LabStatus[] = ["deposited", "replaced", "abandoned"];
export const STATUS_LABEL: Record<LabStatus, string> = { deposited: "Déposé", replaced: "Remplacé", abandoned: "Abandonné" };
export const STATUS_PLURAL: Record<LabStatus, string> = { deposited: "Déposés", replaced: "Remplacés", abandoned: "Abandonnés" };
export const KIND_LABEL: Record<string, string> = { analysis: "Analyse", imaging: "Imagerie", other: "Autre examen" };

const two = (value: number) => String(value).padStart(2, "0");

/** AAAA-MM-JJ du jour LOCAL de l'appareil (pas celui d'UTC) : c'est la date que lit la personne au laboratoire. */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

/** Début (inclus) envoyé à l'API pour une période relative ; « Toute la période » : aucun filtre de date. */
export function periodStart(period: Period, now: Date = new Date()): string | undefined {
  const days = PERIOD_CHOICES.find((choice) => choice.value === period)?.days ?? null;
  if (days === null) return undefined;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return localDay(start);
}

export function dayLabel(day: string, now: Date = new Date()): string {
  if (day === localDay(now)) return "Aujourd’hui";
  if (day === localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return "Hier";
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(year, month - 1, date));
}

export function timeLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : `${two(date.getHours())}:${two(date.getMinutes())}`;
}

export type DayGroup<T> = { day: string; label: string; items: T[] };

/** Regroupe par jour local en gardant l'ordre reçu (le plus récent d'abord). Une date illisible est ignorée plutôt que mal classée. */
export function groupByDay<T extends { occurred_at: string }>(items: readonly T[], now: Date = new Date()): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const date = new Date(item.occurred_at);
    if (Number.isNaN(date.getTime())) continue;
    const day = localDay(date);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, label: dayLabel(day, now), items: [item] });
  }
  return groups;
}

/** « A. K. · né(e) en 1990 » : de quoi distinguer deux patients sans jamais afficher le nom complet. */
export function whoLine(item: { patient_initials: string; birth_year: number | null }): string {
  return [item.patient_initials || "Patient", item.birth_year ? `né(e) en ${item.birth_year}` : ""].filter(Boolean).join(" · ");
}

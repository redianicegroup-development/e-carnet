/* KPI des accueils (patient, professionnel, laboratoire) : calculs purs, sans React ni appel réseau.
   Ils ne travaillent que sur des dates et des statuts déjà reçus de l'API ; les jours et les mois sont ceux de l'appareil (heure locale),
   comme dans l'historique des dépôts du laboratoire. Une valeur inconnue n'est jamais transformée en zéro : c'est l'affaire de l'écran. */

export type Bucket = { key: string; label: string; title: string; count: number };

type MaybeDate = string | null | undefined;

const DAY_MS = 86_400_000;
const two = (value: number) => String(value).padStart(2, "0");
const dayKey = (date: Date) => `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
const monthKey = (date: Date) => `${date.getFullYear()}-${two(date.getMonth() + 1)}`;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const mondayOf = (date: Date) => {
  const start = startOfDay(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
};

const shortMonth = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const shortWeekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "numeric" });
const dayLongMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const fullDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const monthYear = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const noDot = (text: string) => text.replace(/\.$/, "");

export function toDate(value: MaybeDate): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function bucketize(dates: readonly MaybeDate[], starts: Date[], keyOf: (date: Date) => string, label: (date: Date) => string, title: (date: Date) => string): Bucket[] {
  const buckets: Bucket[] = starts.map((start) => ({ key: keyOf(start), label: label(start), title: title(start), count: 0 }));
  const position = new Map<string, number>(buckets.map((bucket, index) => [bucket.key, index]));
  for (const value of dates) {
    const date = toDate(value);
    if (!date) continue;
    const index = position.get(keyOf(date));
    const bucket = index === undefined ? undefined : buckets[index];
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

/** Les `months` derniers mois civils, le mois en cours en dernier. */
export function monthBuckets(dates: readonly MaybeDate[], months = 6, now: Date = new Date()): Bucket[] {
  const starts = Array.from({ length: months }, (_, index) => new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1));
  return bucketize(dates, starts, monthKey, (date) => noDot(shortMonth.format(date)), (date) => monthYear.format(date));
}

/** Les `weeks` dernières semaines (du lundi au dimanche), la semaine en cours en dernière ; l'étiquette est le jour du lundi. */
export function weekBuckets(dates: readonly MaybeDate[], weeks = 8, now: Date = new Date()): Bucket[] {
  const monday = mondayOf(now);
  const starts = Array.from({ length: weeks }, (_, index) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * (weeks - 1 - index)));
  return bucketize(dates, starts, (date) => dayKey(mondayOf(date)), (date) => dayMonth.format(date), (date) => `Semaine du ${dayLongMonth.format(date)}`);
}

/** Les `days` derniers jours, aujourd'hui en dernier. Jusqu'à 7 jours l'étiquette est le jour de la semaine, au-delà c'est jour/mois. */
export function dayBuckets(dates: readonly MaybeDate[], days = 7, now: Date = new Date()): Bucket[] {
  const starts = Array.from({ length: days }, (_, index) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - index)));
  return bucketize(dates, starts, dayKey, (date) => (days <= 7 ? noDot(shortWeekday.format(date)) : dayMonth.format(date)), (date) => fullDay.format(date));
}

export const total = (buckets: readonly Bucket[]): number => buckets.reduce((sum, bucket) => sum + bucket.count, 0);

/** « +3 vs mois dernier », « −2 vs mois dernier » ou « Stable vs mois dernier ». */
export function compareHint(current: number, previous: number, reference = "mois dernier"): string {
  const gap = current - previous;
  if (gap === 0) return `Stable vs ${reference}`;
  return `${gap > 0 ? "+" : "−"}${Math.abs(gap)} vs ${reference}`;
}

/** Nombre de jours civils entre aujourd'hui et la date (0 = aujourd'hui, 1 = demain) ; `null` si la date est illisible. */
export function daysUntil(value: MaybeDate, now: Date = new Date()): number | null {
  const date = toDate(value);
  if (!date) return null;
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

/** Le prochain rendez-vous : ni annulé ni terminé, pas encore commencé, le plus proche. */
export function nextUpcoming<T extends { starts_at: string; status: string }>(items: readonly T[], now: Date = new Date()): T | null {
  let best: T | null = null;
  let bestTime = Number.POSITIVE_INFINITY;
  for (const item of items) {
    if (item.status === "cancelled" || item.status === "completed") continue;
    const date = toDate(item.starts_at);
    if (!date) continue;
    const time = date.getTime();
    if (time < now.getTime() || time >= bestTime) continue;
    best = item;
    bestTime = time;
  }
  return best;
}

/** Ce qu'affiche la grosse valeur d'un KPI de délai : un mot (« Aujourd'hui », « Demain ») ou un nombre de jours. */
export function whenParts(days: number): { value: string; unit?: string; wordy: boolean } {
  if (days <= 0) return { value: "Aujourd’hui", wordy: true };
  if (days === 1) return { value: "Demain", wordy: true };
  return { value: String(days), unit: "jours", wordy: false };
}

/** Compte les éléments par clé (ex. type d'examen). */
export function tally<T>(items: readonly T[], keyOf: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyOf(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export const plural = (count: number, one: string, many: string = `${one}s`): string => (count > 1 ? many : one);

/* PRO-16 — Recherche et filtres dans les listes du professionnel.
   Logique pure (aucun React, aucun appel réseau) : elle ne travaille que sur des lignes DÉJÀ chargées
   depuis une liste autorisée (consultations validées, rendez-vous, adressages reçus, patients récents).
   Il n'existe volontairement AUCUNE recherche globale de patients : un champ de recherche ne peut jamais
   faire apparaître un patient qui n'est pas déjà dans la liste affichée. */

/** Minuscules, sans accents ni ligatures, espaces compactés : « Hélène » et « helene » se confondent. */
export function normalizeForSearch(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .toLocaleLowerCase("fr")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tous les mots saisis doivent se retrouver (dans n'importe quel ordre) dans le texte de la ligne. Recherche vide = tout passe. */
export function matchesQuery(fields: ReadonlyArray<string | null | undefined>, query: string): boolean {
  const needle = normalizeForSearch(query);
  if (!needle) return true;
  const haystack = normalizeForSearch(fields.filter(Boolean).join(" "));
  return needle.split(" ").every((word) => haystack.includes(word));
}

export type Period = "all" | "7d" | "30d" | "90d";

export const PERIOD_CHOICES: ReadonlyArray<{ value: Period; label: string; days: number | null }> = [
  { value: "all", label: "Toute la période", days: null },
  { value: "7d", label: "7 derniers jours", days: 7 },
  { value: "30d", label: "30 derniers jours", days: 30 },
  { value: "90d", label: "90 derniers jours", days: 90 },
];

export function isPeriod(value: string): value is Period {
  return PERIOD_CHOICES.some((choice) => choice.value === value);
}

/** Vrai si la date (ISO) tombe dans la période. Une date absente ou illisible n'est jamais cachée par « Toute la période ». */
export function withinPeriod(value: string | null | undefined, period: Period, now: Date = new Date()): boolean {
  const days = PERIOD_CHOICES.find((choice) => choice.value === period)?.days ?? null;
  if (days === null) return true;
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return time >= now.getTime() - days * 86_400_000 && time <= now.getTime() + 86_400_000;
}

/** Valeurs distinctes (sans accents ni casse, première graphie conservée), triées — pour un filtre « établissement » construit sur les lignes chargées. */
export function distinctOptions(values: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Map<string, string>();
  for (const raw of values) {
    const label = (raw ?? "").trim();
    if (!label) continue;
    const key = normalizeForSearch(label);
    if (!seen.has(key)) seen.set(key, label);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

export function sameOption(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeForSearch(a) === normalizeForSearch(b);
}

export type ListFilterState = { query: string; status: string; period: Period; facility: string };

export const EMPTY_FILTERS: ListFilterState = { query: "", status: "", period: "all", facility: "" };

export function hasActiveFilter(state: ListFilterState): boolean {
  return normalizeForSearch(state.query) !== "" || state.status !== "" || state.period !== "all" || state.facility !== "";
}

/** Phrase lue par un lecteur d'écran quand le résultat change. Une seule ligne, au singulier ou au pluriel selon le cas. */
export function resultsAnnouncement(shown: number, total: number, filtered: boolean): string {
  if (total === 0) return "Aucun élément dans cette liste.";
  if (!filtered) return total === 1 ? "1 élément affiché." : `${total} éléments affichés.`;
  if (shown === 0) return "Aucun résultat pour cette recherche.";
  return shown === 1 ? `1 résultat sur ${total}.` : `${shown} résultats sur ${total}.`;
}

/** Faut-il réagir au raccourci « / » ? Jamais pendant une saisie ni sur mobile (le clavier tactile n'a pas de raccourci). */
export function isSearchShortcut(event: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }, editing: boolean, wideScreen: boolean): boolean {
  return event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !editing && wideScreen;
}

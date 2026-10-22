/* Pré-consultation du patient : symptômes à cocher + texte libre, listes de valeurs pour poids, taille et température.
   Fichier pur (sans React) pour pouvoir être testé.

   Aucun nouveau champ côté serveur : les symptômes cochés et le texte libre sont rangés dans `observations`
   (« Symptômes : Fièvre, Toux » puis une ligne « Autres : … »), et relus à l'identique pour modifier le brouillon.
   Le médecin lit donc un texte normal, et les anciens brouillons (texte seul) restent lisibles : tout leur texte devient le champ libre. */
import type { VitalKey } from "./vitals";

export const SYMPTOMS = [
  "Fièvre", "Toux", "Maux de tête", "Fatigue", "Douleurs abdominales", "Diarrhée", "Vomissements", "Nausées",
  "Douleurs musculaires ou articulaires", "Frissons", "Essoufflement", "Douleur à la poitrine", "Mal de gorge", "Nez qui coule ou bouché",
  "Vertiges", "Perte d’appétit", "Douleur en urinant", "Éruption ou démangeaisons", "Douleur au dos", "Maux d’oreille",
] as const;
export type Symptom = (typeof SYMPTOMS)[number];

export const SYMPTOMS_LABEL = "Symptômes : ";
export const OTHER_LABEL = "Autres : ";
/** Limite côté serveur : 4000 caractères ; on reste bien en dessous. */
export const OBSERVATIONS_MAX = 2000;
export const OTHER_MAX = 1500;

export type SymptomsForm = { selected: string[]; other: string };

/** Texte enregistré dans `observations`. Les symptômes cochés gardent l'ordre de la liste, pas l'ordre des clics. */
export function buildObservations({ selected, other }: SymptomsForm): string {
  const known = SYMPTOMS.filter((symptom) => selected.includes(symptom));
  const lines: string[] = [];
  if (known.length) lines.push(`${SYMPTOMS_LABEL}${known.join(", ")}`);
  const free = other.trim();
  if (free) lines.push(known.length ? `${OTHER_LABEL}${free}` : free);
  return lines.join("\n");
}

/** Relit `observations` : reconnaît la ligne « Symptômes : … » ; tout le reste (y compris un ancien texte libre) revient dans le champ libre. */
export function parseObservations(text: string | null | undefined): SymptomsForm {
  const value = (text ?? "").replace(/\r\n/g, "\n").trim();
  if (!value) return { selected: [], other: "" };
  const lines = value.split("\n");
  const first = lines[0] ?? "";
  if (!first.startsWith(SYMPTOMS_LABEL)) return { selected: [], other: value };
  const listed = first.slice(SYMPTOMS_LABEL.length).split(",").map((item) => item.trim()).filter(Boolean);
  const selected = SYMPTOMS.filter((symptom) => listed.includes(symptom)) as string[];
  const unknown = listed.filter((item) => !(SYMPTOMS as readonly string[]).includes(item));
  let rest = lines.slice(1).join("\n").trim();
  if (rest.startsWith(OTHER_LABEL)) rest = rest.slice(OTHER_LABEL.length).trim();
  // Un symptôme qui n'est plus dans la liste n'est jamais perdu : il passe dans le champ libre.
  const other = [unknown.join(", "), rest].filter(Boolean).join("\n");
  return { selected, other };
}

export type SelectOption = { value: string; label: string };

const RANGES: Partial<Record<VitalKey, { from: number; to: number; step: number; decimals: number }>> = {
  weight_kg: { from: 1, to: 200, step: 1, decimals: 0 },
  height_cm: { from: 40, to: 220, step: 1, decimals: 0 },
  temperature_c: { from: 34, to: 42, step: 0.1, decimals: 1 },
};

/** Vrai pour les constantes qui se choisissent dans une liste (poids, taille, température). */
export function isListed(key: VitalKey): boolean {
  return key in RANGES;
}

/** Valeurs de la liste. Une valeur déjà enregistrée (ancien brouillon, 61,5 kg…) est ajoutée pour ne jamais être perdue en modifiant. */
export function numberOptions(key: VitalKey, current = ""): SelectOption[] {
  const range = RANGES[key];
  if (!range) return [];
  const count = Math.round((range.to - range.from) / range.step);
  const options: SelectOption[] = [];
  for (let index = 0; index <= count; index++) {
    const value = (range.from + index * range.step).toFixed(range.decimals);
    options.push({ value, label: range.decimals ? value.replace(".", ",") : value });
  }
  const kept = current.trim().replace(",", ".");
  if (kept && Number.isFinite(Number(kept)) && !options.some((option) => Number(option.value) === Number(kept))) {
    options.push({ value: kept, label: kept.replace(".", ",") });
    options.sort((a, b) => Number(a.value) - Number(b.value));
  }
  return options;
}

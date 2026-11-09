/** UX-01 : « Aucune allergie » et « Je ne sais pas » sont des choix, pas du texte libre.
 *  Une liste d'allergies vide ne veut rien dire pour un soignant (pas renseigné ? aucune ?). Le patient choisit donc l'un
 *  des trois états ; les deux libellés ci-dessous sont les mêmes que côté API (apps/patients/allergy_rules.py). */
export const ALLERGY_NONE_LABEL = "Aucune allergie connue";
export const ALLERGY_UNKNOWN_LABEL = "Je ne sais pas";
export const ALLERGY_NEGATION_MESSAGE = "Pour dire que vous n’avez aucune allergie, choisissez « Aucune allergie connue ». Sinon, indiquez le nom de l’allergie.";

export type AllergyMode = "listed" | "none" | "unknown";

export function allergyStateLabel(mode: AllergyMode): string {
  return mode === "none" ? ALLERGY_NONE_LABEL : mode === "unknown" ? ALLERGY_UNKNOWN_LABEL : "";
}

export function isAllergyState(label: string): boolean {
  return label === ALLERGY_NONE_LABEL || label === ALLERGY_UNKNOWN_LABEL;
}

/** Minuscules, sans accents, apostrophes et ponctuation ramenées à des espaces : « Je n’es pas » → « je n es pas ». */
export function normaliseAllergyText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`´]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SINGLE_WORD_NEGATIONS = new Set(["non", "nan", "no", "nope", "rien", "aucun", "aucune", "neant", "ras", "r a s", "pas", "nul", "nulle", "sans"]);
const NEGATION_PREFIXES = [
  /^(je )?n (ai|es|est|ais|a|y a) (pas|rien|aucun|aucune)\b/, // je n'ai pas…, je n'es pas… (faute courante), n'a pas…
  /^j ai (pas|rien|aucun|aucune)\b/,
  /^(je )?(ne )?sais (pas|rien)\b/,
  /^(je )?(ne )?connais (pas|aucun|aucune)\b/,
  /^(pas|aucune?) (d|de|dallergie|allergie|allergies)\b/,
  /^(sans|aucune?) allergi/,
  /^rien (a signaler|connu)\b/,
  /^(non )?(merci|connue?)$/,
];

/** Vrai si le texte dit « je n'ai pas d'allergie » (ou « je ne sais pas ») au lieu de nommer une allergie. Les libellés exacts des deux choix ne comptent pas. */
export function looksLikeAllergyNegation(label: string): boolean {
  if (isAllergyState(label.trim())) return false;
  const text = normaliseAllergyText(label);
  if (!text) return false;
  return SINGLE_WORD_NEGATIONS.has(text) || NEGATION_PREFIXES.some((pattern) => pattern.test(text));
}

/** Date de la déclaration la plus récente (« 12/10/2026 »), ou « » si aucune n'est datée. */
export function latestDeclaredOn(items: readonly { declared_at?: string }[], locale = "fr-FR"): string {
  const times = items.map((item) => (item.declared_at ? Date.parse(item.declared_at) : Number.NaN)).filter((time) => Number.isFinite(time));
  if (!times.length) return "";
  return new Date(Math.max(...times)).toLocaleDateString(locale);
}

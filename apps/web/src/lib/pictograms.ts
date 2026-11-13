/* PAT-20 — Pictogrammes : de petits dessins qui accompagnent le texte (jamais à sa place) pour aider celles et ceux qui lisent peu.
   Logique pure : le dessin (SVG intégré, aucune image à télécharger) est dans components/ui/Pictogram.tsx. */

export const PICTOGRAM_NAMES = ["fever", "cough", "breath", "head", "stomach", "heart", "pill", "syringe", "drop", "gauge", "scale", "calendar", "alert"] as const;
export type PictogramName = (typeof PICTOGRAM_NAMES)[number];

/** Texte alternatif : ce que lit un lecteur d'écran quand le pictogramme est seul. */
export const PICTOGRAM_LABELS: Record<PictogramName, string> = {
  fever: "Thermomètre : fièvre ou température",
  cough: "Toux",
  breath: "Poumons : respiration",
  head: "Tête",
  stomach: "Ventre",
  heart: "Cœur",
  pill: "Médicament",
  syringe: "Seringue : vaccin",
  drop: "Goutte de sang : glycémie",
  gauge: "Cadran : tension",
  scale: "Balance : poids",
  calendar: "Calendrier : rendez-vous",
  alert: "Attention : urgence",
};

/** Symptôme de la pré-consultation → pictogramme (les symptômes sans dessin adapté n'en ont pas). */
export const SYMPTOM_PICTOGRAMS: Readonly<Record<string, PictogramName>> = {
  "Fièvre": "fever",
  "Frissons": "fever",
  "Toux": "cough",
  "Essoufflement": "breath",
  "Maux de tête": "head",
  "Vertiges": "head",
  "Douleurs abdominales": "stomach",
  "Diarrhée": "stomach",
  "Vomissements": "stomach",
  "Nausées": "stomach",
  "Douleur à la poitrine": "heart",
};

/** Type de mesure → pictogramme. */
export const MEASUREMENT_PICTOGRAMS: Readonly<Record<string, PictogramName>> = {
  temperature: "fever",
  heart_rate: "heart",
  spo2: "breath",
  blood_pressure: "gauge",
  glycemia: "drop",
  weight: "scale",
};

export function pictogramFor(map: Readonly<Record<string, PictogramName>>, key: string): PictogramName | null {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
}

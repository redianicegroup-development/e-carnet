/* Constantes de la pré-consultation et de la consultation (poids, température, tension…).
   Les bornes reprennent celles du serveur (apps/api/apps/care/vitals.py) : elles écartent les fautes de frappe, ce ne sont pas des seuils
   cliniques. Le serveur reste l'autorité ; ce module évite seulement un aller-retour pour une virgule mal placée. */

export type VitalKey = "weight_kg" | "height_cm" | "temperature_c" | "systolic" | "diastolic" | "heart_rate" | "spo2" | "glycemia_g_l";
export type VitalSource = "preconsultation" | "professional";
export type VitalsForm = Record<VitalKey, string>;
export type StoredVitals = Partial<Record<VitalKey, number | null>>;
export type ConsultationVitals = Partial<Record<VitalKey, { value: number; source: VitalSource } | null>>;

export type VitalField = { key: VitalKey; label: string; unit: string; step: string; min: number; max: number; decimals: number };

export const VITAL_FIELDS: readonly VitalField[] = [
  { key: "weight_kg", label: "Poids", unit: "kg", step: "0.1", min: 0.3, max: 400, decimals: 1 },
  { key: "height_cm", label: "Taille", unit: "cm", step: "0.1", min: 20, max: 260, decimals: 1 },
  { key: "temperature_c", label: "Température", unit: "°C", step: "0.1", min: 25, max: 45, decimals: 1 },
  { key: "systolic", label: "Tension maximale", unit: "mmHg", step: "1", min: 40, max: 300, decimals: 0 },
  { key: "diastolic", label: "Tension minimale", unit: "mmHg", step: "1", min: 20, max: 200, decimals: 0 },
  { key: "heart_rate", label: "Fréquence cardiaque", unit: "bpm", step: "1", min: 20, max: 300, decimals: 0 },
  { key: "spo2", label: "Saturation SpO₂", unit: "%", step: "1", min: 30, max: 100, decimals: 0 },
  { key: "glycemia_g_l", label: "Glycémie", unit: "g/L", step: "0.01", min: 0.1, max: 15, decimals: 2 },
];

export const VITAL_SOURCE_LABELS: Record<VitalSource, string> = {
  preconsultation: "Relevée en pré-consultation",
  professional: "Mesurée par le médecin",
};

export function emptyVitalsForm(): VitalsForm {
  return { weight_kg: "", height_cm: "", temperature_c: "", systolic: "", diastolic: "", heart_rate: "", spo2: "", glycemia_g_l: "" };
}

/** Valeurs du serveur → champs de formulaire. Une constante absente ou nulle donne un champ vide : jamais « 0 » par défaut. */
export function vitalsToForm(stored: StoredVitals | null | undefined): VitalsForm {
  const form = emptyVitalsForm();
  for (const field of VITAL_FIELDS) {
    const value = stored?.[field.key];
    if (typeof value === "number") form[field.key] = String(value);
  }
  return form;
}

export type VitalsParse = { ok: true; vitals: Partial<Record<VitalKey, number>> } | { ok: false; message: string };

/** Champs de formulaire → jeu de constantes à envoyer. Les champs vides sont ignorés, la virgule décimale est acceptée. */
export function parseVitalsForm(form: VitalsForm): VitalsParse {
  const vitals: Partial<Record<VitalKey, number>> = {};
  for (const field of VITAL_FIELDS) {
    const raw = form[field.key].trim().replace(",", ".");
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < field.min || value > field.max) {
      return { ok: false, message: `${field.label} : saisissez une valeur entre ${field.min} et ${field.max} ${field.unit}, ou laissez vide.` };
    }
    vitals[field.key] = Number(value.toFixed(field.decimals));
  }
  if ((vitals.systolic === undefined) !== (vitals.diastolic === undefined)) {
    return { ok: false, message: "Tension : saisissez la maximale et la minimale, ou aucune des deux." };
  }
  if (vitals.systolic !== undefined && vitals.diastolic !== undefined && vitals.systolic <= vitals.diastolic) {
    return { ok: false, message: "Tension : la maximale doit être supérieure à la minimale." };
  }
  return { ok: true, vitals };
}

const NUMBER_FORMAT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

export type VitalLine = { key: string; label: string; text: string; source?: VitalSource };

/** Lignes lisibles (« Poids · 61 kg », « Tension · 110/70 mmHg ») pour les constantes réellement mesurées, dans l'ordre du carnet. */
export function describeVitals(stored: StoredVitals | ConsultationVitals | null | undefined): VitalLine[] {
  if (!stored) return [];
  const read = (key: VitalKey): { value: number; source?: VitalSource } | null => {
    const entry = stored[key];
    if (entry === null || entry === undefined) return null;
    return typeof entry === "number" ? { value: entry } : { value: entry.value, source: entry.source };
  };
  const lines: VitalLine[] = [];
  for (const field of VITAL_FIELDS) {
    if (field.key === "systolic" || field.key === "diastolic") continue;
    const entry = read(field.key);
    if (entry) lines.push({ key: field.key, label: field.label, text: `${NUMBER_FORMAT.format(entry.value)} ${field.unit}`, source: entry.source });
  }
  const systolic = read("systolic");
  const diastolic = read("diastolic");
  if (systolic && diastolic) {
    const tension: VitalLine = { key: "tension", label: "Tension", text: `${systolic.value}/${diastolic.value} mmHg`, source: systolic.source };
    // La tension s'affiche après la température, comme sur la page « Visites » du carnet papier.
    const afterTemperature = lines.findIndex((line) => line.key === "temperature_c") + 1;
    lines.splice(afterTemperature || lines.length, 0, tension);
  }
  return lines;
}

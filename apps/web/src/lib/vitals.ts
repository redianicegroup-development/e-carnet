/* Constantes de la pré-consultation, de la consultation et du carnet patient.
   Tension et glycémie sont conservées telles qu'écrites; le serveur ne convertit ni n'invente d'unité. */

export type VitalKey = "weight_kg" | "height_cm" | "temperature_c" | "blood_pressure" | "heart_rate" | "spo2" | "glycemia";
export type VitalSource = "preconsultation" | "professional";
export type VitalsForm = Record<VitalKey, string>;
export type VitalValue = number | string;
export type StoredVitals = Partial<Record<VitalKey, VitalValue | null>> & {
  /** Compatibilité d'affichage transitoire avec les réponses des anciens serveurs. */
  systolic?: number | null;
  diastolic?: number | null;
  glycemia_g_l?: number | null;
};
export type ConsultationVitals = Partial<Record<VitalKey, { value: VitalValue; source: VitalSource } | null>>;
export type VitalField = {
  key: VitalKey;
  label: string;
  unit: string;
  freeText?: boolean;
  step?: string;
  min?: number;
  max?: number;
  decimals?: number;
  placeholder?: string;
};
export type VitalPayload = Partial<Record<VitalKey, number | string>>;

export const VITAL_FIELDS: readonly VitalField[] = [
  { key: "weight_kg", label: "Poids", unit: "kg", step: "0.1", min: 0.3, max: 400, decimals: 1 },
  { key: "height_cm", label: "Taille", unit: "cm", step: "0.1", min: 20, max: 260, decimals: 1 },
  { key: "temperature_c", label: "Température", unit: "°C", step: "0.1", min: 25, max: 45, decimals: 1 },
  { key: "blood_pressure", label: "Tension", unit: "", freeText: true, placeholder: "Ex. 12/8 ou 120/80 mmHg" },
  { key: "heart_rate", label: "Fréquence cardiaque", unit: "bpm", step: "1", min: 20, max: 300, decimals: 0 },
  { key: "spo2", label: "Saturation SpO₂", unit: "%", step: "1", min: 30, max: 100, decimals: 0 },
  { key: "glycemia", label: "Glycémie", unit: "", freeText: true, placeholder: "Ex. 0,9 g/L ou 5,2 mmol/L" },
];

export const VITAL_SOURCE_LABELS: Record<VitalSource, string> = {
  preconsultation: "Relevée en pré-consultation",
  professional: "Mesurée par le médecin",
};

export function emptyVitalsForm(): VitalsForm {
  return { weight_kg: "", height_cm: "", temperature_c: "", blood_pressure: "", heart_rate: "", spo2: "", glycemia: "" };
}

function legacyBloodPressure(stored: StoredVitals): string {
  const systolic = stored.systolic;
  const diastolic = stored.diastolic;
  if (systolic != null && diastolic != null) return `${systolic}/${diastolic}`;
  if (systolic != null) return `Systolique : ${systolic}`;
  if (diastolic != null) return `Diastolique : ${diastolic}`;
  return "";
}

/** Valeurs serveur → formulaire. Les champs absents/nuls restent vides, jamais « 0 » par défaut. */
export function vitalsToForm(stored: StoredVitals | null | undefined): VitalsForm {
  const form = emptyVitalsForm();
  if (!stored) return form;
  for (const field of VITAL_FIELDS) {
    const value = stored[field.key];
    if (typeof value === "number" || typeof value === "string") form[field.key] = String(value);
  }
  if (!form.blood_pressure) form.blood_pressure = legacyBloodPressure(stored);
  if (!form.glycemia && stored.glycemia_g_l != null) form.glycemia = `${stored.glycemia_g_l} g/L`;
  return form;
}

export type VitalsParse = { ok: true; vitals: VitalPayload } | { ok: false; message: string };

/** Les champs texte sont gardés tels que saisis; les champs numériques acceptent la virgule décimale et leurs bornes. */
export function parseVitalsForm(form: VitalsForm): VitalsParse {
  const vitals: VitalPayload = {};
  for (const field of VITAL_FIELDS) {
    const raw = form[field.key].trim();
    if (!raw) continue;
    if (field.freeText) {
      if (raw.length > 24) return { ok: false, message: `${field.label} : limitez la saisie à 24 caractères.` };
      if (!/\d/.test(raw)) return { ok: false, message: `${field.label} : indiquez une valeur contenant au moins un chiffre, ou laissez vide.` };
      vitals[field.key] = raw;
      continue;
    }
    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value) || value < (field.min ?? 0) || value > (field.max ?? Number.MAX_SAFE_INTEGER)) {
      return { ok: false, message: `${field.label} : saisissez une valeur entre ${field.min} et ${field.max} ${field.unit}, ou laissez vide.` };
    }
    const decimals = field.decimals ?? 0;
    vitals[field.key] = Number(value.toFixed(decimals));
  }
  return { ok: true, vitals };
}

const NUMBER_FORMAT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
type VitalEntry = { value: VitalValue; source?: VitalSource };
export type VitalLine = { key: string; label: string; text: string; source?: VitalSource };

/** Lignes lisibles pour les constantes renseignées, sans normaliser tension ou glycémie. */
export function describeVitals(stored: StoredVitals | ConsultationVitals | null | undefined): VitalLine[] {
  if (!stored) return [];
  const read = (key: VitalKey): VitalEntry | null => {
    const entry = stored[key];
    if (entry === null || entry === undefined) return null;
    if (typeof entry === "object" && "value" in entry) return { value: entry.value, source: entry.source };
    return { value: entry as VitalValue };
  };
  const lines: VitalLine[] = [];
  for (const field of VITAL_FIELDS) {
    let entry = read(field.key);
    if (!entry && field.key === "blood_pressure") {
      const legacy = stored as StoredVitals;
      const text = legacyBloodPressure(legacy);
      if (text) entry = { value: text };
    }
    if (!entry && field.key === "glycemia") {
      const legacyValue = (stored as StoredVitals).glycemia_g_l;
      if (legacyValue != null) entry = { value: `${legacyValue} g/L` };
    }
    if (!entry) continue;
    const displayValue = typeof entry.value === "number" ? NUMBER_FORMAT.format(entry.value) : entry.value;
    const unit = field.unit && !field.freeText ? ` ${field.unit}` : "";
    lines.push({ key: field.key, label: field.label, text: `${displayValue}${unit}`, source: entry.source });
  }
  return lines;
}

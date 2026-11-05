export type MeasurementKind =
  | "temperature"
  | "heart_rate"
  | "spo2"
  | "blood_pressure"
  | "glycemia"
  | "weight"
  | "height";

export type MeasurementType = {
  value: MeasurementKind;
  label: string;
  unit: string;
  freeText: boolean;
  step?: string;
  min?: number;
  max?: number;
  placeholder?: string;
};

/** Référentiel partagé ; les bornes sont des contraintes techniques du formulaire, pas des seuils médicaux. */
export const MEASUREMENT_TYPES: readonly MeasurementType[] = [
  { value: "temperature", label: "Température", unit: "°C", freeText: false, step: "0.1", min: 25, max: 45 },
  { value: "heart_rate", label: "Pouls", unit: "bpm", freeText: false, step: "1", min: 20, max: 300 },
  { value: "spo2", label: "Saturation SpO₂", unit: "%", freeText: false, step: "1", min: 30, max: 100 },
  { value: "blood_pressure", label: "Tension", unit: "", freeText: true, placeholder: "Ex. 12/8 ou 120/80 mmHg" },
  { value: "glycemia", label: "Glycémie", unit: "", freeText: true, placeholder: "Ex. 0,9 g/L ou 5,2 mmol/L" },
  { value: "weight", label: "Poids", unit: "kg", freeText: false, step: "0.1", min: 0.5, max: 400 },
  { value: "height", label: "Taille", unit: "cm", freeText: false, step: "0.1", min: 20, max: 260 },
];

export type PatientMeasurementKind = Exclude<MeasurementKind, "weight" | "height">;
/** Le patient conserve son parcours actuel : poids et taille de référence se déclarent dans son profil. */
export const PATIENT_MEASUREMENT_TYPES: readonly MeasurementType[] = MEASUREMENT_TYPES.filter(
  (item) => item.value !== "weight" && item.value !== "height",
);

export type HealthMeasurementRecord = {
  id: string;
  kind: string;
  kind_label: string;
  value: string | number;
  unit: string;
  source: "measured" | "declared";
  source_label: string;
  measured_at: string;
  note: string;
  professional_name?: string | null;
};

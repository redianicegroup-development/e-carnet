// Constantes, identité du titulaire et fiche de visite : logique pure (bornes, virgule décimale, tension) et branchement des écrans.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;
const read = (rel) => readFileSync(`${root}${rel}`, "utf8");
const vitals = await import("../src/lib/vitals.ts");

test("un formulaire vide ne produit aucune constante : rien n'est supposé", () => {
  const parsed = vitals.parseVitalsForm(vitals.emptyVitalsForm());
  assert.deepEqual(parsed, { ok: true, vitals: {} });
});

test("la virgule décimale est acceptée et les valeurs sont arrondies comme côté serveur", () => {
  const form = { ...vitals.emptyVitalsForm(), weight_kg: "61,04", temperature_c: "38,54", glycemia_g_l: "0,9", heart_rate: "88" };
  const parsed = vitals.parseVitalsForm(form);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.vitals, { weight_kg: 61, temperature_c: 38.5, glycemia_g_l: 0.9, heart_rate: 88 });
});

test("une valeur impossible est refusée en nommant la constante", () => {
  for (const [key, value, label] of [["temperature_c", "3,7", "Température"], ["weight_kg", "610", "Poids"], ["spo2", "140", "Saturation"], ["heart_rate", "abc", "Fréquence"]]) {
    const parsed = vitals.parseVitalsForm({ ...vitals.emptyVitalsForm(), [key]: value });
    assert.equal(parsed.ok, false, key);
    assert.match(parsed.message, new RegExp(label));
  }
});

test("la tension exige les deux valeurs, la maximale au-dessus de la minimale", () => {
  const base = vitals.emptyVitalsForm();
  assert.equal(vitals.parseVitalsForm({ ...base, systolic: "110" }).ok, false);
  assert.equal(vitals.parseVitalsForm({ ...base, systolic: "70", diastolic: "110" }).ok, false);
  assert.deepEqual(vitals.parseVitalsForm({ ...base, systolic: "110", diastolic: "70" }).vitals, { systolic: 110, diastolic: 70 });
});

test("les constantes du serveur reviennent dans le formulaire, les nulles restent vides", () => {
  const form = vitals.vitalsToForm({ weight_kg: 61, temperature_c: null, systolic: 110, diastolic: 70 });
  assert.equal(form.weight_kg, "61");
  assert.equal(form.temperature_c, "");
  assert.equal(form.spo2, "");
});

test("l'affichage ne liste que les constantes mesurées, la tension en « max/min » après la température", () => {
  const lines = vitals.describeVitals({ weight_kg: 61, temperature_c: 38.5, systolic: 110, diastolic: 70, spo2: null });
  assert.deepEqual(lines.map((line) => line.key), ["weight_kg", "temperature_c", "tension"]);
  assert.match(lines[0].text, /^61\s+kg$/);
  assert.match(lines[2].text, /^110\/70 mmHg$/);
  assert.deepEqual(vitals.describeVitals(null), []);
  assert.deepEqual(vitals.describeVitals({}), []);
});

test("la provenance de chaque constante d'une consultation signée est conservée à l'affichage", () => {
  const lines = vitals.describeVitals({ weight_kg: { value: 61, source: "preconsultation" }, heart_rate: { value: 96, source: "professional" } });
  assert.equal(lines.find((line) => line.key === "weight_kg").source, "preconsultation");
  assert.equal(lines.find((line) => line.key === "heart_rate").source, "professional");
});

test("l'étape 1 patient devient « Identité du titulaire » : ville obligatoire, profession facultative, pas d'ethnie, date de délivrance automatique", () => {
  const onboarding = read("src/components/PatientOnboarding.tsx");
  assert.match(onboarding, /identité du titulaire/i);
  assert.match(onboarding, /Délivré le/);
  assert.match(onboarding, /profession/);
  assert.match(onboarding, /kind: "city"/);
  assert.doesNotMatch(onboarding, /ethnie/i);
});

test("la pré-consultation propose une étape de constantes, tous champs facultatifs", () => {
  const wizard = read("src/components/PatientPreconsultations.tsx");
  assert.match(wizard, /parseVitalsForm/);
  assert.match(wizard, /VITAL_FIELDS/);
  assert.match(wizard, /Étape 3 sur 4/);
});

test("le médecin relit les constantes, rédige trois blocs et prescrit en lignes structurées avant de signer", () => {
  const consultation = read("src/components/ProfessionalConsultations.tsx");
  for (const text of [/Motif et symptômes/, /Examen et diagnostic/, /Conduite à tenir/, /prescription_lines/, /requested_exams/, /parseVitalsForm/]) assert.match(consultation, text);
});

test("le patient retrouve chaque consultation comme une page « Visites » du carnet papier", () => {
  const history = read("src/components/PatientConsultations.tsx");
  for (const text of [/describeVitals/, /Ordonnance/, /Examens demandés/, /Diagnostic/, /VITAL_SOURCE_LABELS/]) assert.match(history, text);
});

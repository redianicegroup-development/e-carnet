// Constantes, identité du titulaire et fiche de visite : bornes numériques, texte libre et branchement des écrans.
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

test("la virgule décimale reste acceptée pour les constantes numériques et les textes santé ne sont pas convertis", () => {
  const form = { ...vitals.emptyVitalsForm(), weight_kg: "61,04", temperature_c: "38,54", glycemia: "5,2 mmol/L", blood_pressure: "12/8", heart_rate: "88" };
  const parsed = vitals.parseVitalsForm(form);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.vitals, { weight_kg: 61, temperature_c: 38.5, blood_pressure: "12/8", heart_rate: 88, glycemia: "5,2 mmol/L" });
});

test("une constante numérique impossible ou un texte sans chiffre est refusé avec son libellé", () => {
  for (const [key, value, label] of [["temperature_c", "3,7", "Température"], ["weight_kg", "610", "Poids"], ["spo2", "140", "Saturation"], ["heart_rate", "abc", "Fréquence"], ["blood_pressure", "mmHg", "Tension"], ["glycemia", "mmol/L", "Glycémie"]]) {
    const parsed = vitals.parseVitalsForm({ ...vitals.emptyVitalsForm(), [key]: value });
    assert.equal(parsed.ok, false, key);
    assert.match(parsed.message, new RegExp(label));
  }
});

test("la tension libre accepte les carnets en 12/8 ou 120/80 avec ou sans unité", () => {
  for (const value of ["12/8", "120/80 mmHg", "120/80"]) {
    const parsed = vitals.parseVitalsForm({ ...vitals.emptyVitalsForm(), blood_pressure: value });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.vitals.blood_pressure, value);
  }
});

test("les valeurs serveur reviennent dans le formulaire, les nulles restent vides et les anciennes clés sont préservées", () => {
  const form = vitals.vitalsToForm({ weight_kg: 61, temperature_c: null, systolic: 110, diastolic: 70, glycemia_g_l: 0.9 });
  assert.equal(form.weight_kg, "61");
  assert.equal(form.temperature_c, "");
  assert.equal(form.blood_pressure, "110/70");
  assert.equal(form.glycemia, "0.9 g/L");
  assert.equal(form.spo2, "");
});

test("l'affichage conserve les chaînes de tension et glycémie sans conversion et garde l'ordre des constantes", () => {
  const lines = vitals.describeVitals({ weight_kg: 61, temperature_c: 38.5, blood_pressure: "12/8", glycemia: "5,2 mmol/L", spo2: null });
  assert.deepEqual(lines.map((line) => line.key), ["weight_kg", "temperature_c", "blood_pressure", "glycemia"]);
  assert.match(lines[0].text, /^61\s+kg$/);
  assert.equal(lines[2].text, "12/8");
  assert.equal(lines[3].text, "5,2 mmol/L");
  assert.deepEqual(vitals.describeVitals(null), []);
  assert.deepEqual(vitals.describeVitals({}), []);
});

test("la provenance de chaque constante d'une consultation signée est conservée à l'affichage", () => {
  const lines = vitals.describeVitals({ blood_pressure: { value: "12/8", source: "preconsultation" }, heart_rate: { value: 96, source: "professional" } });
  assert.equal(lines.find((line) => line.key === "blood_pressure").source, "preconsultation");
  assert.equal(lines.find((line) => line.key === "heart_rate").source, "professional");
});

test("l'étape 1 patient devient « Identité du titulaire » : ville obligatoire, profession facultative, pas d'ethnie, date de délivrance automatique", () => {
  const onboarding = read("src/components/PatientOnboarding.tsx") + read("src/components/PatientIdentityFields.tsx");
  assert.match(onboarding, /identité du titulaire/i);
  assert.match(onboarding, /Délivré le/);
  assert.match(onboarding, /profession/);
  assert.match(onboarding, /kind: "city"/);
  assert.doesNotMatch(onboarding, /ethnie/i);
});

test("la pré-consultation propose des constantes facultatives et des valeurs libres de tension/glycémie", () => {
  const wizard = read("src/components/PatientPreconsultations.tsx");
  assert.match(wizard, /parseVitalsForm/);
  assert.match(wizard, /VITAL_FIELDS/);
  assert.match(wizard, /Quelles constantes ont été relevées/);
  assert.match(wizard, /Tension et glycémie/);
});

test("le médecin relit les constantes libres, rédige trois blocs et prescrit en lignes structurées avant de signer", () => {
  const consultation = read("src/components/ProfessionalConsultations.tsx");
  for (const text of [/Motif et symptômes/, /Examen et diagnostic/, /Conduite à tenir/, /prescription_lines/, /requested_exams/, /parseVitalsForm/, /Tension et glycémie/]) assert.match(consultation, text);
});

test("le patient retrouve chaque consultation comme une page « Visites » du carnet papier", () => {
  const history = read("src/components/PatientConsultations.tsx");
  for (const text of [/describeVitals/, /Ordonnance/, /Examens demandés/, /Diagnostic/, /VITAL_SOURCE_LABELS/]) assert.match(history, text);
});

test("Mes mesures rassemble relevés patients et constantes des consultations dans un historique daté", () => {
  const history = read("src/components/HealthMeasurements.tsx");
  assert.match(history, /patient\/care\/measurements/);
  assert.match(history, /patient\/care\/consultations/);
  assert.match(history, /Historique unifié des constantes/);
  assert.match(history, /Consultation signée/);
});

test("le carnet vaccinal propose les vaccins courants, une photo jointe et les trois états distincts", () => {
  const patient = read("src/components/Vaccinations.tsx");
  const documents = read("src/components/MedicalDocuments.tsx");
  for (const text of [/BCG/, /DT-Coq-Polio/, /Rougeole/, /Fièvre jaune/, /capture="environment"/, /document_id: documentId/, /documentée/, /peut la confirmer/]) assert.match(patient, text);
  assert.match(documents, /compressMedicalImage/);
  assert.doesNotMatch(patient, /status:\s*"confirmed"/);
});

test("le professionnel ne voit et ne confirme les vaccins qu’avec le périmètre patient requis", () => {
  const review = read("src/components/ProfessionalVaccinations.tsx");
  const routes = read("src/application/professional-access-grants.ts");
  assert.match(review, /scope\.includes\("declarations"\)/);
  assert.match(review, /scope\.includes\("documents"\)/);
  assert.match(review, /Confirmez uniquement après/);
  assert.match(routes, /\/vaccinations\/\$\{vaccinationId\}\/confirm\//);
});

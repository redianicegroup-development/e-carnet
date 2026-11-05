import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;
const read = (relative) => readFileSync(`${root}${relative}`, "utf8");
const catalog = await import("../src/lib/measurement-types.ts");

test("le référentiel partagé comprend les sept types de mesures et conserve les textes libres", () => {
  assert.deepEqual(catalog.MEASUREMENT_TYPES.map(({ value }) => value), [
    "temperature", "heart_rate", "spo2", "blood_pressure", "glycemia", "weight", "height",
  ]);
  assert.equal(catalog.MEASUREMENT_TYPES.find(({ value }) => value === "blood_pressure").freeText, true);
  assert.equal(catalog.MEASUREMENT_TYPES.find(({ value }) => value === "glycemia").freeText, true);
  assert.equal(catalog.MEASUREMENT_TYPES.find(({ value }) => value === "weight").unit, "kg");
  assert.equal(catalog.MEASUREMENT_TYPES.find(({ value }) => value === "height").unit, "cm");
  assert.deepEqual(catalog.PATIENT_MEASUREMENT_TYPES.map(({ value }) => value), [
    "temperature", "heart_rate", "spo2", "blood_pressure", "glycemia",
  ]);
});

test("patient et médecin partagent le catalogue sans modifier les mesures de référence du profil patient", () => {
  const patient = read("src/components/HealthMeasurements.tsx");
  const professional = read("src/components/ProfessionalMeasurementEntry.tsx");
  assert.match(patient, /PATIENT_MEASUREMENT_TYPES/);
  assert.match(patient, /item\.source_label\} par \$\{item\.professional_name\}/);
  assert.match(professional, /MEASUREMENT_TYPES\.map/);
  assert.match(professional, /Tension et glycémie sont conservées telles que saisies, sans conversion/);
});

test("le data layer utilise le même endpoint, par grant, pour lire et créer les mesures", () => {
  const application = read("src/application/professional-access-grants.ts");
  assert.match(application, /listProfessionalMeasurements\(grantId: string\).*apiGet/);
  assert.match(application, /createProfessionalMeasurement\(grantId: string, input: ProfessionalMeasurementInput\).*apiPost/);
  assert.equal((application.match(/professional\/access-grants\/\$\{grantId\}\/measurements\//g) ?? []).length, 2);
});

test("le panneau professionnel réserve la saisie aux grants sélectionnés et affiche les états et erreurs d'accès", () => {
  const consultations = read("src/components/ProfessionalConsultations.tsx");
  const component = read("src/components/ProfessionalMeasurementEntry.tsx");
  assert.match(consultations, /status === "active" && grant\.scope\.includes\("preconsultation"\)/);
  assert.match(consultations, /selectedGrant && <ProfessionalMeasurementEntry grant=\{selectedGrant\}/);
  assert.match(component, /items === null && !loadError/);
  assert.match(component, /items && items\.length === 0/);
  assert.match(component, /role=\{message &&/);
  assert.match(component, /propre dossier/);
  assert.match(component, /ne couvre pas/);
  assert.match(component, /n’est plus active/);
  assert.match(component, /Mesuré par \$\{item\.professional_name\}/);
  assert.match(read("src/components/professional-measurements.css"), /max-width: 480px/);
});

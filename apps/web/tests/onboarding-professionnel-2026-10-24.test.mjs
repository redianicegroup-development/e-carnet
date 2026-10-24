// Onboarding d'un professionnel : étapes 1 et 2 communes, étape 3 en trois parties (carnet patient, profil professionnel, cachet), puis étape 4.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const choice = read("src/app/onboarding/page.tsx");
const patientPage = read("src/app/onboarding/patient/page.tsx");
const patient = read("src/components/PatientOnboarding.tsx");
const pro = read("src/components/ProfessionalOnboarding.tsx");
const proPage = read("src/app/professionnel/onboarding/page.tsx");
const credPage = read("src/app/professionnel/onboarding/ordonnance/page.tsx");
const cred = read("src/components/ProfessionalCredentialsOnboarding.tsx");

test("étape 2 : un professionnel commence par son espace patient, un patient seul n'est pas changé", () => {
  assert.match(choice, /body: JSON\.stringify\(\{ role: "patient" \}\)/);
  assert.match(choice, /role === "patient" \? "\/onboarding\/patient" : "\/onboarding\/patient\?suite=professionnel"/);
  assert.doesNotMatch(choice, /router\.push\([^)]*"\/professionnel\/onboarding"\)/);
});

test("étape 3, partie 1 : le professionnel remplit son carnet patient, puis son espace professionnel est activé", () => {
  assert.match(patientPage, /suite === "professionnel"/);
  assert.match(patientPage, /forProfessional=\{forProfessional\}/);
  assert.match(patient, /forProfessional = false/);
  // le carnet patient est enregistré (contexte patient terminé) AVANT de passer au contexte professionnel
  const savePatient = patient.indexOf('"/api/v1/identity/onboarding/patient/"');
  const selectPro = patient.indexOf('contexts/select/", { role: "professional" }');
  assert.ok(savePatient > 0 && selectPro > savePatient);
  assert.match(patient, /router\.push\("\/professionnel\/onboarding\?etape=3"\)/);
  assert.match(patient, /Un seul compte, deux espaces/);
  assert.match(patient, /partie 1 sur 3 · votre carnet patient/);
});

test("pour un patient seul, l'étape 3 reste identique et mène à l'étape 4", () => {
  assert.match(patient, /Étape 3 · identité du titulaire/);
  assert.match(patient, /router\.push\("\/onboarding\/securite"\)/);
});

test("étape 3, parties 2 et 3 : profil professionnel, puis cachet et signature facultatifs, puis étape 4", () => {
  assert.match(proPage, /etape === "3" && !fromSettings/);
  assert.match(pro, /\/professionnel\/onboarding\/ordonnance\?etape=3/);
  assert.match(pro, /partie 2 sur 3 · profil professionnel/);
  assert.match(credPage, /etape === "3"/);
  assert.match(cred, /partie 3 sur 3 · facultatif/);
  assert.match(cred, /router\.push\("\/onboarding\/securite"\)/);
  assert.match(read("src/components/RecoverySetup.tsx"), /Étape 4 · récupération du compte/);
});

test("la modification du profil depuis les paramètres ou l'accueil n'affiche pas les libellés d'inscription", () => {
  assert.match(pro, /step3 \? "Étape 3 · partie 2 sur 3 · profil professionnel" : "Profil professionnel"/);
  assert.match(pro, /returnTo \?\? \(step3 \?/);
});

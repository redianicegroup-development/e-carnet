// Onboarding d'un professionnel : étapes 1 et 2 communes, étape 3 en UN SEUL BLOC (carnet patient + profil professionnel + cachet), puis étape 4.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const choice = read("src/components/RoleChoice.tsx");
const patientPage = read("src/app/onboarding/patient/page.tsx");
const patient = read("src/components/PatientOnboarding.tsx");
const fields = read("src/components/PatientIdentityFields.tsx");
const step3 = read("src/components/ProfessionalStep3.tsx");
const pro = read("src/components/ProfessionalOnboarding.tsx");
const proPage = read("src/app/professionnel/onboarding/page.tsx");
const credPage = read("src/app/professionnel/onboarding/ordonnance/page.tsx");
const cred = read("src/components/ProfessionalCredentialsOnboarding.tsx");

test("étape 2 : un professionnel commence par son espace patient, un patient seul n'est pas changé", () => {
  assert.match(choice, /body: JSON\.stringify\(\{ role: "patient" \}\)/);
  assert.match(choice, /role === "patient" \? "\/onboarding\/patient" : "\/onboarding\/patient\?suite=professionnel"/);
  assert.doesNotMatch(choice, /router\.push\([^)]*"\/professionnel\/onboarding"\)/);
});

test("étape 3 d'un professionnel : un seul bloc, deux groupes (espace patient, espace professionnel)", () => {
  assert.match(patientPage, /suite === "professionnel" \? <ProfessionalStep3 \/> : <PatientOnboarding \/>/);
  assert.equal((step3.match(/<form /g) ?? []).length, 1, "un seul formulaire, donc un seul bloc");
  assert.equal((step3.match(/<OnboardingNav /g) ?? []).length, 1, "un seul Retour / Suivant");
  assert.match(step3, /Dans votre espace patient/);
  assert.match(step3, /Dans votre espace professionnel/);
  assert.match(step3, /<PatientIdentityFields /);
  assert.match(step3, /<SpecialtyFields /);
  assert.match(step3, /<CredentialFields /);
  assert.doesNotMatch(step3, /partie . sur 3|Un seul compte, deux espaces : vous êtes aussi patient/);
});

test("étape 3 d'un professionnel : le carnet patient est enregistré AVANT d'activer l'espace professionnel, puis la spécialité, puis l'ordonnance", () => {
  const savePatient = step3.indexOf("await savePatientIdentity(form)");
  const selectPro = step3.indexOf('contexts/select/", { role: "professional" }');
  const saveSpecialty = step3.indexOf('"/api/v1/professionals/onboarding/", { specialty: choice.value }');
  const saveCredentials = step3.indexOf("await draft.upload()");
  assert.ok(savePatient > 0 && selectPro > savePatient && saveSpecialty > selectPro && saveCredentials > saveSpecialty);
  assert.match(step3, /router\.push\("\/onboarding\/securite"\)/);
  assert.match(step3, /Étape 3 · votre profil/);
  // les champs patient et leur enregistrement sont communs avec l'étape 3 d'un patient seul
  assert.match(fields, /"\/api\/v1\/identity\/onboarding\/patient\/"/);
  assert.match(patient, /savePatientIdentity\(form\)/);
  assert.match(step3, /patientFormProblem\(form\)/);
  assert.match(step3, /choice\.valid/, "la spécialité est obligatoire");
});

test("pour un patient seul, l'étape 3 reste identique et mène à l'étape 4", () => {
  assert.match(patient, /Étape 3 · identité du titulaire/);
  assert.match(patient, /router\.push\("\/onboarding\/securite"\)/);
  assert.doesNotMatch(patient, /forProfessional|suite=professionnel/, "plus de variante professionnelle : le bloc unique s'en charge");
});

test("les anciens liens de l'étape 3 en trois parties mènent au bloc unique", () => {
  assert.match(proPage, /etape === "3" && !fromSettings\) redirect\("\/onboarding\/patient\?suite=professionnel"\)/);
  assert.match(credPage, /etape === "3"\) redirect\("\/onboarding\/patient\?suite=professionnel"\)/);
  assert.match(read("src/components/RecoverySetup.tsx"), /"\/onboarding\/patient\?suite=professionnel"/, "Retour de l'étape 4 : le bloc unique");
  assert.match(read("src/components/RecoverySetup.tsx"), /Étape 4 · récupération du compte/);
  assert.match(cred, /router\.push\("\/onboarding\/securite"\)/);
});

test("la modification du profil depuis les paramètres ou l'accueil n'affiche pas les libellés d'inscription", () => {
  assert.doesNotMatch(pro, /Étape 3|partie . sur 3/);
  assert.match(pro, /returnTo \?\? "\/professionnel\/onboarding\/ordonnance"/);
  assert.match(pro, /<span className="eyebrow">Profil professionnel<\/span>/);
});

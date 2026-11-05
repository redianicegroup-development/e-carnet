import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("l’éditeur établissement expose l’ordre, l’aperçu, les types attendus et la désignation du référent", () => {
  const page = read("src/components/EstablishmentPreconsultationTemplates.tsx");
  assert.match(page, /"text"/); assert.match(page, /"number"/); assert.match(page, /"choice"/); assert.match(page, /"yes_no"/);
  assert.match(page, /Monter/); assert.match(page, /Descendre/); assert.match(page, /Aperçu patient/);
  assert.match(page, /Désigner comme référent médical/); assert.match(page, /Désactiver/);
  assert.match(page, /en attente de validation/);
});

test("le patient charge seulement les modèles actifs proposés par son API et transmet les réponses", () => {
  const form = read("src/components/PatientPreconsultations.tsx");
  assert.match(form, /patient\/preconsultation-templates/);
  assert.match(form, /preconsultation_template: form\.templateId \|\| null/);
  assert.match(form, /template_responses: form\.templateId \? form\.templateResponses/);
  assert.match(form, /Complétez les champs obligatoires/);
});

test("l’espace professionnel demande une confirmation explicite avant l’activation auditée", () => {
  const approvals = read("src/components/ProfessionalTemplateApprovals.tsx");
  assert.match(approvals, /confirm_medical_review: true/);
  assert.match(approvals, /window\.confirm/);
  assert.match(approvals, /Confirmer la validation médicale/);
});

test("la page admin est routée et liée à l’espace établissement", () => {
  assert.match(read("src/app/etablissement/modeles/page.tsx"), /EstablishmentPreconsultationTemplates/);
  assert.match(read("src/components/EstablishmentWorkspace.tsx"), /\/etablissement\/modeles/);
});

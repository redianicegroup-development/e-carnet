// UX-01 : « Aucune allergie connue » / « Je ne sais pas » sont des choix ; le champ libre refuse les négations.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rules = await import("../src/lib/allergy-rules.ts");
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("les phrases de négation sont reconnues, y compris la faute « Je n’es pas »", () => {
  for (const phrase of ["Je n’es pas", "Je n'ai pas d'allergie", "non", "Aucune", "pas d'allergie", "N'a pas", "rien", "ne sais pas"]) {
    assert.equal(rules.looksLikeAllergyNegation(phrase), true, phrase);
  }
});

test("les vraies allergies et les deux libellés exacts ne sont pas pris pour des négations", () => {
  for (const label of ["Pénicilline", "Arachide", "Ail", "Anti-inflammatoires non stéroïdiens", "Pollen de bouleau", rules.ALLERGY_NONE_LABEL, rules.ALLERGY_UNKNOWN_LABEL]) {
    assert.equal(rules.looksLikeAllergyNegation(label), false, label);
  }
});

test("les libellés web sont ceux de l'API", () => {
  const api = read("../api/apps/patients/allergy_rules.py");
  assert.ok(api.includes(`ALLERGY_NONE_LABEL = "${rules.ALLERGY_NONE_LABEL}"`));
  assert.ok(api.includes(`ALLERGY_UNKNOWN_LABEL = "${rules.ALLERGY_UNKNOWN_LABEL}"`));
  assert.ok(api.includes(rules.ALLERGY_NEGATION_MESSAGE));
});

test("la date de déclaration affichée est la plus récente", () => {
  const items = [{ declared_at: "2026-10-12T08:00:00Z" }, { declared_at: "2026-11-02T08:00:00Z" }, {}];
  assert.equal(rules.latestDeclaredOn(items, "fr-FR"), new Date("2026-11-02T08:00:00Z").toLocaleDateString("fr-FR"));
  assert.equal(rules.latestDeclaredOn([{}], "fr-FR"), "");
});

test("le formulaire propose trois choix et n'envoie pas de texte libre pour un état", () => {
  const form = read("src/components/PatientCarnet.tsx");
  assert.match(form, /<legend>Votre situation<\/legend>/);
  assert.match(form, /allergyStateLabel\(allergyMode\)/);
  assert.match(form, /looksLikeAllergyNegation\(label\)/);
});

test("la carte d'urgence ne dit plus « aucune allergie » quand rien n'est renseigné", () => {
  const visual = read("src/components/emergency-card/EmergencyCardVisual.tsx");
  const image = read("src/components/emergency-card/emergency-card-image.ts");
  assert.doesNotMatch(visual + image, /Aucune allergie déclarée/);
  assert.match(visual, /Non renseigné/);
  assert.match(image, /Non renseigné/);
  assert.match(visual, /Déclaré le/);
});

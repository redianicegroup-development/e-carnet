// Garde-fous de la fusion « 1.10 fusion + correctifs 1.9 » : les deux jeux de changements doivent coexister.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");

test("le QR de consultation vit dans l'onglet « Accès et QR », plus dans le shell", () => {
  const shell = read("components/shell/SpaceShell.tsx");
  const grants = read("components/PatientAccessGrants.tsx");
  assert.doesNotMatch(shell, /QRCodeSVG|patient-active-qr/, "le QR est revenu dans le shell");
  assert.match(grants, /function ActiveAccessQr[\s\S]*QRCodeSVG/);
  assert.match(grants, /<ActiveAccessQr token=\{qr\.token\}/);
});

test("les parties de la 1.10 survivent à la fusion", () => {
  const shell = read("components/shell/SpaceShell.tsx");
  const grants = read("components/PatientAccessGrants.tsx");
  assert.match(shell, /isSessionMissing\(error\)/, "session absente (401/403)");
  assert.match(shell, /profilePending[\s\S]*router\.replace\("\/etablissement\/fiche"\)/, "onboarding établissement");
  assert.match(shell, /health\/ready/, "attente du réveil du serveur");
  assert.match(grants, /async function decide[\s\S]*await confirm\(/, "confirmation avant autoriser/refuser/prolonger");
  for (const action of ["accept", "refuse", "extend"]) assert.match(grants, new RegExp(`decide\\(item, "${action}"\\)`), action);
});

test("globals.css garde ses règles v1.10 et retrouve celles des correctifs", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  for (const rule of [".notice.error", ".admin-management-grid > .admin-table-card", ".preconsult-wizard", ".consent-decision", ".professional-quick-search", "var(--text-scale"]) {
    assert.ok(css.includes(rule), `règle manquante : ${rule}`);
  }
});

test("la demande d'accès professionnelle n'envoie plus d'identifiant de patient", () => {
  const flow = read("components/ProfessionalAccessFlow.tsx");
  const types = read("application/professional-access-grants.ts");
  assert.doesNotMatch(flow, /patient_id/);
  assert.doesNotMatch(types, /patient_id/);
});

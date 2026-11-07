// Garde-fous de la fusion « 1.10 fusion + correctifs 1.9 » : les deux jeux de changements doivent coexister.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");

test("le QR temporaire reste dans l’accès patient et la carte d’urgence est séparée du panneau de paramètres", () => {
  const shell = read("components/shell/SpaceShell.tsx");
  const grants = read("components/PatientAccessGrants.tsx");
  const settings = read("components/AccountSettingsClient.tsx");
  const emergencySettings = read("components/PatientEmergencyCardSettingsClient.tsx");
  const homeIdentity = read("components/PatientHomeIdentity.tsx");
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.doesNotMatch(shell, /QRCodeSVG|patient-active-qr/, "le QR est revenu dans le shell");
  assert.match(grants, /QRCodeSVG|ActiveAccessQr|access-qr\//);
  assert.match(grants, /id="qr"/);
  assert.match(settings, /<PatientEmergencyCardSettingsClient\s*\/>/);
  assert.match(emergencySettings, /<EmergencyCardVisual card=\{shown\} showQr=\{false\}/);
  assert.match(emergencySettings, /downloadEmergencyCardPng/);
  assert.match(emergencySettings, /<QRCodeSVG value=\{publicUrl\}/);
  assert.doesNotMatch(homeIdentity, /QRCodeSVG|VirtualCardPanel/, "l’accueil patient n’affiche plus la carte ni son QR");
  assert.doesNotMatch(settings, /usePatientAccessQr|Mon QR de visite|access-qr\/|visit-qr/);
  assert.doesNotMatch(css, /\.settings-account-summary__visit-qr|\.settings-visit-qr-modal/);
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

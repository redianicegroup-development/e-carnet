import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("le patient ajoute une information avec justificatifs et choisit l'établissement", () => {
  const patient = read("components/PatientAttestations.tsx");
  assert.match(read("components/PatientCarnet.tsx"), /<PatientAttestations \/>/);
  assert.match(read("application/attestations.ts"), /ACCEPTED_FILES = "\.pdf,\.png,\.jpg,\.jpeg,\.docx"/);
  assert.match(patient, /name="establishment_ids"|form\.append\("establishment_ids"/);
  assert.match(patient, /visibles par les professionnels habilités de l’établissement choisi, et par eux seulement/);
  assert.match(patient, /Retirer le partage/);
  assert.match(patient, /Signaler une erreur/);
});

test("seuls les professionnels attestent : tuile d'accueil, fenêtre, rappel en consultation", () => {
  assert.match(read("components/ProfessionalHome.tsx"), /<ProfessionalAttestationsTile \/>/);
  assert.match(read("components/ProfessionalConsultations.tsx"), /<ProfessionalAttestationReminder grantId=\{grantId\} \/>/);
  const pro = read("components/ProfessionalAttestations.tsx");
  assert.match(pro, /En attente de la première consultation/);
  assert.match(pro, /Vous attestez avoir examiné/);
  assert.doesNotMatch(read("components/EstablishmentSettingsClient.tsx"), /attest/i, "l'administrateur d'établissement n'atteste pas");
});

test("l'ancienne liste de déclarations n'étiquette plus un implant comme un antécédent", () => {
  assert.match(read("components/PatientCarnet.tsx"), /implant: "Implant ou dispositif médical"/);
});

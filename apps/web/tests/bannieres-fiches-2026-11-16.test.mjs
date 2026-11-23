import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("« Mes consultations » est toujours déplié, côté patient comme côté professionnel", () => {
  assert.match(read("components/ui/CollapsibleSection.tsx"), /alwaysOpen/);
  assert.match(read("components/PatientHistory.tsx"), /title="Mes consultations" solo alwaysOpen/);
  assert.match(read("components/ProfessionalConsultations.tsx"), /title="Mes consultations" alwaysOpen/);
  const section = read("components/ui/CollapsibleSection.tsx");
  const staticBranch = section.slice(section.indexOf("if (alwaysOpen)"), section.indexOf("<section className=\"card carnet-accordion\" data-open={open}"));
  assert.doesNotMatch(staticBranch, /<button/, "une section toujours dépliée n'a pas de bouton");
});

test("photos et logos sont ronds et ouvrent une fiche en lecture seule", () => {
  assert.match(read("components/establishment-logo.css"), /\.establishment-logo \{[^}]*border-radius: 50%/);
  // 19/11/2026 : les listes sont des grilles de photos (composant « Profil ») ; un toucher ouvre la fiche.
  assert.match(read("components/ProfessionalRecentPatients.tsx"), /<ProfileGrid label="Patients reçus récemment">[\s\S]*<Profile key=[^>]*\{\.\.\.profile\}>/);
  assert.match(read("components/ProfessionalGrantDetail.tsx"), /className="request-row__avatars"/);
  assert.match(read("components/ProfessionalAccessGrants.tsx"), /<Profile key=\{item\.id\} \{\.\.\.base\}/);
  assert.match(read("components/ProfessionalAccess.tsx"), /<ProfileGrid label="Mes rattachements">[\s\S]*membershipProfile\(membership/);
  const patientDetail = read("components/ProfessionalPatientDetail.tsx");
  assert.match(patientDetail, /ne donne aucun accès au carnet/);
  assert.doesNotMatch(patientDetail, /allerg|vaccin|diagnos|ordonnance/i, "aucune donnée médicale dans la fiche patient reçu");
});

test("la bannière n'apparaît que sur l'accueil patient, avec la mention Sponsorisé et sans ciblage", () => {
  assert.match(read("components/PatientHome.tsx"), /<PatientBanner \/>/);
  for (const medical of ["PatientCarnet", "PatientConsultations", "PatientHistory", "ProfessionalConsultations", "PatientEmergencyCard"]) {
    try { assert.doesNotMatch(read(`components/${medical}.tsx`), /PatientBanner/, `${medical} ne doit jamais afficher de bannière`); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
  }
  const banner = read("components/PatientBanner.tsx");
  assert.match(banner, /rel="noopener noreferrer sponsored"/);
  assert.match(banner, /n’utilise pas vos données de santé/);
});

test("la console exige un texte alternatif et annonce le format 3:1", () => {
  const admin = read("components/AdminBannersClient.tsx");
  assert.match(admin, /Texte alternatif \(obligatoire\)[\s\S]*required/);
  assert.match(admin, /3:1/);
  assert.match(read("app/admin/page.tsx"), /AdminBannersClient/);
});

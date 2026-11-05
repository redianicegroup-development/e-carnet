// Décisions du 31/10 sur les maquettes : accueils sans grilles ni « À faire » de préparation, pas de bouton central, dossiers ouverts,
// carte virtuelle carrée, historique des consultations dans Historique, boutons Google à largeur partagée, page hors connexion.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("accueil patient : titre, deux boutons, prochaine consultation ; ni grille de tuiles ni préparation de consultation", () => {
  const home = read("src/components/PatientHome.tsx");
  assert.match(home, /Votre carnet,<em>toujours avec vous<\/em>/);
  assert.match(home, /href="\/patient\/carnet"[\s\S]*Mon carnet/);
  assert.match(home, /Partager en QR/);
  assert.doesNotMatch(home, /TileGrid|SHORTCUTS|key: "prepare"|Préparez votre prochaine consultation/);
  assert.match(read("src/components/PatientToday.tsx"), /Prochaine consultation/);
});

test("accueil médecin : « Votre journée », un patient, scanner un QR, Aujourd'hui + Agenda ; ni « Mon activité » ni tuiles", () => {
  const home = read("src/components/ProfessionalHome.tsx");
  assert.match(home, /Votre journée,<em>en un coup d’œil<\/em>/);
  assert.match(home, /Un patient/);
  assert.match(home, /href="\/professionnel\/patients#scanner"/);
  assert.match(home, /<ProfessionalToday \/>/);
  assert.doesNotMatch(home, /TileGrid|Mon activité/);
  assert.match(read("src/components/ProfessionalToday.tsx"), /href="\/professionnel\/agenda"/);
});

test("le dossier patient et le dossier médecin sont toujours ouverts ; la carte virtuelle est une tuile carrée", () => {
  const card = read("src/components/DossierCard.tsx");
  assert.match(card, /dossier-sections/);
  assert.match(read("src/components/PatientHomeIdentity.tsx"), /sections=\{tiles\}/);
  assert.match(read("src/components/ProfessionalDossier.tsx"), /sections=\{tiles\}/);
  assert.doesNotMatch(read("src/components/patient-sections.css"), /:only-child[^{]*\{[^}]*grid-column: 1 \/ -1/, "une tuile seule dans sa grille reste carrée");
});

test("pas de bouton jaune central dans les navigations", () => {
  assert.doesNotMatch(read("src/lib/spaces.ts"), /action: \{/);
  assert.doesNotMatch(read("src/components/shell/AppSidebar.tsx"), /sidebar-action\.css|sb__action|ActionRow/);
});

test("Consultations ne garde que le parcours ; tout l'historique est dans Historique, avec filtres et sceau", () => {
  assert.doesNotMatch(read("src/app/patient/consultations/page.tsx"), /<PatientConsultations \/>/);
  assert.doesNotMatch(read("src/components/PatientPreconsultations.tsx"), /Pré-consultations clôturées|aria-label="Pré-consultations clôturées"/);
  assert.match(read("src/components/PatientHistory.tsx"), /<PatientConsultations \/>/);
  const list = read("src/components/PatientConsultations.tsx");
  for (const label of ["Toutes", "À venir", "Passées", "Pré-consult."]) assert.ok(list.includes(label), label);
  assert.match(list, /<ConsultationSealPanel item=\{item\} \/>/);
  assert.match(read("src/components/ConsultationSealPanel.tsx"), /Ouvrir le sceau/);
});

test("connexion sociale : les boutons se partagent la largeur (Google seul = toute la ligne, trois = une ligne)", () => {
  const css = read("src/app/connexion/auth-immersive.css");
  assert.match(css, /\.ax-socials \{ display: flex; gap: 10px; \}/);
  assert.match(css, /\.ax-social \{ flex: 1 1 0; min-width: 0;/);
});

test("hors connexion : page d'explication de l'app (pas celle de Chrome), sans jamais mettre les pages privées en cache", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /const OFFLINE_URL = "\/hors-connexion\.html"/);
  assert.match(sw, /PRIVATE_PAGES = \["\/patient", "\/professionnel"/);
  assert.match(sw, /fetch\(request\)\.catch\(async \(\) => \(await caches\.match\(OFFLINE_URL\)\)/);
  assert.doesNotMatch(sw, /cache\.put\(request[^)]*\)[^;]*\/patient/);
  assert.match(read("public/hors-connexion.html"), /Vous êtes hors connexion/);
});

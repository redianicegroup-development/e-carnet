// Interface du 28/10 : navigation à bouton principal surélevé, Historique, consultations en deux étapes, dossiers en tuiles pliables,
// onboarding sans nom redemandé, en-tête de « Moi », page Proches et enfants, logo actuel dans les crédits.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("la barre de navigation porte un bouton principal surélevé : pré-consultation (patient), scanner un QR (médecin rattaché)", () => {
  const spaces = read("src/lib/spaces.ts");
  assert.match(spaces, /action: \{ id: "preconsult", label: "Préparer", long: "Préparer ma consultation", href: "\/patient\/consultations#preparer"/);
  assert.match(spaces, /action: \{ id: "scan", label: "Scanner", long: "Scanner le QR d’un patient", href: "\/professionnel\/patients#scanner"/);
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(shell, /space !== "professional" \|\| clinicalReady === true/, "le médecin voit le scanner une fois rattaché");
  assert.match(shell, /action=\{navAction\}/);
  const sidebar = read("src/components/shell/AppSidebar.tsx");
  assert.match(sidebar, /index === Math\.floor\(items\.length \/ 2\)/, "le bouton est posé au centre de la barre");
  assert.match(sidebar, /sb__action-orb/);
  const css = read("src/components/shell/sidebar-action.css");
  assert.match(css, /margin-top: -30px/, "surélevé sur mobile");
  assert.match(css, /@media \(min-width: 920px\)[\s\S]*order: -1/, "en tête de la sidebar sur grand écran");
  assert.match(css, /prefers-reduced-motion/);
  assert.match(read("src/components/ProfessionalAccessGrants.tsx"), /window\.location\.hash !== "#scanner"[\s\S]*setScanning\(true\)/, "la caméra démarre depuis le bouton Scanner");
});

test("le 4e onglet du patient est l'Historique ; l'ancienne page Partage redirige vers les accès", () => {
  const spaces = read("src/lib/spaces.ts");
  const patient = spaces.slice(spaces.indexOf("  patient:"), spaces.indexOf("  professional:"));
  assert.match(patient, /id: "historique", label: "Historique"[^}]*href: "\/patient\/historique"/);
  assert.doesNotMatch(patient, /label: "Partage"/);
  assert.match(read("src/app/patient/acces/page.tsx"), /redirect\("\/patient\/historique#acces"\)/);
  const history = read("src/components/PatientHistory.tsx");
  for (const tile of ["Accès à mes données", "Mes consultations", "Mes vaccins", "Mes mesures de santé"]) assert.match(history, new RegExp(`title="${tile}"`), tile);
  assert.match(history, /<PatientAccessGrants part="log" \/>/);
  assert.match(history, /hash === "#acces"/, "#acces ouvre la tuile des accès");
  assert.match(read("src/components/notifications/NotificationBell.tsx"), /\/patient\/historique#acces/);
});

test("consultations en deux étapes : l'accès temporaire n'apparaît qu'une fois la pré-consultation enregistrée", () => {
  const flow = read("src/components/PatientConsultationFlow.tsx");
  assert.match(flow, /Étape 1[\s\S]*Pré-consultation[\s\S]*Étape 2[\s\S]*Accès temporaire pour le professionnel/);
  assert.match(flow, /hasDraft\s*\? <PatientAccessGrants part="qr" \/>/);
  assert.match(read("src/components/PatientPreconsultations.tsx"), /onDraftChange\?\.\(hasDraft\)/);
  const grants = read("src/components/PatientAccessGrants.tsx");
  assert.match(grants, /part = "all"/);
  assert.match(grants, /part !== "log" && <section id="qr"/);
  assert.match(grants, /part !== "qr" && <section aria-labelledby="active-access-heading"/);
  assert.match(read("src/app/patient/consultations/page.tsx"), /<PatientConsultationFlow \/>/);
});

test("l'accueil patient est une vitrine : plus de raccourcis ni de carte d'action, la mise en route n'a plus de barre de progression", () => {
  const home = read("src/components/PatientHome.tsx");
  assert.doesNotMatch(home, /SHORTCUTS|TileGrid|cta-card/);
  assert.match(home, /key: "prepare"/);
  assert.doesNotMatch(read("src/components/SetupCard.tsx"), /progress-card__line|role="progressbar"|<progress/);
  assert.match(read("src/components/SetupCard.tsx"), /\{done\}\/\{steps\.length\} étape/, "le compteur 1/3 reste");
});

test("« Mes rattachements » est une tuile carrée dans une grille, comme les autres", () => {
  const access = read("src/components/ProfessionalAccess.tsx");
  assert.match(access, /<div className="section-grid">\s*<CollapsibleSection title="Mes rattachements"/);
});

test("onboarding : le nom et les prénoms (étape 1) ne sont pas redemandés à l'étape 3 ; la profession patient n'est pas répétée chez le médecin", () => {
  const fields = read("src/components/PatientIdentityFields.tsx");
  assert.doesNotMatch(fields, /first_name|last_name|family-name|given-name/);
  assert.match(fields, /La ville est obligatoire/);
  assert.doesNotMatch(fields, /identity\/me\/profile/, "l'étape 3 ne réécrit plus le nom");
  assert.match(fields, /showProfession && <label/);
  const step3 = read("src/components/ProfessionalStep3.tsx");
  assert.match(step3, /showProfession=\{false\}/);
  assert.match(step3, /Seules la ville et la spécialité sont obligatoires/);
  assert.match(read("src/components/IdentityOnboarding.tsx"), /required/, "l'étape 1 exige le nom");
});

test("« Moi » : en-tête photo, nom, trois repères et barre d'état pour le patient, le professionnel et l'établissement", () => {
  const summary = read("src/components/ProfileSummary.tsx");
  assert.match(summary, /profile-card__stats/);
  assert.match(summary, /label: "Genre"[\s\S]*label: "Âge"[\s\S]*label: "Naissance"/);
  for (const file of ["AccountSettingsClient", "ProfessionalSettingsClient", "EstablishmentSettingsClient"]) {
    assert.match(read(`src/components/${file}.tsx`), /<ProfileSummary|<PatientSummary/, file);
    assert.doesNotMatch(read(`src/components/${file}.tsx`), /settings-account-summary__row/, `${file} : ancien en-tête retiré`);
  }
  assert.match(read("src/components/AccountSettingsClient.tsx"), /<CardBar href="\/patient" \/>/);
});

test("Proches de confiance et profil enfant : une page dédiée, l'Aide y renvoie", () => {
  const page = read("src/app/proches-et-enfants/page.tsx");
  assert.match(page, /Proche de confiance/);
  assert.match(page, /Profil enfant/);
  assert.match(page, /72 heures/);
  assert.match(page, /représentant légal/);
  const help = read("src/components/help/helpContent.ts");
  assert.match(help, /href: "\/proches-et-enfants"/);
  assert.doesNotMatch(help, /Un proche de confiance peut-il consulter tout mon carnet/, "l'explication détaillée a quitté l'Aide");
  assert.match(read("public/sitemap.xml"), /\/proches-et-enfants/);
  assert.match(read("src/components/PatientRepresentationsSettingsClient.tsx"), /href="\/proches-et-enfants"/);
});

test("crédits : le logo actuel remplace l'ancien dessin dans « Identité visuelle »", () => {
  assert.match(read("src/app/credits/page.tsx"), /<BrandLogoFigure \/>/);
  assert.doesNotMatch(read("src/app/credits/page.tsx"), /BrandSwitchFigure/);
});

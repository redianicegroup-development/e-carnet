// Sections pliables en grille de tuiles ; gooey unique (mécanisme du panneau de notifications) ; toast de bienvenue centré.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("les tuiles n'ont aucune couleur propre : elles suivent la palette choisie", () => {
  const css = read("src/components/patient-sections.css");
  const grid = css.slice(css.indexOf("Grille de rubriques"));
  assert.match(grid, /--tile: color-mix\(in srgb, var\(--primary\) 16%, var\(--bg\)\)/);
  assert.doesNotMatch(grid, /data-tone|#[0-9a-fA-F]{6}\b/);
  assert.doesNotMatch(read("src/components/ui/CollapsibleSection.tsx"), /tone/);
});

test("les rubriques pliables des espaces sont posées dans une grille de tuiles", () => {
  assert.match(read("src/components/PatientCarnet.tsx"), /<div className="section-grid">[\s\S]*Exporter mon carnet[\s\S]*<\/div>\s*<PatientPreconsultations \/>/);
  assert.match(read("src/app/patient/consultations/page.tsx"), /className="section-grid"/);
  assert.match(read("src/app/professionnel/consultations/page.tsx"), /className="section-grid"/);
  assert.match(read("src/components/ProfessionalAccess.tsx"), /className="section-grid"/);
  assert.match(read("src/components/ProfessionalConsultations.tsx"), /className="section-grid"/);
  const css = read("src/components/patient-sections.css");
  assert.match(css, /body \.section-grid \{ display: grid; grid-template-columns: repeat\(auto-fill/);
  assert.match(css, /\.carnet-accordion\[data-open="true"\] \{ grid-column: 1 \/ -1/);
});

test("la tuile garde un vrai bouton accessible (aria-expanded, aria-controls, contenu monté à l'ouverture)", () => {
  const source = read("src/components/ui/CollapsibleSection.tsx");
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /aria-controls=\{panelId\}/);
  assert.match(source, /\{open && <div id=\{panelId\}/);
});

test("les paramètres ne sont pas touchés par la grille", () => {
  for (const file of ["SettingsDirectory.tsx", "SettingsModal.tsx", "AccountSettingsClient.tsx", "ProfessionalSettingsClient.tsx"]) {
    assert.doesNotMatch(read(`src/components/${file}`), /section-grid/);
  }
});

test("gooey unique : boutons, modales et toast reprennent le ressort et les ombres du panneau de notifications", () => {
  const goo = read("src/app/goo.css");
  assert.match(goo, /--goo-grow: \.7s var\(--spring\)/);
  assert.match(goo, /--goo-shadow: drop-shadow\(7px 8px 12px/);
  assert.match(goo, /body \.button \{ animation: goo-button-grow var\(--goo-grow\) backwards; \}/);
  assert.match(goo, /@keyframes goo-blob-grow/);
  assert.match(goo, /filter: url\(#ecarnet-gooey\) var\(--goo-shadow\)/);
  assert.match(goo, /@keyframes goo-item-in/);
  const bell = read("src/components/notifications/notification-bell.css");
  assert.match(bell, /drop-shadow\(7px 8px 12px/);
  assert.match(bell, /\.7s var\(--spring/);
});

test("le toast de bienvenue est centré sur ordinateur comme sur téléphone et porte la goutte", () => {
  const css = read("src/components/modal/modal.css");
  assert.match(css, /\.greeting-stage \{[^}]*left: 0; right: 0; display: flex; justify-content: center/);
  assert.doesNotMatch(css, /\.greeting-toast \{[^}]*right: max\(18px/);
  const tsx = read("src/components/modal/GreetingModal.tsx");
  assert.match(tsx, /className="greeting-stage"/);
  assert.match(tsx, /<GooLayer target=\{toast\} \/>/);
});

test("mouvement réduit : aucun calque ni animation gooey", () => {
  const goo = read("src/app/goo.css");
  assert.match(goo, /@media \(prefers-reduced-motion: reduce\) \{\s*body \.goo-layer \{ display: none; \}/);
  assert.match(goo, /@media \(prefers-reduced-motion: no-preference\)/);
});

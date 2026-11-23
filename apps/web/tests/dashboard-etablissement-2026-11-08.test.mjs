import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (file) => readFileSync(join(root, file), "utf8");

test("l'accueil établissement affiche un vrai tableau de bord, seulement quand l'espace est actif", () => {
  const console_ = read("src/components/EstablishmentConsole.tsx");
  assert.match(console_, /\{active && <EstablishmentDashboard /);
  assert.match(console_, /<EstablishmentKpis [^>]*showCards=\{false\}/);
});

test("le tableau de bord n'utilise que des données administratives et ignore les rendez-vous annulés", () => {
  const source = read("src/components/EstablishmentDashboard.tsx");
  assert.match(source, /status !== "cancelled"/);
  for (const label of ["Médecins actifs", "Demandes à traiter", "Rendez-vous à venir", "Codes médecin actifs", "Rendez-vous de la semaine", "Progression des rattachements"]) assert.ok(source.includes(label), label);
  assert.doesNotMatch(source, /apiGet|apiPost|fetch\(/, "aucun appel réseau : tout vient de la console");
});

test("les cartes KPI d'origine restent disponibles pour la console staff", () => {
  const kpis = read("src/components/EstablishmentKpis.tsx");
  assert.match(kpis, /showCards = true/);
  assert.match(kpis, /\{showCards && <section className="kpi-grid"/);
});

test("l'espace établissement utilise les mêmes tuiles que patient et professionnel", () => {
  const console_ = read("src/components/EstablishmentConsole.tsx");
  assert.match(console_, /<div className="section-grid"><CollapsibleSection title="Demandes de rattachement"/);
  assert.match(console_, /<CollapsibleSection title="Médecins de l’établissement"/);
  assert.match(console_, /<CollapsibleSection title="Ouvertures récentes"/);
});

test("la tuile fermée est une carte pastel : titre et description en haut, objet en relief en bas à droite, teinte de la palette mélangée à la matière du thème", () => {
  const css = read("src/components/patient-sections.css");
  const closed = css.slice(css.indexOf("Tuile fermée : carte pastel"));
  assert.match(closed, /\.carnet-accordion\[data-open="false"\] \.carnet-accordion__label \{ display: contents; \}/);
  // L'objet en relief : badge sans fond propre, plaque arrière (::before) et plaque avant en dégradé (::after), icône par-dessus.
  assert.match(closed, /carnet-accordion__badge \{\s*position: absolute; right: 12px; bottom: 12px;[^}]*background: none/);
  assert.match(closed, /carnet-accordion__badge::before \{\s*z-index: -2/);
  assert.match(closed, /carnet-accordion__badge::after \{\s*z-index: -1/);
  // Fond de la carte : la teinte de la rubrique mélangée à la matière du thème (clair comme sombre), jamais un fond en dur.
  assert.match(closed, /background: color-mix\(in srgb, var\(--hue\) var\(--wash\), var\(--surface, var\(--bg\)\)\)/);
  // Les seules couleurs en dur : le blanc et le noir des reflets et ombres de l'objet en relief ; les teintes viennent toutes de la palette.
  assert.doesNotMatch(closed.replace(/#fff\b|#000\b/g, ""), /#[0-9a-fA-F]{3,8}\b/, "pas d'autre couleur en dur dans la carte fermée");
});

test("le tableau de bord reste dans la palette du thème et se replie sur téléphone", () => {
  const css = read("src/components/establishment-dashboard.css");
  assert.match(css, /var\(--primary\)/);
  assert.match(css, /@media \(max-width: 699px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

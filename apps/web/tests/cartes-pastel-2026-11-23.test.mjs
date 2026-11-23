// Cartes de chiffres, tableau de bord établissement et admin : même style pastel que les tuiles, aux couleurs de la PALETTE choisie.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("tableau de bord et cartes de chiffres : deux teintes de la palette en damier, objet en relief, cartes sombres conservées", () => {
  const css = read("src/components/establishment-dashboard.css");
  const pastel = css.slice(css.indexOf("Cartes pastel (refonte 11/2026)"), css.indexOf("Tablette et grand écran"));
  assert.ok(pastel.length > 500, "section des cartes pastel présente");
  // A : couleur principale ; B : couleur d'accent de la palette ; l'accent, plus clair, est plus marqué (--wash). Jamais une teinte en dur.
  assert.match(pastel, /--hue: var\(--primary\); --on-hue: var\(--on-primary, #fff\)/);
  assert.match(pastel, /:nth-child\(4n \+ 2\)[^{]*:nth-child\(4n \+ 3\) \{ --hue: var\(--brand-3, var\(--primary\)\); --on-hue: var\(--text\); --wash: 22%/);
  assert.match(pastel, /background: color-mix\(in srgb, var\(--hue\) var\(--wash\), var\(--surface, var\(--bg\)\)\)/);
  assert.doesNotMatch(pastel, /--hue: #/);
  // Les cartes sombres (en vedette, codes médecin) ne reçoivent pas le fond pastel.
  assert.match(pastel, /:not\(\.edash-stat--featured\):not\(\.edash-codes\)/);
  // L'objet en relief : la pastille d'icône du pied de carte, avec sa plaque arrière (::before) et sa plaque avant (::after).
  assert.match(pastel, /\.edash-stat__chip \{\s*position: absolute; right: 12px; bottom: 12px;/);
  assert.match(pastel, /\.edash-stat__chip::before \{ z-index: -2/);
  assert.match(pastel, /\.edash-stat__chip::after \{\s*z-index: -1/);
  assert.match(pastel, /prefers-reduced-motion|--spring-soft/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*body \.edash-stat, body \.edash-week__bar, body \.edash__grid > \.edash-stat \.edash-stat__chip \{ transition: none; \}/);
  // Les accueils patient, professionnel et laboratoire partagent la même carte : rien à dupliquer.
  assert.match(read("src/components/dashboard/SpaceKpis.tsx"), /edash-card edash-stat/);
});

test("admin : les cartes de chiffres prennent aussi les deux couleurs de la palette", () => {
  const css = read("src/app/admin-skin.css");
  const section = css.slice(css.indexOf("Cartes de chiffres de l'admin"));
  assert.match(section, /\.admin-metrics > \.admin-metric \{ --hue: var\(--primary\); --wash: 15%;/);
  assert.match(section, /:nth-child\(4n \+ 2\)[^{]*:nth-child\(4n \+ 3\) \{ --hue: var\(--brand-3, var\(--primary\)\); --wash: 32%; \}/);
  assert.doesNotMatch(section, /--hue: #/);
});

test("carte « Déclarations à attester » : même style, couleur d'accent de la palette, objet en relief", () => {
  const css = read("src/components/attestations.css");
  const section = css.slice(css.indexOf("Carte « Déclarations à attester »"));
  assert.match(section, /--hue: var\(--brand-3, var\(--primary\)\); --on-hue: var\(--text\);/);
  assert.match(section, /background: color-mix\(in srgb, var\(--hue\) 32%, var\(--surface, var\(--bg\)\)\)/);
  assert.match(section, /\.attest-tile \.carnet-accordion__badge::before[^{]*\{ z-index: -2/);
  assert.match(section, /\.attest-tile \.carnet-accordion__badge::after \{\s*z-index: -1/);
  assert.doesNotMatch(section.replace(/#fff\b|#000\b|#3B826C/g, ""), /#[0-9a-fA-F]{3,8}\b/, "aucune teinte en dur : tout vient de la palette");
});

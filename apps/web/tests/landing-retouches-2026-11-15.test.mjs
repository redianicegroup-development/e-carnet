// Retouches du 15/11/2026 (3e demande) : modal « Partager en QR » responsive, pastille du héro retirée, carrés du titre agrandis,
// image de la section Solution plafonnée, liens de navigation de l'en-tête centrés.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("le héro n'a plus la pastille « Carnet de santé numérique » (page et contenu)", () => {
  assert.doesNotMatch(read("src/app/page.tsx"), /HERO\.eyebrow|className="eyebrow" data-hero-item/);
  assert.doesNotMatch(read("src/lib/landing-content.ts"), /Carnet de santé numérique/);
});

test("les carrés du titre sont plus grands : 1,3 em sur ordinateur, 1,5 em sur mobile (les trois, donc aussi le départ de la grande image)", () => {
  const css = read("src/app/landing-showcase.css");
  assert.match(css, /\.lp-hero__slot \{[^}]*width: 1\.3em; height: 1\.3em;/);
  const mobile = css.slice(css.indexOf("@media (max-width: 759px)"));
  assert.match(mobile, /\.lp-hero__slot \{ width: 1\.5em; height: 1\.5em;/);
});

test("« Partager en QR » : fenêtre de 680 px sur ordinateur (QR à gauche, détails à droite), empilée dessous de 720 px, jamais coupée", () => {
  const css = read("src/components/access/access-history.css");
  assert.match(css, /@media \(min-width: 720px\) \{\s*\.modal-dialog\.share-qr-dialog \{ width: min\(100%, 680px\)/);
  assert.match(css, /\.share-qr-dialog \.patient-active-qr \{ flex-direction: row/);
  assert.match(css, /\.share-qr-dialog \.patient-active-qr__countdown \{ white-space: nowrap/);
  assert.match(css, /max-height: 700px\) \{[^}]*patient-active-qr__code svg \{ width: 148px/);
  assert.match(read("src/components/modal/modal.css"), /\.modal-dialog \{[^}]*max-height: min\(92dvh, 720px\)[^}]*overflow: auto/, "si l'écran est très bas, la fenêtre défile");
});

test("section Solution : l'image main + téléphone est plafonnée à 440 px et à 64 % de la hauteur d'écran, mobile inchangé", () => {
  const css = read("src/app/landing-v2.css");
  assert.match(css, /\.lp2-solution \.lp2-hand-stack \{width:min\(100%,440px,calc\(64svh \* \.7075 \+ 68px\)\)\}/);
  assert.match(css, /\.lp2-hand-stack, \.lp2-solution \.lp2-hand-stack \{width:min\(86vw,420px\)\}/);
  assert.match(css, /\.lp2-flow-phone \.lp2-hand-stack \{[^}]*width:min\(100%,420px\)/, "les trois étapes gardent leur taille");
});

test("en-tête public : à partir de 1200 px, marque à gauche, liens centrés sur la page, actions à droite", () => {
  const css = read("src/app/site-pages.css");
  assert.match(css, /\.pub-header:not\(\.pub-header--connected\) \{ display: grid; grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\); \}/);
  assert.match(css, /\.pub-header:not\(\.pub-header--connected\) \.pub-actions \{ justify-self: end; margin-left: 0; \}/);
  assert.match(css, /\.pub-menu \{ position: static; display: flex; align-items: center; justify-content: center;/);
});

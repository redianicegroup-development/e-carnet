// Héro mobile du 15/11/2026 (2e demande) : les deux boutons côte à côte, et l'image qui, une fois grossie, ne rétrécit plus à la fin
// (elle ne rétrécit qu'en remontant, vers son carré du titre).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("mobile : « Commencer » à gauche et « Je suis professionnel » à droite, sur la même ligne et de même largeur", () => {
  const css = read("src/app/landing-showcase.css");
  const mobile = css.slice(css.indexOf("@media (max-width: 759px)"));
  assert.match(mobile, /\.lp-hero \.actions \{[^}]*display: grid;[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(mobile, /\.lp-hero \.actions \.button \{[^}]*width: 100%/);
});

test("mobile : l'image grossie reste pleine, seul l'ordinateur la rétrécit en carte à la fin", () => {
  const motion = read("src/components/motion/LandingMotion.tsx");
  assert.match(motion, /const compact = window\.innerWidth < 760/);
  assert.match(motion, /if \(compact\) tl\.to\(\{\}, \{ duration: 0\.14 \}, 0\.86\);/, "même longueur de défilement sur mobile");
  assert.match(motion, /else tl\.fromTo\(media, \{ scale: 1, borderRadius: 0 \}, \{ scale: rest/, "ordinateur : grande carte à la fin, comme avant");
});

test("l'image part toujours du carré du titre et y revient en remontant (liée au défilement, réversible)", () => {
  const motion = read("src/components/motion/LandingMotion.tsx");
  assert.match(motion, /scrub: 0\.4/);
  assert.match(motion, /scale: \(\) => startState\(\)\.scale, x: \(\) => startState\(\)\.x, y: \(\) => startState\(\)\.y, clipPath: \(\) => startState\(\)\.clipPath/);
});

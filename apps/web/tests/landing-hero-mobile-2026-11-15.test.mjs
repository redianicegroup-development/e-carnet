// Héro mobile du 15/11/2026 (2e demande) : les deux boutons côte à côte, et l'image qui, une fois grossie, ne rétrécit plus à la fin
// (elle ne rétrécit qu'en remontant, vers son carré du titre).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const landing = await import("../src/lib/landing-content.ts");
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("héro : « Commencer » et « Comment ça marche » côte à côte sous le slogan, sans le bouton « Je suis professionnel »", () => {
  const page = read("src/app/page.tsx");
  const hero = page.slice(page.indexOf('<section className="lp-hero"'), page.indexOf("</section>", page.indexOf('<section className="lp-hero"')));
  assert.equal((hero.match(/className="button/g) ?? []).length, 2);
  assert.match(hero, /HERO\.primary\.label/);
  assert.match(hero, /HERO\.tour\.href/);
  assert.ok(!hero.includes("HERO.secondary"), "plus de bouton « Je suis professionnel » dans le héro");
  assert.equal(landing.HERO.tour.href, "/#parcours");
  assert.match(read("src/app/landing-hero.css"), /\.lp-hero \.actions \{ display: flex; flex-wrap: wrap; justify-content: center;/);
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

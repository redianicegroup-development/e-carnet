// Illustrations de modal : tracés alignés sur les SVG du dossier public, gréement complet, mouvement réservé aux
// préférences « mouvement autorisé », et « success » = le personnage du login.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;
const read = (rel) => readFileSync(`${root}${rel}`, "utf8");
const { ILLUSTRATION_PATHS } = await import("../src/components/modal/illustrationPaths.ts");
const { ANSWER_PATH } = await import("../src/components/auth/answerPath.ts");

const DRAWN = ["welcome", "morning", "evening", "question", "decision", "farewell", "listening", "oops"];

test("les tracés recopiés sont identiques aux SVG de public/illustrations/modal", () => {
  assert.deepEqual(Object.keys(ILLUSTRATION_PATHS).sort(), [...DRAWN].sort());
  for (const mood of DRAWN) {
    const svg = read(`public/illustrations/modal/${mood}.svg`);
    assert.equal(svg.match(/viewBox="([^"]+)"/)[1], ILLUSTRATION_PATHS[mood].viewBox, `${mood} : viewBox`);
    assert.equal([...svg.matchAll(/<path[^>]* d="([^"]+)"/g)].map((m) => m[1]).join(" "), ILLUSTRATION_PATHS[mood].d, `${mood} : tracé (contour + visage)`);
    assert.match(ILLUSTRATION_PATHS[mood].viewBox, /^0 0 \d+ \d+$/, `${mood} : le viewBox doit partir de 0 0`);
  }
});

test("success est le personnage du login (même tracé) et l'illustration l'utilise", () => {
  assert.equal([...read("public/illustrations/modal/success.svg").matchAll(/<path[^>]* d="([^"]+)"/g)].map((m) => m[1]).join(" "), ANSWER_PATH);
  const component = read("src/components/modal/ModalIllustration.tsx");
  assert.match(component, /mood === "success" \? <WelcomeCharacter mood="greet"/);
});

test("chaque humeur dessinée a ses parties et ses yeux, tous dans le dessin, avec leurs mouvements", async () => {
  const { PARTS } = await import("../src/components/modal/illustrationParts.ts");
  const { EXTRAS } = await import("../src/components/modal/illustrationRigs.tsx").catch(() => ({ EXTRAS: null }));
  void EXTRAS; // le JSX n'est pas importable sous node : on contrôle le fichier source plus bas
  const css = read("src/components/modal/illustration.css");
  const extras = read("src/components/modal/illustrationRigs.tsx");
  assert.deepEqual(Object.keys(PARTS).sort(), [...DRAWN].sort());
  for (const mood of DRAWN) {
    assert.ok(css.includes(`.mi[data-mood="${mood}"]`), `${mood} : origine de la figure absente du CSS`);
    assert.ok(extras.includes(`  ${mood}:`), `${mood} : décor absent de illustrationRigs.tsx`);
    const [, , width, height] = ILLUSTRATION_PATHS[mood].viewBox.split(" ").map(Number);
    const names = PARTS[mood].parts.map((part) => part.name);
    for (const part of PARTS[mood].parts) {
      assert.ok(css.includes(`.mi[data-mood="${mood}"] .mi-${part.name}`), `${mood} : aucun mouvement pour la partie ${part.name}`);
      for (const [x, y] of part.poly) assert.ok(x >= 0 && x <= width && y >= 0 && y <= height, `${mood}/${part.name} : point (${x}, ${y}) hors du dessin`);
      assert.match(part.origin, /^-?\d+(\.\d+)?px -?\d+(\.\d+)?px$/, `${mood}/${part.name} : origine de rotation`);
    }
    for (const eye of PARTS[mood].eyes) {
      assert.ok(eye.x >= 0 && eye.y >= 0 && eye.x + eye.w <= width && eye.y + eye.h <= height, `${mood} : œil hors du dessin`);
      if (eye.parent) assert.ok(names.includes(eye.parent), `${mood} : l'œil suit une partie inconnue (${eye.parent})`);
    }
  }
  assert.ok(css.includes("@keyframes mi-blink"));
});

test("les mouvements ne s'appliquent qu'avec prefers-reduced-motion: no-preference", () => {
  const css = read("src/components/modal/illustration.css");
  const animated = css.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}\n/, "");
  assert.doesNotMatch(animated.replace(/@keyframes[^\n]*/g, ""), /animation\s*:/, "une animation est déclarée hors du bloc « mouvement autorisé »");
});

test("l'ancien masque CSS est remplacé par le SVG animé et les fichiers publics restent en place", () => {
  assert.doesNotMatch(read("src/components/modal/modal.css"), /\.modal-illustration::before/);
  assert.match(read("src/components/modal/ModalIllustration.tsx"), /import "\.\/illustration\.css"/);
  for (const mood of [...DRAWN, "success"]) assert.ok(existsSync(`${root}public/illustrations/modal/${mood}.svg`), `${mood}.svg`);
});

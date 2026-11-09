// UX-03 : les calculs qui tranchent les contrôles de contraste « à vérifier » de l'audit d'accessibilité.
import assert from "node:assert/strict";
import test from "node:test";

const lib = await import("../../../ops/lib/wcag-contrast.mjs");

test("noir sur blanc : 21:1, blanc sur blanc : 1:1", () => {
  assert.equal(Math.round(lib.contrastRatio(lib.relativeLuminance([0, 0, 0]), lib.relativeLuminance([255, 255, 255]))), 21);
  assert.equal(lib.contrastRatio(1, 1), 1);
});

test("les couleurs CSS rgb() et rgba() sont lues", () => {
  assert.deepEqual(lib.parseColor("rgb(30, 58, 52)"), [30, 58, 52, 1]);
  assert.deepEqual(lib.parseColor("rgba(30, 58, 52, 0.5)"), [30, 58, 52, 0.5]);
  assert.equal(lib.parseColor("transparent"), null);
});

test("seuils : 3:1 pour le grand texte, 4,5:1 sinon", () => {
  assert.equal(lib.requiredRatio(16, "400"), 4.5);
  assert.equal(lib.requiredRatio(24, "400"), 3);
  assert.equal(lib.requiredRatio(19, "700"), 3);
  assert.equal(lib.requiredRatio(18, "700"), 4.5);
});

test("pire cas sur un dégradé : texte foncé sur fond clair conforme, texte au milieu du dégradé insuffisant", () => {
  const ink = lib.relativeLuminance([30, 58, 52]);
  const range = lib.luminanceRange([255, 227, 178, 255, 247, 230, 250, 240, 200]);
  assert.ok(lib.worstCaseRatio(ink, range.min, range.max) >= 4.5);
  assert.equal(lib.worstCaseRatio(0.5, 0.2, 0.9), 1); // la luminance du texte est dans la plage du fond : pire cas = illisible
});

test("le script d'audit couvre les espaces connectés, les palettes et le focus masqué", async () => {
  const { readFileSync } = await import("node:fs");
  const script = readFileSync(new URL("../../../ops/accessibility-wcag-audit.mjs", import.meta.url), "utf8");
  for (const space of ["patient", "professionnel", "etablissement"]) assert.ok(script.includes(`${space}: [`), `${space} non couvert`);
  assert.match(script, /A11Y_PALETTES/);
  assert.match(script, /focusObscured/);
  assert.match(script, /resolveContrast/);
});

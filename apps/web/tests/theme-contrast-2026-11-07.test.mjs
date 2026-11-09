// UX-03 : toutes les palettes proposées gardent un contraste lisible pour les couleurs dérivées, y compris sur la teinte c2.
import assert from "node:assert/strict";
import test from "node:test";

const themes = await import("../../../packages/ui/src/themes.ts");
const PAIRS = [
  ["text", "bg", 7], ["text", "surface", 7], ["text", "surface-tint", 7],
  ["text-muted", "bg", 4.5], ["text-muted", "surface", 4.5], ["text-muted", "surface-tint", 4.5],
  ["primary-text", "bg", 4.5], ["primary-text", "surface", 4.5], ["primary-text", "surface-tint", 4.5],
  ["on-primary", "primary", 4.5],
  ["focus", "bg", 3], ["focus", "surface", 3], ["focus", "surface-tint", 3],
  ["border-strong", "bg", 3], ["border-strong", "surface", 3],
];

for (const [id, palette] of Object.entries(themes.PALETTES)) {
  test(`palette « ${palette.label} » : contrastes des couleurs dérivées (WCAG 2.2 AA)`, () => {
    const vars = themes.resolveTheme({ palette: palette.colors, font_pair: "sora-bricolage", text_scale: "normal" });
    for (const [fg, bg, min] of PAIRS) {
      const ratio = themes.contrast(vars[`--${fg}`], vars[`--${bg}`]);
      assert.ok(ratio >= min, `${id} : ${fg} sur ${bg} = ${ratio.toFixed(2)} (minimum ${min})`);
    }
  });
}

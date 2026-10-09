// Le thème par défaut (palette Lagon, police Unbounded) est un choix produit : tout changement doit être délibéré.
import assert from "node:assert/strict";
import test from "node:test";

const themes = await import("../../../packages/ui/src/themes.ts");

test("le thème par défaut reste Lagon + Unbounded", () => {
  assert.deepEqual([...themes.DEFAULT_THEME.palette], ["#E6FFF7", "#B9F2E3", "#7AD8C8", "#4AA1A3", "#2A4B5D"]);
  assert.equal(themes.DEFAULT_THEME.font, "Unbounded");
});

test("toutes les palettes et toutes les polices restent proposées à la personnalisation", () => {
  assert.equal(Object.keys(themes.PALETTES).length, 9);
  assert.equal(themes.FONTS.length, 12);
});

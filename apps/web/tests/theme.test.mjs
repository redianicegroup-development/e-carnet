// Le thème par défaut (Miel, texte Bricolage Grotesque) est un choix produit : tout changement doit être délibéré.
import assert from "node:assert/strict";
import test from "node:test";

const themes = await import("../../../packages/ui/src/themes.ts");

test("le thème par défaut est Miel + Bricolage Grotesque", () => {
  assert.deepEqual([...themes.DEFAULT_THEME.palette], ["#FFF7E6", "#FFE3B3", "#FFC857", "#4BAA8B", "#1E3A34"]);
  assert.equal(themes.DEFAULT_THEME.font_pair, "sora-bricolage");
  assert.equal(themes.DEFAULT_THEME.text_scale, "normal");
});

test("les cinq palettes et les trois paires de polices retenues restent proposées", () => {
  assert.deepEqual(Object.keys(themes.PALETTES).sort(), ["argile", "lavande", "miel", "rose", "sauge"]);
  assert.deepEqual(Object.keys(themes.FONT_PAIRS), ["sora-bricolage", "mooli-manrope", "fredoka-quicksand"]);
  assert.deepEqual(Object.keys(themes.TEXT_SCALES), ["normal", "large", "very-large"]);
});

test("un thème enregistré est mis en cache sur l’appareil et le cache actif peut être effacé", async () => {
  const values = new Map();
  globalThis.window = { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  } };
  const storage = await import("../src/lib/themeStorage.ts");
  const selected = { font_pair: "mooli-manrope", text_scale: "large", palette: ["#FFF7E6", "#FFE3B3", "#FFC857", "#4BAA8B", "#1E3A34"] };
  storage.cacheTheme(selected, "account-a");
  assert.deepEqual(storage.readCachedTheme(), selected);
  storage.clearActiveThemeCache();
  assert.equal(storage.readCachedTheme(), null);
});

test("les préférences historiques à police unique sont normalisées vers une paire, puis uniquement les familles retenues restent proposées", () => {
  const old = { font: "Mooli", palette: [...themes.DEFAULT_THEME.palette] };
  assert.deepEqual(themes.normalizeTheme(old), { font_pair: "mooli-manrope", text_scale: "normal", palette: [...themes.DEFAULT_THEME.palette] });
  assert.equal(themes.normalizeTheme({ ...old, font_pair: "injected" }), null);
});

test("la paire Fredoka/Quicksand n’est appliquée qu’à l’espace patient, sans changer la préférence sauvegardée", () => {
  const rounded = { ...themes.DEFAULT_THEME, font_pair: "fredoka-quicksand" };
  assert.equal(themes.themeForWorkspace(rounded, "patient").font_pair, "fredoka-quicksand");
  assert.equal(themes.themeForWorkspace(rounded, "professional").font_pair, "sora-bricolage");
  assert.equal(themes.themeForWorkspace(rounded, "establishment").font_pair, "sora-bricolage");
  assert.equal(rounded.font_pair, "fredoka-quicksand");
});

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

test("un thème enregistré est mis en cache sur l’appareil et le cache actif peut être effacé", async () => {
  const values = new Map();
  globalThis.window = { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  } };
  const storage = await import("../src/lib/themeStorage.ts");
  const selected = { font: "Sora", palette: ["#E9F7F2", "#BFE8D6", "#63C6A7", "#2F7E6A", "#1F2E2C"] };
  storage.cacheTheme(selected, "account-a");
  assert.deepEqual(storage.readCachedTheme(), selected);
  storage.clearActiveThemeCache();
  assert.equal(storage.readCachedTheme(), null);
});

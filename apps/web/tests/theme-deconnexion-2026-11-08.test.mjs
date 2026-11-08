import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("thème : déconnecté = palette Miel et police par défaut, connecté = préférences du compte", () => {
  const boot = read("src/components/ThemeBootstrap.tsx");
  assert.match(boot, /response\.status === 401 \|\| response\.status === 403\) return null/, "un visiteur non connecté (401/403) retombe sur le thème par défaut");
  assert.match(boot, /toDefault\(\)/);
  assert.match(boot, /THEME_RESET_EVENT/, "la déconnexion remet le thème par défaut sans recharger la page");
  assert.match(boot, /AUTH_CHANGED_EVENT/, "la connexion recharge les préférences du compte sans recharger la page");
  assert.match(boot, /pageshow/, "retour depuis le cache du navigateur : le thème est revérifié");
  const storage = read("src/lib/themeStorage.ts");
  assert.match(storage, /export function resetThemeToDefault[\s\S]*clearActiveThemeCache\(\)[\s\S]*applyTheme\(document\.documentElement, defaultTheme\(\)\)/);
  assert.match(read("src/lib/logout.ts"), /cleanUpBeforeLogout\(\): Promise<void> \{\s*resetThemeToDefault\(\)/, "toutes les déconnexions passent par cette fonction");
  assert.match(read("src/components/AuthForms.tsx"), /announceAuthChange\(\); router\.replace\(destination\)/);
});

test("pied de page : « remonter » reste fixé à droite malgré `body .button` (position: relative)", () => {
  const css = read("src/app/soft-skin.css");
  assert.match(css, /body \.button\.public-scroll-top \{ position: fixed; left: auto; right: max\(18px/);
});

test("logo Redianice : crédits, à propos, schéma d'équipe et pied de page", () => {
  assert.ok(existsSync(new URL("public/brand/redianice-logo.png", root)));
  assert.match(read("src/app/credits/page.tsx"), /<RedianiceLogo width=\{150\} \/>/);
  assert.match(read("src/app/a-propos/page.tsx"), /<RedianiceLogo width=\{150\} className="about__rdn" \/>/);
  assert.match(read("src/components/public/figures/CreditsFigures.tsx"), /<foreignObject[^>]*><RedianiceLogo/);
  assert.match(read("src/app/site-pages.css"), /\.rdn-logo \{[^}]*mask: url\(\/brand\/redianice-logo\.png\)/);
});

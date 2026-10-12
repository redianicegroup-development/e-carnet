import { DEFAULT_THEME, FONTS, validatePalette, type ThemeConfig } from "@ecarnet/ui/themes";

const ACTIVE_ACCOUNT_KEY = "ecarnet:theme:v1:active-account";
const ACCOUNT_THEME_PREFIX = "ecarnet:theme:v1:account:";

function parseTheme(raw: string | null): ThemeConfig | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ThemeConfig>;
    if (!value || typeof value.font !== "string" || !FONTS.includes(value.font as (typeof FONTS)[number])) return null;
    if (!Array.isArray(value.palette) || value.palette.length !== 5 || value.palette.some((color) => typeof color !== "string")) return null;
    if (validatePalette(value.palette).length) return null;
    return { font: value.font as ThemeConfig["font"], palette: value.palette as unknown as ThemeConfig["palette"] };
  } catch {
    return null;
  }
}

/** Retourne le thème du dernier compte actif sur cet appareil, s’il est encore valide. */
export function readCachedTheme(): ThemeConfig | null {
  try {
    const accountId = window.localStorage.getItem(ACTIVE_ACCOUNT_KEY);
    if (!accountId) return null;
    return parseTheme(window.localStorage.getItem(`${ACCOUNT_THEME_PREFIX}${accountId}`));
  } catch {
    return null;
  }
}

/** Enregistre une copie locale non sensible, propre au compte ; l’API reste la source de vérité. */
export function cacheTheme(theme: ThemeConfig, accountId: string): void {
  try {
    const normalized = parseTheme(JSON.stringify(theme));
    if (!normalized) return;
    window.localStorage.setItem(`${ACCOUNT_THEME_PREFIX}${accountId}`, JSON.stringify(normalized));
    window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
  } catch {
    // Le réglage sur le compte continue de fonctionner même si le navigateur refuse son stockage local.
  }
}

export function clearActiveThemeCache(): void {
  try {
    window.localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    // Le serveur fournira quand même le thème par défaut à un visiteur anonyme.
  }
}

export function defaultTheme(): ThemeConfig {
  return { font: DEFAULT_THEME.font, palette: [...DEFAULT_THEME.palette] as unknown as ThemeConfig["palette"] };
}

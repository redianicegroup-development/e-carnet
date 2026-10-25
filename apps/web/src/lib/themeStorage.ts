import { DEFAULT_THEME, normalizeTheme, type ThemeConfig } from "@ecarnet/ui/themes";

const ACTIVE_ACCOUNT_KEY = "ecarnet:theme:v1:active-account";
const ACCOUNT_THEME_PREFIX = "ecarnet:theme:v1:account:";

/** Seul point d’accès au stockage local de l’application (le test `legal` l’impose et la politique de confidentialité le déclare).
    Sert au cache du thème et à la mémoire « visite guidée déjà vue ». Retourne null si le navigateur le bloque. */
export function deviceStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

function parseTheme(raw: string | null): ThemeConfig | null {
  if (!raw) return null;
  try {
    return normalizeTheme(JSON.parse(raw));
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
  return { ...DEFAULT_THEME, palette: [...DEFAULT_THEME.palette] as unknown as ThemeConfig["palette"] };
}

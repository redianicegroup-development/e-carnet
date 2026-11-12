/* Langue de l'application : français par défaut ; anglais et arabe par Google Translate (traduction automatique du texte affiché).
   Le choix est gardé sur l'appareil (localStorage) ; le cookie « googtrans » est ce que lit le traducteur au chargement de la page. */

export type AppLanguage = "fr" | "en" | "ar";
export type LanguageInfo = { code: AppLanguage; label: string; native: string; dir: "ltr" | "rtl" };

export const LANGUAGES: ReadonlyArray<LanguageInfo> = [
  { code: "fr", label: "Français", native: "Français", dir: "ltr" },
  { code: "en", label: "Anglais", native: "English", dir: "ltr" },
  { code: "ar", label: "Arabe", native: "العربية", dir: "rtl" },
];

export const DEFAULT_LANGUAGE: AppLanguage = "fr";
export const LANGUAGE_KEY = "ecarnet-language";
export const TRANSLATE_CONSENT_KEY = "ecarnet-translate-consent";
export const TRANSLATE_COOKIE = "googtrans";

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === "fr" || value === "en" || value === "ar";
}

export function languageInfo(code: AppLanguage): LanguageInfo {
  return LANGUAGES.find((item) => item.code === code) ?? LANGUAGES[0];
}

/** Valeur du cookie lu par Google Translate : « /fr/en » ; vide pour le français (aucune traduction). */
export function translateCookieValue(code: AppLanguage): string {
  return code === DEFAULT_LANGUAGE ? "" : `/${DEFAULT_LANGUAGE}/${code}`;
}

type ReadableStorage = Pick<Storage, "getItem">;

export function readStoredLanguage(storage?: ReadableStorage): AppLanguage {
  try {
    const value = (storage ?? window.localStorage).getItem(LANGUAGE_KEY);
    return isAppLanguage(value) ? value : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function storeLanguage(code: AppLanguage): void {
  try {
    if (code === DEFAULT_LANGUAGE) window.localStorage.removeItem(LANGUAGE_KEY);
    else window.localStorage.setItem(LANGUAGE_KEY, code);
  } catch { /* stockage refusé : la langue vaudra pour cette session seulement */ }
}

export function hasTranslateConsent(): boolean {
  try { return window.localStorage.getItem(TRANSLATE_CONSENT_KEY) === "1"; } catch { return false; }
}

export function rememberTranslateConsent(): void {
  try { window.localStorage.setItem(TRANSLATE_CONSENT_KEY, "1"); } catch { /* sans effet */ }
}

/** Pose (ou retire, pour le français) le cookie du traducteur, sur l'hôte et sur son domaine parent comme le fait Google. */
export function writeTranslateCookie(code: AppLanguage): void {
  if (typeof document === "undefined") return;
  const host = window.location.hostname;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const value = translateCookieValue(code);
  const scopes = ["", `; domain=${host}`, `; domain=.${host}`];
  for (const scope of scopes) {
    document.cookie = value
      ? `${TRANSLATE_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax${secure}${scope}`
      : `${TRANSLATE_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secure}${scope}`;
  }
}

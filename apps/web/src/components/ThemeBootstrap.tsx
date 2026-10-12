"use client";

import { useEffect } from "react";
import { applyTheme, DEFAULT_THEME, type ThemeConfig } from "@ecarnet/ui/themes";
import { cacheTheme, clearActiveThemeCache, defaultTheme, readCachedTheme } from "../lib/themeStorage";

const API = "";
type ThemeResponse = { success?: boolean; data?: ThemeConfig; account_id?: string | null };

export function ThemeBootstrap() {
  useEffect(() => {
    let active = true;
    const cached = readCachedTheme();
    applyTheme(document.documentElement, cached ?? defaultTheme());

    fetch(`${API}/api/v1/identity/me/theme/`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Préférences du compte indisponibles.");
        return await response.json() as ThemeResponse;
      })
      .then((payload) => {
        if (!active) return;
        const theme = payload.data;
        if (theme?.palette && theme.font && payload.account_id) {
          cacheTheme(theme, payload.account_id);
          applyTheme(document.documentElement, theme);
        } else {
          clearActiveThemeCache();
          applyTheme(document.documentElement, DEFAULT_THEME);
        }
      })
      .catch(() => {
        if (active && !cached) applyTheme(document.documentElement, DEFAULT_THEME);
      });
    return () => { active = false; };
  }, []);
  return null;
}

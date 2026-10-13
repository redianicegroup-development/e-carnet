"use client";

import { useEffect, useRef } from "react";
import { applyTheme, DEFAULT_THEME, normalizeTheme, themeForWorkspace, type ThemeConfig, type ThemeWorkspace } from "@ecarnet/ui/themes";
import { usePathname } from "next/navigation";
import { cacheTheme, clearActiveThemeCache, defaultTheme, readCachedTheme } from "../lib/themeStorage";

const API = "";
type ThemeResponse = { success?: boolean; data?: unknown; account_id?: string | null };

export function ThemeBootstrap() {
  const pathname = usePathname();
  const workspace: ThemeWorkspace = pathname?.startsWith("/patient") ? "patient" : pathname?.startsWith("/etablissement") ? "establishment" : "professional";
  const themeRef = useRef<ThemeConfig>(DEFAULT_THEME);
  const workspaceRef = useRef<ThemeWorkspace>(workspace);

  useEffect(() => {
    workspaceRef.current = workspace;
    applyTheme(document.documentElement, themeForWorkspace(themeRef.current, workspace));
  }, [workspace]);

  useEffect(() => {
    let active = true;
    const cached = readCachedTheme();
    themeRef.current = cached ?? defaultTheme();
    applyTheme(document.documentElement, themeForWorkspace(themeRef.current, workspaceRef.current));

    fetch(`${API}/api/v1/identity/me/theme/`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Préférences du compte indisponibles.");
        return await response.json() as ThemeResponse;
      })
      .then((payload) => {
        if (!active) return;
        const theme = normalizeTheme(payload.data);
        if (theme && payload.account_id) {
          cacheTheme(theme, payload.account_id);
          themeRef.current = theme;
          applyTheme(document.documentElement, themeForWorkspace(theme, workspaceRef.current));
        } else {
          clearActiveThemeCache();
          themeRef.current = theme ?? DEFAULT_THEME;
          applyTheme(document.documentElement, themeForWorkspace(themeRef.current, workspaceRef.current));
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return null;
}

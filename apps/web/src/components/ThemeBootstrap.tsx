"use client";

import { useEffect, useRef } from "react";
import { applyTheme, normalizeTheme, themeForWorkspace, type ThemeConfig, type ThemeWorkspace } from "@ecarnet/ui/themes";
import { usePathname } from "next/navigation";
import { AUTH_CHANGED_EVENT, THEME_RESET_EVENT, cacheTheme, clearActiveThemeCache, defaultTheme, readCachedTheme } from "../lib/themeStorage";

const API = "";
type ThemeResponse = { success?: boolean; data?: unknown; account_id?: string | null };

/**
 * Règle : déconnecté = palette Miel et police par défaut, partout (pages publiques comprises) ;
 * connecté = les préférences du compte, chargées depuis l'API, sur toutes les pages.
 * Le thème est donc recalculé au chargement, à la connexion, à la déconnexion et au retour depuis le cache du navigateur.
 */
export function ThemeBootstrap() {
  const pathname = usePathname();
  const workspace: ThemeWorkspace = pathname?.startsWith("/patient") ? "patient" : pathname?.startsWith("/etablissement") || pathname?.startsWith("/laboratoire") ? "establishment" : "professional";
  const themeRef = useRef<ThemeConfig>(defaultTheme());
  const workspaceRef = useRef<ThemeWorkspace>(workspace);

  useEffect(() => {
    workspaceRef.current = workspace;
    applyTheme(document.documentElement, themeForWorkspace(themeRef.current, workspace));
  }, [workspace]);

  useEffect(() => {
    let sequence = 0; // ignore les réponses devenues obsolètes (déconnexion pendant un chargement)
    const show = (theme: ThemeConfig) => {
      themeRef.current = theme;
      applyTheme(document.documentElement, themeForWorkspace(theme, workspaceRef.current));
    };
    const toDefault = () => { clearActiveThemeCache(); show(defaultTheme()); };

    const sync = () => {
      const mine = ++sequence;
      fetch(`${API}/api/v1/identity/me/theme/`, { credentials: "include", cache: "no-store" })
        .then(async (response) => {
          if (response.status === 401 || response.status === 403) return null; // visiteur non connecté
          if (!response.ok) throw new Error("Préférences du compte indisponibles.");
          return await response.json() as ThemeResponse;
        })
        .then((payload) => {
          if (mine !== sequence) return;
          const theme = payload ? normalizeTheme(payload.data) : null;
          if (payload && theme && payload.account_id) {
            cacheTheme(theme, payload.account_id);
            show(theme);
          } else {
            toDefault();
          }
        })
        // Hors connexion ou erreur du serveur : on garde la copie locale du compte, sans rien casser.
        .catch(() => undefined);
    };

    show(readCachedTheme() ?? defaultTheme());
    sync();

    const onReset = () => { sequence += 1; show(defaultTheme()); };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) sync(); };
    window.addEventListener(THEME_RESET_EVENT, onReset);
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      sequence += 1;
      window.removeEventListener(THEME_RESET_EVENT, onReset);
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);
  return null;
}

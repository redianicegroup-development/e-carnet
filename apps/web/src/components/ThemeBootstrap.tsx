"use client";

import { useEffect } from "react";
import { applyTheme, DEFAULT_THEME, type ThemeConfig } from "@ecarnet/ui/themes";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function ThemeBootstrap() {
  useEffect(() => {
    let active = true;
    fetch(`${API}/api/v1/identity/me/theme/`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json();
        return (payload?.data ?? payload) as ThemeConfig;
      })
      .then((theme) => { if (active && theme?.palette && theme?.font) applyTheme(document.documentElement, theme); })
      .catch(() => { if (active) applyTheme(document.documentElement, DEFAULT_THEME); });
    return () => { active = false; };
  }, []);
  return null;
}

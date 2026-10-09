"use client";

import { useEffect, useMemo, useState } from "react";
import { applyTheme, DEFAULT_THEME, FONTS, fontStack, PALETTES, type FontName, type Palette5, type ThemeConfig } from "@ecarnet/ui/themes";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";

type ApiEnvelope<T> = { success?: boolean; data?: T; detail?: string; message?: string };
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function ThemeSettingsClient() {
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [loaded, setLoaded] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [message, setMessage] = useState("Chargement du thème associé au compte…");
  const paletteEntries = Object.entries(PALETTES) as [string, { label: string; colors: Palette5 }][];
  const selectedPalette = useMemo(() => paletteEntries.find(([, p]) => p.colors.join("") === theme.palette.join(""))?.[0] ?? "custom", [paletteEntries, theme.palette]);

  useEffect(() => {
    let active = true;
    fetch(`${API}/api/v1/identity/me/theme/`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 403 ? "Une session connectée est nécessaire pour charger les préférences de votre compte." : "Le service de préférences est indisponible.");
        const payload = await response.json() as ApiEnvelope<ThemeConfig>;
        const value = payload.data ?? payload as unknown as ThemeConfig;
        if (active) {
          setTheme(value);
          setAuthenticated(true);
          setMessage("Thème chargé depuis votre compte.");
          applyTheme(document.documentElement, value);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Impossible de charger les préférences.");
          applyTheme(document.documentElement, DEFAULT_THEME);
        }
      })
      .finally(() => { if (active) { setLoaded(true); } });
    return () => { active = false; };
  }, []);

  function preview(next: ThemeConfig) {
    setTheme(next);
    try { applyTheme(document.documentElement, next); setMessage("Aperçu local — enregistrez pour le conserver sur votre compte."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Thème invalide."); }
  }

  async function save() {
    if (!authenticated) { setMessage("Connectez-vous pour enregistrer une préférence personnelle."); return; }
    setMessage("Enregistrement…");
    try {
      const csrf = await primeCsrf();
      if (!csrf.ok) throw new Error("Impossible d'établir la protection CSRF.");
      const response = await fetch(`${API}/api/v1/identity/me/theme/`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": readCsrfToken() },
        body: JSON.stringify(theme),
      });
      const payload = await response.json() as ApiEnvelope<ThemeConfig>;
      if (!response.ok) throw new Error(payload.detail ?? payload.message ?? "Le thème n'a pas pu être enregistré.");
      const saved = payload.data ?? payload as unknown as ThemeConfig;
      setTheme(saved);
      applyTheme(document.documentElement, saved);
      setMessage("Thème enregistré pour ce compte.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erreur d'enregistrement."); }
  }

  return <section className="card" aria-labelledby="theme-title">
    <h2 id="theme-title">Thème personnel</h2>
    <p className="muted">Le thème est enregistré sur le compte connecté. Aucun choix ne reste dans le navigateur.</p>
    <div className="grid">
      <div className="field"><label htmlFor="theme-font">Police</label><select id="theme-font" value={theme.font} onChange={(event) => preview({ ...theme, font: event.target.value as FontName })}>{FONTS.map((font) => <option key={font} value={font}>{font}{font === "Unbounded" ? " (par défaut)" : ""}</option>)}</select></div>
      <div className="field"><label htmlFor="theme-palette">Palette</label><select id="theme-palette" value={selectedPalette} onChange={(event) => { const palette = PALETTES[event.target.value as keyof typeof PALETTES]; if (palette) preview({ ...theme, palette: palette.colors }); }}>{paletteEntries.map(([key, palette]) => <option key={key} value={key}>{palette.label}{key === "lagon" ? " (par défaut)" : ""}</option>)}</select></div>
    </div>
    <div aria-label="Aperçu des cinq couleurs" className="swatches">{theme.palette.map((color, index) => <span key={`${color}-${index}`} className="swatch" style={{ backgroundColor: color }} title={`Couleur ${index + 1} : ${color}`} />)}</div>
    <p className="notice" style={{ fontFamily: fontStack(theme.font), fontWeight: 800 }}>Aperçu · Un thème pour votre compte</p>
    <div className="actions"><button type="button" className="button primary" disabled={!loaded || !authenticated} onClick={save}>Enregistrer sur mon compte</button><button type="button" className="button" onClick={() => preview(DEFAULT_THEME)}>Rétablir le thème par défaut</button></div>
    <p role="status" aria-live="polite" className="status">{message}</p>
  </section>;
}

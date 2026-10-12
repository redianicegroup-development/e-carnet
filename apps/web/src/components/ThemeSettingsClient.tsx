"use client";

import { useEffect, useMemo, useState } from "react";
import { applyTheme, DEFAULT_THEME, FONTS, fontStack, PALETTES, type FontName, type Palette5, type ThemeConfig } from "@ecarnet/ui/themes";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";
import { cacheTheme, defaultTheme, readCachedTheme } from "../lib/themeStorage";

type ApiEnvelope<T> = { success?: boolean; data?: T; detail?: string; message?: string; account_id?: string | null };
type Props = { compact?: boolean };
const API = "";

export function ThemeSettingsClient({ compact = false }: Props) {
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [loaded, setLoaded] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [message, setMessage] = useState("Chargement du thème associé au compte…");
  const paletteEntries = Object.entries(PALETTES) as [string, { label: string; colors: Palette5 }][];
  const selectedPalette = useMemo(() => paletteEntries.find(([, palette]) => palette.colors.join("") === theme.palette.join(""))?.[0] ?? "custom", [paletteEntries, theme.palette]);

  useEffect(() => {
    let active = true;
    const cached = readCachedTheme();
    if (cached) applyTheme(document.documentElement, cached);
    fetch(`${API}/api/v1/identity/me/theme/`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 403 ? "Une session connectée est nécessaire pour charger les préférences de votre compte." : "Le service de préférences est indisponible.");
        return await response.json() as ApiEnvelope<ThemeConfig>;
      })
      .then((payload) => {
        const value = payload.data ?? payload as unknown as ThemeConfig;
        if (!active) return;
        setTheme(value);
        setAuthenticated(Boolean(payload.account_id));
        setAccountId(payload.account_id ?? null);
        setMessage("Thème chargé depuis votre compte.");
        applyTheme(document.documentElement, value);
        if (payload.account_id) cacheTheme(value, payload.account_id);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (cached) {
          setTheme(cached);
          setMessage("Thème de cet appareil chargé ; synchronisation du compte indisponible pour le moment.");
        } else {
          setMessage(error instanceof Error ? error.message : "Impossible de charger les préférences.");
          applyTheme(document.documentElement, defaultTheme());
        }
      })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  function preview(next: ThemeConfig) {
    setTheme(next);
    try {
      applyTheme(document.documentElement, next);
      setMessage("Aperçu instantané — enregistrez pour le conserver sur votre compte et cet appareil.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Thème invalide.");
    }
  }

  async function save() {
    if (!authenticated) { setMessage("Connectez-vous pour enregistrer une préférence personnelle."); return; }
    setMessage("Enregistrement sur votre compte…");
    try {
      const csrf = await primeCsrf();
      if (!csrf.ok) throw new Error("Impossible d’établir la protection CSRF.");
      const response = await fetch(`${API}/api/v1/identity/me/theme/`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": readCsrfToken() },
        body: JSON.stringify(theme),
      });
      const payload = await response.json() as ApiEnvelope<ThemeConfig>;
      if (!response.ok) throw new Error(payload.detail ?? payload.message ?? "Le thème n’a pas pu être enregistré.");
      const saved = payload.data ?? payload as unknown as ThemeConfig;
      const savedAccountId = payload.account_id ?? accountId;
      setTheme(saved);
      applyTheme(document.documentElement, saved);
      if (savedAccountId) cacheTheme(saved, savedAccountId);
      setMessage("Thème enregistré sur votre compte et mis en cache sur cet appareil. Vous le retrouverez sur vos autres appareils.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur d’enregistrement.");
    }
  }

  const content = (
    <>
      {compact && <h3>Thème personnel</h3>}
      <p className="muted">Choisissez votre police et votre palette. L’aperçu s’applique immédiatement ; enregistrez pour synchroniser le choix sur votre compte et vos appareils.</p>
      <div className="grid">
        <div className="field"><label htmlFor="theme-font">Police</label><select id="theme-font" disabled={!loaded} value={theme.font} onChange={(event) => preview({ ...theme, font: event.target.value as FontName })}>{FONTS.map((font) => <option key={font} value={font}>{font}{font === "Bricolage Grotesque" ? " (par défaut)" : ""}</option>)}</select></div>
        <div className="field"><label htmlFor="theme-palette">Palette</label><select id="theme-palette" disabled={!loaded} value={selectedPalette} onChange={(event) => { const palette = PALETTES[event.target.value as keyof typeof PALETTES]; if (palette) preview({ ...theme, palette: palette.colors }); }}>{paletteEntries.map(([key, palette]) => <option key={key} value={key}>{palette.label}{key === "miel" ? " (par défaut)" : ""}</option>)}</select></div>
      </div>
      <div aria-label="Aperçu des cinq couleurs" className="swatches">{theme.palette.map((color, index) => <span key={`${color}-${index}`} className="swatch" style={{ backgroundColor: color }} title={`Couleur ${index + 1} : ${color}`} />)}</div>
      <p className="notice" style={{ fontFamily: fontStack(theme.font), fontWeight: 800 }}>Aperçu · Un thème pour votre compte</p>
      <div className="actions"><button type="button" className="button primary" disabled={!loaded || !authenticated} onClick={save}>Enregistrer sur mon compte</button><button type="button" className="button" disabled={!loaded} onClick={() => preview(defaultTheme())}>Rétablir le thème par défaut</button></div>
      <p role="status" aria-live="polite" className="status">{message}</p>
    </>
  );

  return compact
    ? <div className="settings-theme-panel">{content}</div>
    : <section className="card" aria-labelledby="theme-title"><h2 id="theme-title">Thème personnel</h2>{content}</section>;
}

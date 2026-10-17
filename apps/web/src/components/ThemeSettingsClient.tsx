"use client";

import { useEffect, useMemo, useState } from "react";
import { applyTheme, DEFAULT_THEME, FONT_PAIRS, fontStack, normalizeTheme, PALETTES, TEXT_SCALES, themeForWorkspace, type FontPairId, type Palette5, type TextScale, type ThemeConfig, type ThemeWorkspace } from "@ecarnet/ui/themes";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";
import { cacheTheme, defaultTheme, readCachedTheme } from "../lib/themeStorage";

type ApiEnvelope<T> = { success?: boolean; data?: T; detail?: string; message?: string; account_id?: string | null };
type Props = { compact?: boolean; space?: ThemeWorkspace };
const API = "";

export function ThemeSettingsClient({ compact = false, space = "patient" }: Props) {
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [loaded, setLoaded] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [message, setMessage] = useState("Chargement du thème associé au compte…");
  const paletteEntries = Object.entries(PALETTES) as [string, { label: string; colors: Palette5 }][];
  const fontPairEntries = Object.entries(FONT_PAIRS).filter(([key]) => space === "patient" || key !== "fredoka-quicksand");
  const selectedPalette = useMemo(() => paletteEntries.find(([, palette]) => palette.colors.join("") === theme.palette.join(""))?.[0] ?? "custom", [paletteEntries, theme.palette]);

  useEffect(() => {
    let active = true;
    const cached = readCachedTheme();
    if (cached) applyTheme(document.documentElement, themeForWorkspace(cached, space));
    fetch(`${API}/api/v1/identity/me/theme/`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 403 ? "Une session connectée est nécessaire pour charger les préférences de votre compte." : "Le service de préférences est indisponible.");
        return await response.json() as ApiEnvelope<unknown>;
      })
      .then((payload) => {
        const value = normalizeTheme(payload.data ?? payload);
        if (!value) throw new Error("Les préférences reçues ne sont pas valides.");
        if (!active) return;
        setTheme(value);
        setAuthenticated(Boolean(payload.account_id));
        setAccountId(payload.account_id ?? null);
        setMessage("Thème chargé depuis votre compte.");
        applyTheme(document.documentElement, themeForWorkspace(value, space));
        if (payload.account_id) cacheTheme(value, payload.account_id);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (cached) {
          setTheme(cached);
          setMessage("Thème de cet appareil chargé ; synchronisation du compte indisponible pour le moment.");
        } else {
          setMessage(error instanceof Error ? error.message : "Impossible de charger les préférences.");
          applyTheme(document.documentElement, themeForWorkspace(defaultTheme(), space));
        }
      })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [space]);

  function preview(next: ThemeConfig) {
    setTheme(next);
    try {
      applyTheme(document.documentElement, themeForWorkspace(next, space));
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
      const payload = await response.json() as ApiEnvelope<unknown>;
      if (!response.ok) throw new Error(payload.detail ?? payload.message ?? "Le thème n’a pas pu être enregistré.");
      const saved = normalizeTheme(payload.data ?? payload);
      if (!saved) throw new Error("Le service a renvoyé un thème invalide.");
      const savedAccountId = payload.account_id ?? accountId;
      setTheme(saved);
      applyTheme(document.documentElement, themeForWorkspace(saved, space));
      if (savedAccountId) cacheTheme(saved, savedAccountId);
      setMessage("Thème enregistré sur votre compte et mis en cache sur cet appareil. Vous le retrouverez sur vos autres appareils.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur d’enregistrement.");
    }
  }

  const content = (
    <>
      {compact && <h3>Thème personnel</h3>}
      <p className="muted">Choisissez une paire de polices, une taille de texte et une palette. L’aperçu s’applique immédiatement ; enregistrez pour synchroniser vos choix sur votre compte et vos appareils.</p>
      <div className="grid">
        <div className="field"><label htmlFor="theme-font-pair">Paire de polices</label><select id="theme-font-pair" disabled={!loaded} value={theme.font_pair} onChange={(event) => preview({ ...theme, font_pair: event.target.value as FontPairId })}>{!fontPairEntries.some(([key]) => key === theme.font_pair) && <option value={theme.font_pair} disabled>Fredoka and Quicksand (réservées à l’espace patient)</option>}{fontPairEntries.map(([key, pair]) => <option key={key} value={key}>{pair.label}{key === DEFAULT_THEME.font_pair ? " (par défaut)" : ""}</option>)}</select></div>
        <div className="field"><label htmlFor="theme-text-scale">Taille du texte</label><select id="theme-text-scale" disabled={!loaded} value={theme.text_scale} onChange={(event) => preview({ ...theme, text_scale: event.target.value as TextScale })}>{Object.entries(TEXT_SCALES).map(([key, scale]) => <option key={key} value={key}>{scale.label}{key === "normal" ? " (par défaut)" : ""}</option>)}</select><small className="muted">Ajuste l’échelle de l’interface sans bloquer le zoom du navigateur.</small></div>
        <div className="field"><label htmlFor="theme-palette">Palette</label><select id="theme-palette" disabled={!loaded} value={selectedPalette} onChange={(event) => { const palette = PALETTES[event.target.value as keyof typeof PALETTES]; if (palette) preview({ ...theme, palette: palette.colors }); }}>{paletteEntries.map(([key, palette]) => <option key={key} value={key}>{palette.label}{key === "miel" ? " (par défaut)" : ""}</option>)}</select><small className="muted">Toutes les palettes restent sélectionnables par chacun.</small></div>
      </div>
      <div aria-label="Aperçu des cinq couleurs" className="swatches">{theme.palette.map((color, index) => <span key={`${color}-${index}`} className="swatch" style={{ backgroundColor: color }} title={`Couleur ${index + 1} : ${color}`} />)}</div>
      <p className="notice" style={{ fontFamily: fontStack(themeForWorkspace(theme, space).font_pair, "heading"), fontWeight: 800 }}>Aperçu · Un thème pour votre compte</p>
      <div className="actions"><button type="button" className="button primary" disabled={!loaded || !authenticated} onClick={save}>Enregistrer sur mon compte</button><button type="button" className="button" disabled={!loaded} onClick={() => preview(defaultTheme())}>Rétablir le thème par défaut</button></div>
      <p role="status" aria-live="polite" className="status">{message}</p>
    </>
  );

  return compact
    ? <div className="settings-theme-panel">{content}</div>
    : <section className="card" aria-labelledby="theme-title"><h2 id="theme-title">Thème personnel</h2>{content}</section>;
}

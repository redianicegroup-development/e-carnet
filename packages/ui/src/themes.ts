/**
 * Thème d'un carnet : 5 couleurs source (c1→c5), une paire typographique et une échelle de texte.
 * Choix V1 : cinq palettes et trois paires de polices servies localement par next/font.
 * Règle : le thème ne touche JAMAIS aux couleurs sémantiques (statuts de provenance, danger) — voir tokens.css.
 * resolveTheme() garantit WCAG 2.1 AA (CDC 13.6) quelle que soit la palette cliente.
 */

export const FONT_PAIRS = {
  "sora-bricolage": { label: "Sora (titres) · Bricolage Grotesque (texte)", heading: "Sora", body: "Bricolage Grotesque" },
  "mooli-manrope": { label: "Mooli (titres) · Manrope (texte)", heading: "Mooli", body: "Manrope" },
  "fredoka-quicksand": { label: "Fredoka (titres) · Quicksand (texte, arrondi)", heading: "Fredoka", body: "Quicksand" },
} as const;
export type FontPairId = keyof typeof FONT_PAIRS;
export type FontName = (typeof FONT_PAIRS)[FontPairId]["body"] | (typeof FONT_PAIRS)[FontPairId]["heading"];
export const TEXT_SCALES = {
  normal: { label: "Standard", value: "100%" },
  large: { label: "Grand", value: "115%" },
  "very-large": { label: "Très grand", value: "130%" },
} as const;
export type TextScale = keyof typeof TEXT_SCALES;
export type ThemeWorkspace = "patient" | "professional" | "establishment";

/** [c1 fond, c2 teinte/bordure, c3 accent doux, c4 primaire, c5 encre] */
export type Palette5 = readonly [string, string, string, string, string];

export interface ThemeConfig {
  palette: Palette5;
  font_pair: FontPairId;
  text_scale: TextScale;
}

export const PALETTES = {
  sauge:   { label: "Sauge",   colors: ["#F2F5EF", "#D8E2D0", "#A9C4A5", "#5B7F68", "#2C3A33"] },
  miel:    { label: "Miel",    colors: ["#FFF7E6", "#FFE3B3", "#FFC857", "#4BAA8B", "#1E3A34"] },
  lavande: { label: "Violet", colors: ["#F6F2FF", "#E3D7FF", "#BCA6F6", "#5D64B8", "#1F2440"] },
  rose:    { label: "Rose",    colors: ["#FFF1F5", "#FFD2DF", "#F28AA8", "#B94D6D", "#3A1E2A"] },
  argile:  { label: "Argile",  colors: ["#FFF4EC", "#F6D8C3", "#DDA57A", "#4D8F86", "#1D2F33"] },
} as const satisfies Record<string, { label: string; colors: Palette5 }>;

export const DEFAULT_THEME: ThemeConfig = { palette: PALETTES.miel.colors, font_pair: "sora-bricolage", text_scale: "normal" };

/** Les polices très rondes restent réservées au patient; la préférence est conservée au compte. */
export function themeForWorkspace(theme: ThemeConfig, workspace: ThemeWorkspace): ThemeConfig {
  return workspace !== "patient" && theme.font_pair === "fredoka-quicksand" ? { ...theme, font_pair: "sora-bricolage" } : theme;
}

/** Normalise aussi les enregistrements historiques qui ne contiennent qu'une police `font`. */
export function normalizeTheme(value: unknown): ThemeConfig | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const palette = candidate.palette;
  if (!Array.isArray(palette) || palette.length !== 5 || palette.some((color) => typeof color !== "string") || validatePalette(palette as string[]).length) return null;
  const owns = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);
  if (candidate.font_pair !== undefined && (typeof candidate.font_pair !== "string" || !owns(FONT_PAIRS, candidate.font_pair))) return null;
  const legacyFont = candidate.font;
  const legacyPairs: Record<string, FontPairId> = {
    "Sora": "sora-bricolage", "Bricolage Grotesque": "sora-bricolage", "Mooli": "mooli-manrope", "Manrope": "mooli-manrope", "Fredoka": "fredoka-quicksand", "Quicksand": "fredoka-quicksand",
  };
  const pair = (typeof candidate.font_pair === "string" && owns(FONT_PAIRS, candidate.font_pair) ? candidate.font_pair : typeof legacyFont === "string" ? legacyPairs[legacyFont] : undefined) as FontPairId | undefined;
  const scale = candidate.text_scale;
  const textScale = typeof scale === "string" && owns(TEXT_SCALES, scale) ? scale as TextScale : "normal";
  return { palette: palette as unknown as Palette5, font_pair: pair ?? DEFAULT_THEME.font_pair, text_scale: textScale };
}

/* ---------- couleur ---------- */
const WHITE = "#FFFFFF";
const HEX = /^#[0-9a-fA-F]{6}$/;
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

export function luminance(h: string): number {
  const [r, g, b] = rgb(h).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
/** t=0 → a, t=1 → b */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return hex(x.map((v, i) => v + (y[i] - v) * t));
}
/** Rapproche `color` de `toward` par pas de 4 % jusqu'à atteindre `min` contre tous les fonds. */
function ensure(color: string, bgs: string[], min: number, toward: string): string {
  let c = color;
  for (let t = 0; t <= 1.0001; t += 0.04) {
    c = mix(color, toward, t);
    if (bgs.every((bg) => contrast(c, bg) >= min)) return c;
  }
  return toward;
}

/** Erreurs bloquantes pour une palette cliente (à utiliser à l'enregistrement, côté web ET côté API). */
export function validatePalette(p: readonly string[]): string[] {
  const errs: string[] = [];
  if (p.length !== 5 || !p.every((c) => HEX.test(c))) return ["5 couleurs hexadécimales #RRGGBB requises"];
  if (luminance(p[0]) < 0.6) errs.push("c1 (fond) doit être clair — pas de thème sombre en V1");
  if (luminance(p[4]) > 0.2) errs.push("c5 (encre) doit être foncé");
  return errs;
}

/* ---------- résolution : thème → variables CSS ---------- */
export function resolveTheme({ palette, font_pair, text_scale }: ThemeConfig): Record<string, string> {
  const errs = validatePalette(palette);
  if (errs.length) throw new Error(errs.join(" · "));
  const [c1, c2, c3, c4, c5] = palette;

  const ink = ensure(c5, [c1, WHITE], 7, "#000000");
  const text = ink;
  const textMuted = ensure(mix(ink, c1, 0.28), [c1, WHITE], 4.5, ink);

  // Primaire : on garde c4 si possible ; texte blanc sinon encre ; sinon on assombrit c4.
  let primary = c4;
  let onPrimary = WHITE;
  if (contrast(primary, WHITE) < 4.5) {
    if (contrast(primary, ink) >= 4.5) onPrimary = ink;
    else primary = ensure(c4, [WHITE], 4.5, ink);
  }
  const primaryText = ensure(c4, [c1, WHITE], 4.5, ink);
  const border = luminance(c2) > 0.85 ? c3 : c2;
  const borderStrong = ensure(mix(ink, WHITE, 0.55), [c1, WHITE], 3, ink); // bordures d'inputs ≥ 3:1 (WCAG 1.4.11)
  const focus = ensure(c4, [c1, WHITE], 3, ink);

  return {
    "--brand-1": c1, "--brand-2": c2, "--brand-3": c3, "--brand-4": c4, "--brand-5": c5,
    "--bg": c1,
    "--surface": WHITE,
    "--surface-tint": c2,
    "--border": border,
    "--border-strong": borderStrong,
    "--text": text,
    "--text-muted": textMuted,
    "--primary": primary,
    "--on-primary": onPrimary,
    "--primary-text": primaryText,
    "--primary-tint": c2,
    "--focus": focus,
    "--font-body": fontStack(font_pair, "body"),
    "--font-heading": fontStack(font_pair, "heading"),
    "--text-scale": TEXT_SCALES[text_scale].value,
  };
}

const FONT_VARIABLES: Record<FontName, string> = {
  Manrope: "--font-manrope",
  Sora: "--font-sora",
  Mooli: "--font-mooli",
  Quicksand: "--font-quicksand",
  "Bricolage Grotesque": "--font-bricolage-grotesque",
  Fredoka: "--font-fredoka",
};

export const fontStack = (pair: FontPairId, role: "body" | "heading" = "body") => {
  const name = FONT_PAIRS[pair][role];
  return `var(${FONT_VARIABLES[name]}, '${name}'), system-ui, -apple-system, 'Segoe UI', sans-serif`;
};

export function themeToStyle(cfg: ThemeConfig): string {
  return Object.entries(resolveTheme(cfg)).map(([k, v]) => `${k}:${v}`).join(";");
}
export function applyTheme(el: HTMLElement, cfg: ThemeConfig): void {
  for (const [k, v] of Object.entries(resolveTheme(cfg))) el.style.setProperty(k, v);
}

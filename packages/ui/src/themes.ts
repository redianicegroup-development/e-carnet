/**
 * Thème d'un carnet : 5 couleurs source (c1→c5) + 1 police.
 * Source : maquettes Espace_*.html (palette Miel par défaut, 9 presets, 12 polices).
 * Règle : le thème ne touche JAMAIS aux couleurs sémantiques (statuts de provenance, danger) — voir tokens.css.
 * resolveTheme() garantit WCAG 2.1 AA (CDC 13.6) quelle que soit la palette cliente.
 */

export const FONTS = [
  "Plus Jakarta Sans", "Nunito", "Lexend", "Manrope", "Sora", "Mooli",
  "Unbounded", "Quicksand", "Bricolage Grotesque", "Barlow", "Ubuntu", "Fredoka",
] as const;
export type FontName = (typeof FONTS)[number];

/** [c1 fond, c2 teinte/bordure, c3 accent doux, c4 primaire, c5 encre] */
export type Palette5 = readonly [string, string, string, string, string];

export interface ThemeConfig {
  palette: Palette5;
  font: FontName;
}

export const PALETTES = {
  sauge:   { label: "Sauge",   colors: ["#F2F5EF", "#D8E2D0", "#A9C4A5", "#5B7F68", "#2C3A33"] },
  menthe:  { label: "Menthe",  colors: ["#E9F7F2", "#BFE8D6", "#63C6A7", "#2F7E6A", "#1F2E2C"] },
  brume:   { label: "Brume",   colors: ["#FFFFFF", "#F4F7F8", "#D6E2E6", "#58B7B0", "#20343A"] },
  lagon:   { label: "Lagon",   colors: ["#E6FFF7", "#B9F2E3", "#7AD8C8", "#4AA1A3", "#2A4B5D"] },
  miel:    { label: "Miel",    colors: ["#FFF7E6", "#FFE3B3", "#FFC857", "#4BAA8B", "#1E3A34"] },
  lavande: { label: "Lavande", colors: ["#F6F2FF", "#E3D7FF", "#BCA6F6", "#5D64B8", "#1F2440"] },
  rose:    { label: "Rose",    colors: ["#FFF1F5", "#FFD2DF", "#F28AA8", "#B94D6D", "#3A1E2A"] },
  prairie: { label: "Prairie", colors: ["#F5FAF4", "#DCEFD7", "#8CCF8A", "#2F8A5A", "#1F2D24"] },
  argile:  { label: "Argile",  colors: ["#FFF4EC", "#F6D8C3", "#DDA57A", "#4D8F86", "#1D2F33"] },
} as const satisfies Record<string, { label: string; colors: Palette5 }>;

export const DEFAULT_THEME: ThemeConfig = { palette: PALETTES.miel.colors, font: "Bricolage Grotesque" };

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
export function resolveTheme({ palette, font }: ThemeConfig): Record<string, string> {
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
    "--font-body": fontStack(font),
  };
}

const FONT_VARIABLES: Record<FontName, string> = {
  "Plus Jakarta Sans": "--font-plus-jakarta-sans",
  Nunito: "--font-nunito",
  Lexend: "--font-lexend",
  Manrope: "--font-manrope",
  Sora: "--font-sora",
  Mooli: "--font-mooli",
  Unbounded: "--font-unbounded",
  Quicksand: "--font-quicksand",
  "Bricolage Grotesque": "--font-bricolage-grotesque",
  Barlow: "--font-barlow",
  Ubuntu: "--font-ubuntu",
  Fredoka: "--font-fredoka",
};

export const fontStack = (f: FontName) => `var(${FONT_VARIABLES[f]}, '${f}'), system-ui, -apple-system, 'Segoe UI', sans-serif`;

export function themeToStyle(cfg: ThemeConfig): string {
  return Object.entries(resolveTheme(cfg)).map(([k, v]) => `${k}:${v}`).join(";");
}
export function applyTheme(el: HTMLElement, cfg: ThemeConfig): void {
  for (const [k, v] of Object.entries(resolveTheme(cfg))) el.style.setProperty(k, v);
}

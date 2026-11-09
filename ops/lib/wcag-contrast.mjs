/** Calculs de contraste WCAG 2.x, sans dépendance : utilisés par l'audit d'accessibilité pour trancher les contrôles axe « à vérifier ». */

/** « rgb(30, 58, 52) » ou « rgba(30, 58, 52, 0.8) » → [r, g, b, a]. Renvoie null si la couleur n'est pas lisible. */
export function parseColor(css) {
  const match = /^rgba?\(\s*(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)(?:[,\s/]+(\d*\.?\d+%?))?\s*\)$/.exec(String(css).trim());
  if (!match) return null;
  const alpha = match[4] === undefined ? 1 : match[4].endsWith("%") ? parseFloat(match[4]) / 100 : parseFloat(match[4]);
  return [Number(match[1]), Number(match[2]), Number(match[3]), alpha];
}

export function relativeLuminance([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

export function contrastRatio(a, b) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Seuil WCAG 1.4.3 : 3:1 pour le grand texte (≥ 24 px, ou ≥ 18,66 px en gras), 4,5:1 sinon. */
export function requiredRatio(fontSizePx, fontWeight) {
  const bold = Number(fontWeight) >= 700;
  return fontSizePx >= 24 || (bold && fontSizePx >= 18.66) ? 3 : 4.5;
}

/** Plus petite et plus grande luminance d'un échantillon de pixels (tableau plat r, g, b, r, g, b…). */
export function luminanceRange(rgb) {
  let min = Infinity;
  let max = -Infinity;
  for (let index = 0; index + 2 < rgb.length; index += 3) {
    const luminance = relativeLuminance([rgb[index], rgb[index + 1], rgb[index + 2]]);
    if (luminance < min) min = luminance;
    if (luminance > max) max = luminance;
  }
  return Number.isFinite(min) ? { min, max } : null;
}

/** Pire contraste possible du texte sur un fond dont la luminance varie (dégradé, image) : face au pixel le plus proche de la luminance du texte. */
export function worstCaseRatio(textLuminance, backgroundMin, backgroundMax) {
  const nearest = Math.min(Math.max(textLuminance, backgroundMin), backgroundMax);
  return contrastRatio(textLuminance, nearest);
}

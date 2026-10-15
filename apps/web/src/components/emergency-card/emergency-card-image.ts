import { EMERGENCY_CARD_FOOTNOTE, emergencyCardFullName, type EmergencyCardView } from "./EmergencyCardVisual";

/*
 * Export PNG de la carte d’urgence : même contenu et même mise en page que <EmergencyCardVisual />, dessinés en canvas
 * (aucune dépendance supplémentaire, rien n’est envoyé à un serveur). L’image est large de 1600 px : nette sur un écran
 * de verrouillage comme à l’impression. Elle contient le QR : à partager avec précaution.
 */
const W = 1600;
const PAD = 72;
const BAND = 132;
const MIN_HEIGHT = 900;
const QR_BOX = 468;
const INK = "#17231f";
const MUTED = "#5a6b64";
const LINE = "#dfe7e3";
const DANGER = "#b42318";

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };
type Style = { heading: string; body: string; accent: string; onAccent: string };
let currentBody = "system-ui, sans-serif"; // police du corps de texte, fixée au début de chaque dessin

function probe<T>(apply: (el: HTMLElement) => void, read: (style: CSSStyleDeclaration) => T): T {
  const el = document.createElement("span");
  el.style.display = "none";
  apply(el);
  document.body.appendChild(el);
  const value = read(getComputedStyle(el));
  el.remove();
  return value;
}
const cssColor = (expression: string, fallback: string) => probe((el) => { el.style.color = fallback; el.style.color = expression; }, (style) => style.color || fallback);
const cssFont = (expression: string, fallback: string) => probe((el) => { el.style.fontFamily = expression; }, (style) => style.fontFamily || fallback);

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Coupe un texte en lignes qui tiennent dans `maxWidth` (y compris les mots plus longs que la ligne). */
function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) { line = candidate; continue; }
    if (line) lines.push(line);
    line = "";
    let chunk = "";
    for (const char of word) {
      if (ctx.measureText(chunk + char).width > maxWidth && chunk) { lines.push(chunk); chunk = char; } else chunk += char;
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function limitLines(ctx: Ctx, lines: string[], max: number, maxWidth: number): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[max - 1] = `${last}…`;
  return kept;
}

function label(ctx: Ctx, text: string, x: number, y: number): number {
  ctx.font = `800 24px ${currentBody}`;
  ctx.fillStyle = MUTED;
  ctx.letterSpacing = "3px";
  ctx.fillText(text.toUpperCase(), x, y + 24);
  ctx.letterSpacing = "0px";
  return 24 + 18;
}

function chips(ctx: Ctx, items: string[], x: number, y: number, maxWidth: number, tone: "allergy" | "treatment"): number {
  const colors = tone === "allergy"
    ? { bg: "#fff1ee", border: "#f1c2b8", text: "#8a1c10" }
    : { bg: "#eef3f0", border: "#d3dfd8", text: "#24352f" };
  const H = 60, GAP = 14, PADX = 26, MAX_ROWS = 4;
  ctx.font = `700 32px ${currentBody}`;
  let cx = x, row = 0, shown = 0;
  for (const item of items) {
    const width = Math.min(ctx.measureText(item).width + PADX * 2, maxWidth);
    if (cx > x && cx + width > x + maxWidth) { row += 1; cx = x; }
    if (row >= MAX_ROWS) break;
    const top = y + row * (H + GAP);
    roundRect(ctx, cx, top, width, H, H / 2);
    ctx.fillStyle = colors.bg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = colors.border; ctx.stroke();
    ctx.fillStyle = colors.text;
    const text = limitLines(ctx, [item], 1, width - PADX * 2)[0];
    ctx.fillText(text, cx + PADX, top + 40);
    cx += width + GAP; shown += 1;
  }
  if (shown < items.length) {
    const more = `+${items.length - shown}`;
    const top = y + Math.min(row, MAX_ROWS - 1) * (H + GAP);
    ctx.fillStyle = MUTED;
    ctx.fillText(more, cx > x ? cx : x, top + 40);
  }
  return (Math.min(row, MAX_ROWS - 1) + 1) * (H + GAP) - GAP;
}

function paint(ctx: Ctx, card: EmergencyCardView, qrCanvas: HTMLCanvasElement, style: Style): number {
  currentBody = style.body;
  const heading = style.heading;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, ctx.canvas.height);

  // bandeau
  ctx.fillStyle = style.accent;
  ctx.fillRect(0, 0, W, BAND);
  const mark = 64;
  roundRect(ctx, PAD, (BAND - mark) / 2, mark, mark, 20);
  ctx.fillStyle = style.onAccent; ctx.fill();
  ctx.fillStyle = style.accent;
  ctx.font = `800 54px ${style.body}`;
  ctx.textAlign = "center";
  ctx.fillText("+", PAD + mark / 2, BAND / 2 + 19);
  ctx.textAlign = "left";
  ctx.fillStyle = style.onAccent;
  ctx.font = `800 46px ${heading}`;
  ctx.fillText("E‑Carnet", PAD + mark + 22, BAND / 2 + 16);
  ctx.font = `800 26px ${style.body}`;
  ctx.letterSpacing = "5px";
  ctx.textAlign = "right";
  ctx.fillText("CARTE D’URGENCE", W - PAD, BAND / 2 + 9);
  ctx.textAlign = "left";
  ctx.letterSpacing = "0px";

  const top = BAND + PAD;

  // QR à droite (marge blanche de 4 modules déjà incluse dans le canvas du QR)
  const qrX = W - PAD - QR_BOX;
  roundRect(ctx, qrX, top, QR_BOX, QR_BOX, 24);
  ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = LINE; ctx.stroke();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(qrCanvas, qrX + 14, top + 14, QR_BOX - 28, QR_BOX - 28);
  ctx.fillStyle = MUTED;
  ctx.font = `700 28px ${style.body}`;
  ctx.textAlign = "center";
  ctx.fillText("Scannez pour afficher la carte", qrX + QR_BOX / 2, top + QR_BOX + 46);
  ctx.textAlign = "left";
  const qrBottom = top + QR_BOX + 66;

  // informations à gauche
  const x = PAD;
  const width = qrX - 56 - PAD;
  let y = top;

  const fullName = emergencyCardFullName(card);
  ctx.font = `800 88px ${heading}`;
  ctx.fillStyle = fullName ? INK : MUTED;
  const nameLines = limitLines(ctx, wrap(ctx, fullName || "Identité non renseignée", width), 2, width);
  nameLines.forEach((line, index) => ctx.fillText(line, x, y + 78 + index * 96));
  y += nameLines.length * 96 + 36;

  // groupe sanguin | ville
  const bloodW = 380;
  const rowTop = y;
  const labelH = label(ctx, "Groupe sanguin", x, rowTop);
  label(ctx, "Ville", x + bloodW, rowTop);
  ctx.font = `850 84px ${heading}`;
  ctx.fillStyle = card.blood_group ? DANGER : MUTED;
  if (!card.blood_group) ctx.font = `500 38px ${style.body}`;
  ctx.fillText(card.blood_group || "Non renseigné", x, rowTop + labelH + (card.blood_group ? 72 : 40));
  ctx.font = card.city ? `700 44px ${style.body}` : `500 38px ${style.body}`;
  ctx.fillStyle = card.city ? INK : MUTED;
  const cityLines = limitLines(ctx, wrap(ctx, card.city || "Non renseignée", width - bloodW), 2, width - bloodW);
  cityLines.forEach((line, index) => ctx.fillText(line, x + bloodW, rowTop + labelH + 40 + index * 52));
  y = rowTop + labelH + Math.max(card.blood_group ? 84 : 52, cityLines.length * 52) + 44;

  // allergies
  y += label(ctx, "Allergies", x, y);
  if (card.allergies.length) y += chips(ctx, card.allergies.map((item) => item.label), x, y, width, "allergy") + 40;
  else { ctx.font = `500 36px ${style.body}`; ctx.fillStyle = MUTED; ctx.fillText("Aucune allergie déclarée", x, y + 36); y += 36 + 44; }

  // traitements (seulement s’il y en a, comme à l’écran)
  if (card.treatments.length) {
    y += label(ctx, "Traitements", x, y);
    y += chips(ctx, card.treatments.map((item) => item.label), x, y, width, "treatment") + 40;
  }

  // contact d’urgence
  y += label(ctx, "Contact d’urgence", x, y);
  if (card.contact_name || card.contact_phone) {
    if (card.contact_name) {
      ctx.font = `800 46px ${style.body}`; ctx.fillStyle = INK;
      const lines = limitLines(ctx, wrap(ctx, card.contact_name, width), 2, width);
      lines.forEach((line, index) => ctx.fillText(line, x, y + 40 + index * 54));
      y += lines.length * 54 + 6;
    }
    if (card.contact_phone) {
      ctx.font = `600 42px ${style.body}`; ctx.fillStyle = MUTED;
      ctx.fillText(card.contact_phone, x, y + 38);
      y += 50;
    }
  } else { ctx.font = `500 36px ${style.body}`; ctx.fillStyle = MUTED; ctx.fillText("Non renseigné", x, y + 36); y += 44; }

  // pied de carte
  ctx.font = `500 25px ${style.body}`;
  const footLines = wrap(ctx, EMERGENCY_CARD_FOOTNOTE, W - PAD * 2);
  const footH = 34 + footLines.length * 34 + 22;
  const footTop = Math.max(Math.max(y, qrBottom) + 24, MIN_HEIGHT - footH);
  ctx.fillStyle = "#f5f8f6";
  ctx.fillRect(0, footTop, W, footH);
  ctx.fillStyle = LINE;
  ctx.fillRect(0, footTop, W, 2);
  ctx.fillStyle = MUTED;
  footLines.forEach((line, index) => ctx.fillText(line, PAD, footTop + 34 + 24 + index * 34 - 6));
  return footTop + footH;
}

export async function renderEmergencyCardPng(card: EmergencyCardView, qrCanvas: HTMLCanvasElement): Promise<Blob> {
  const heading = cssFont("var(--font-heading, var(--font-body))", "system-ui, sans-serif");
  const body = cssFont("var(--font-body)", "system-ui, sans-serif");
  try {
    await document.fonts?.ready;
    await Promise.all([document.fonts.load(`800 40px ${heading}`), document.fonts.load(`700 32px ${body}`), document.fonts.load(`500 32px ${body}`)]);
  } catch { /* polices système en repli : l’image reste lisible */ }
  const style: Style = {
    heading, body,
    accent: cssColor("var(--primary)", "#d99a1e"),
    onAccent: cssColor("var(--on-primary)", "#1b1500"),
  };
  // 1er passage : mesurer la hauteur nécessaire ; 2e passage : dessiner sur un canvas à la bonne taille.
  const measure = document.createElement("canvas");
  measure.width = W; measure.height = 3600;
  const measureCtx = measure.getContext("2d") as Ctx | null;
  if (!measureCtx) throw new Error("Le dessin de la carte n’est pas disponible sur cet appareil.");
  const height = Math.ceil(paint(measureCtx, card, qrCanvas, style));
  const out = document.createElement("canvas");
  out.width = W; out.height = height;
  const ctx = out.getContext("2d") as Ctx | null;
  if (!ctx) throw new Error("Le dessin de la carte n’est pas disponible sur cet appareil.");
  paint(ctx, card, qrCanvas, style);
  return new Promise((resolve, reject) => out.toBlob((blob) => blob ? resolve(blob) : reject(new Error("L’image n’a pas pu être créée.")), "image/png"));
}

export async function downloadEmergencyCardPng(card: EmergencyCardView, qrCanvas: HTMLCanvasElement, filename = "carte-urgence-e-carnet.png"): Promise<void> {
  const blob = await renderEmergencyCardPng(card, qrCanvas);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

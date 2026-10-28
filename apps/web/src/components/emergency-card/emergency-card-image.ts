import { EMERGENCY_CARD_FOOTNOTE, emergencyCardFullName, emergencyCardProfessionLabel, type EmergencyCardPhoto, type EmergencyCardView } from "./EmergencyCardVisual";
import { PROJECT_LOGO_WEBP } from "../../lib/brand";

/*
 * Export PNG de la carte d’urgence : même contenu et même mise en page que <EmergencyCardVisual />, dessinés en canvas
 * (aucune dépendance supplémentaire, rien n’est envoyé à un serveur). L’image est large de 1600 px et haute de 1020 px (plus si la carte est très remplie) : nette sur un écran
 * de verrouillage comme à l’impression. À la place du QR, la carte porte la photo de profil (ou l’avatar) du titulaire : l’image
 * ne donne accès à rien d’autre que ce qu’elle montre. Elle affiche pourtant identité, allergies et contact : à partager avec précaution.
 */
const W = 1600;
const PAD = 64;
const BAND = 120;
const CARD_HEIGHT = 1020; // hauteur habituelle ; l’image s’allonge seulement si le contenu est plus haut
const TILE = "#f5f8f6";
const PHOTO_W = 340;
const PHOTO_H = 425;
const INK = "#17231f";
const MUTED = "#5a6b64";
const LINE = "#dfe7e3";
const DANGER = "#b42318";

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };
type Style = { heading: string; body: string; accent: string; onAccent: string };
type LoadedPhoto = { image: HTMLImageElement | null; initials: string };
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
  ctx.font = `800 18px ${currentBody}`;
  ctx.fillStyle = MUTED;
  ctx.letterSpacing = "2px";
  ctx.fillText(text.toUpperCase(), x, y + 19);
  ctx.letterSpacing = "0px";
  return 28;
}

function chips(ctx: Ctx, items: string[], x: number, y: number, maxWidth: number, tone: "allergy" | "treatment"): number {
  const colors = tone === "allergy"
    ? { bg: "#fff1ee", border: "#f1c2b8", text: "#8a1c10" }
    : { bg: "#eef3f0", border: "#d3dfd8", text: "#24352f" };
  const H = 42, GAP = 10, PADX = 18, MAX_ROWS = 2;
  ctx.font = `700 24px ${currentBody}`;
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
    ctx.fillText(text, cx + PADX, top + 28);
    cx += width + GAP; shown += 1;
  }
  if (shown < items.length) {
    const more = `+${items.length - shown}`;
    const top = y + Math.min(row, MAX_ROWS - 1) * (H + GAP);
    ctx.fillStyle = MUTED;
    ctx.fillText(more, cx > x ? cx : x, top + 28);
  }
  return (Math.min(row, MAX_ROWS - 1) + 1) * (H + GAP) - GAP;
}

/** Charge la photo sans jamais faire échouer l’export : sans réponse, ou si le serveur d’images n’autorise pas la lecture (CORS), on dessine les initiales. */
function loadPhoto(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    const finish = (value: HTMLImageElement | null) => { window.clearTimeout(timer); image.onload = null; image.onerror = null; resolve(value); };
    const timer = window.setTimeout(() => finish(null), 6000);
    // Une image d’un autre domaine ne se dessine « lisiblement » que si elle est demandée avec CORS ; sinon le canvas serait marqué
    // comme souillé et toBlob échouerait. Les data: et blob: n’en ont pas besoin.
    if (!/^(data|blob):/i.test(url)) image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.onload = () => finish(image.naturalWidth > 0 ? image : null);
    image.onerror = () => finish(null);
    image.src = url;
  });
}

/** Cadre photo d’identité : image recadrée au centre (object-fit: cover) ou monogramme sur fond d’accent. */
function drawPhoto(ctx: Ctx, photo: LoadedPhoto, x: number, y: number, style: Style) {
  roundRect(ctx, x, y, PHOTO_W, PHOTO_H, 28);
  ctx.save();
  ctx.clip();
  if (photo.image) {
    const scale = Math.max(PHOTO_W / photo.image.naturalWidth, PHOTO_H / photo.image.naturalHeight);
    const w = photo.image.naturalWidth * scale, h = photo.image.naturalHeight * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(photo.image, x + (PHOTO_W - w) / 2, y + (PHOTO_H - h) / 2, w, h);
  } else {
    ctx.fillStyle = style.accent;
    ctx.fillRect(x, y, PHOTO_W, PHOTO_H);
    ctx.fillStyle = style.onAccent;
    ctx.font = `800 170px ${style.heading}`;
    ctx.textAlign = "center";
    ctx.fillText(photo.initials, x + PHOTO_W / 2, y + PHOTO_H / 2 + 60);
    ctx.textAlign = "left";
  }
  ctx.restore();
  roundRect(ctx, x, y, PHOTO_W, PHOTO_H, 28);
  ctx.lineWidth = 6; ctx.strokeStyle = "#ffffff"; ctx.stroke();
  roundRect(ctx, x - 2, y - 2, PHOTO_W + 4, PHOTO_H + 4, 30);
  ctx.lineWidth = 3; ctx.strokeStyle = LINE; ctx.stroke();
}

function drawBrandMark(ctx: Ctx, image: HTMLImageElement | null, x: number, y: number, size: number, style: Style) {
  roundRect(ctx, x, y, size, size, 20);
  ctx.fillStyle = style.onAccent;
  ctx.fill();
  if (image) {
    ctx.save();
    roundRect(ctx, x, y, size, size, 20);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, x, y, size, size);
    ctx.restore();
  } else {
    ctx.fillStyle = style.accent;
    ctx.font = `800 ${Math.round(size * .78)}px ${style.body}`;
    ctx.textAlign = "center";
    ctx.fillText("+", x + size / 2, y + size * .73);
    ctx.textAlign = "left";
  }
}

function tile(ctx: Ctx, x: number, y: number, w: number, h: number, bg: string, border: string) {
  roundRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = bg; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = border; ctx.stroke();
}

/** Dessine la carte et renvoie la hauteur réellement nécessaire (au moins CARD_HEIGHT). */
function paint(ctx: Ctx, card: EmergencyCardView, photo: LoadedPhoto, brandLogo: LoadedPhoto, style: Style): number {
  currentBody = style.body;
  const heading = style.heading;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, ctx.canvas.height);

  // bandeau : couleur du thème + halo clair à droite (sans l’assombrir : le texte garde son contraste)
  ctx.fillStyle = style.accent;
  ctx.fillRect(0, 0, W, BAND);
  const halo = ctx.createRadialGradient(W - 140, 0, 0, W - 140, 0, 420);
  halo.addColorStop(0, "rgba(255,255,255,.28)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, BAND);
  const mark = 68;
  drawBrandMark(ctx, brandLogo.image, PAD, (BAND - mark) / 2, mark, style);
  ctx.fillStyle = style.onAccent;
  ctx.font = `800 48px ${heading}`;
  ctx.fillText("Mon E‑Carnet", PAD + mark + 24, BAND / 2 + 17);
  ctx.font = `800 24px ${style.body}`;
  ctx.letterSpacing = "5px";
  ctx.textAlign = "right";
  ctx.fillText("CARTE D’URGENCE", W - PAD, BAND / 2 + 9);
  ctx.textAlign = "left";
  ctx.letterSpacing = "0px";

  const top = BAND + 52;

  // photo de profil à droite, à la place du QR, sur un fond légèrement teinté
  const photoX = W - PAD - PHOTO_W;
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = style.accent;
  roundRect(ctx, photoX - 26, top - 24, PHOTO_W + 52, PHOTO_H + 100, 36);
  ctx.fill();
  ctx.restore();
  drawPhoto(ctx, photo, photoX, top, style);
  ctx.fillStyle = MUTED;
  ctx.font = `700 22px ${style.body}`;
  ctx.textAlign = "center";
  ctx.fillText("Titulaire de la carte", photoX + PHOTO_W / 2, top + PHOTO_H + 38);
  ctx.textAlign = "left";
  const photoBottom = top + PHOTO_H + 76;

  // informations à gauche
  const x = PAD;
  const width = photoX - 56 - PAD;
  let y = top;

  const fullName = emergencyCardFullName(card);
  ctx.font = `800 62px ${heading}`;
  ctx.fillStyle = fullName ? INK : MUTED;
  const nameLines = limitLines(ctx, wrap(ctx, fullName || "Identité non renseignée", width), 2, width);
  nameLines.forEach((line, index) => ctx.fillText(line, x, y + 54 + index * 68));
  y += nameLines.length * 68 + 10;

  // métier du professionnel : pastille sous le nom
  const role = emergencyCardProfessionLabel(card.profession);
  if (role) {
    ctx.font = `800 28px ${style.body}`;
    const [text] = limitLines(ctx, [role], 1, width - 92);
    const pillW = Math.min(ctx.measureText(text).width + 92, width);
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = style.accent;
    roundRect(ctx, x, y, pillW, 54, 27);
    ctx.fill();
    ctx.restore();
    // petite croix médicale
    ctx.fillStyle = INK;
    roundRect(ctx, x + 24, y + 22, 22, 7, 3); ctx.fill();
    roundRect(ctx, x + 31.5, y + 14.5, 7, 22, 3); ctx.fill();
    ctx.fillText(text, x + 62, y + 37);
    y += 54 + 18;
  } else y += 6;

  // groupe sanguin | ville, puis taille | poids : quatre tuiles
  const gap = 16, tileW = Math.floor((width - gap) / 2), tileH = 110;
  const row1 = y, row2 = y + tileH + gap;
  tile(ctx, x, row1, tileW, tileH, "#fff1ee", "#f1c2b8");
  tile(ctx, x + tileW + gap, row1, tileW, tileH, TILE, LINE);
  tile(ctx, x, row2, tileW, tileH, TILE, LINE);
  tile(ctx, x + tileW + gap, row2, tileW, tileH, TILE, LINE);
  label(ctx, "Groupe sanguin", x + 24, row1 + 12);
  label(ctx, "Ville", x + tileW + gap + 24, row1 + 12);
  label(ctx, "Taille déclarée", x + 24, row2 + 12);
  label(ctx, "Poids déclaré", x + tileW + gap + 24, row2 + 12);
  ctx.font = card.blood_group ? `850 58px ${heading}` : `500 26px ${style.body}`;
  ctx.fillStyle = card.blood_group ? DANGER : MUTED;
  ctx.fillText(card.blood_group || "Non renseigné", x + 24, row1 + (card.blood_group ? 94 : 82));
  ctx.font = card.city ? `700 32px ${style.body}` : `500 26px ${style.body}`;
  ctx.fillStyle = card.city ? INK : MUTED;
  limitLines(ctx, wrap(ctx, card.city || "Non renseignée", tileW - 48), 1, tileW - 48).forEach((line) => ctx.fillText(line, x + tileW + gap + 24, row1 + 82));
  ctx.font = card.height_cm ? `700 32px ${style.body}` : `500 26px ${style.body}`;
  ctx.fillStyle = card.height_cm ? INK : MUTED;
  ctx.fillText(card.height_cm || "Non renseignée", x + 24, row2 + 82);
  ctx.font = card.weight_kg ? `700 32px ${style.body}` : `500 26px ${style.body}`;
  ctx.fillStyle = card.weight_kg ? INK : MUTED;
  ctx.fillText(card.weight_kg || "Non renseigné", x + tileW + gap + 24, row2 + 82);
  y = row2 + tileH + 26;

  // allergies
  y += label(ctx, "Allergies", x, y);
  if (card.allergies.length) y += chips(ctx, card.allergies.map((item) => item.label), x, y, width, "allergy") + 20;
  else { ctx.font = `500 26px ${style.body}`; ctx.fillStyle = MUTED; ctx.fillText("Aucune allergie déclarée", x, y + 28); y += 28 + 20; }

  // traitements (seulement s’il y en a, comme à l’écran)
  if (card.treatments.length) {
    y += label(ctx, "Traitements", x, y);
    y += chips(ctx, card.treatments.map((item) => item.label), x, y, width, "treatment") + 20;
  }

  // contact d’urgence : tuile pleine largeur
  const hasContact = Boolean(card.contact_name || card.contact_phone);
  const contactH = 22 + 28 + (hasContact ? (card.contact_name ? 38 : 0) + (card.contact_phone ? 36 : 0) : 32) + 14;
  tile(ctx, x, y, width, contactH, TILE, LINE);
  let cy = y + 12;
  cy += label(ctx, "Contact d’urgence", x + 24, cy);
  if (hasContact) {
    if (card.contact_name) {
      ctx.font = `800 34px ${style.body}`; ctx.fillStyle = INK;
      limitLines(ctx, wrap(ctx, card.contact_name, width - 48), 1, width - 48).forEach((line) => ctx.fillText(line, x + 24, cy + 32));
      cy += 38;
    }
    if (card.contact_phone) {
      ctx.font = `600 30px ${style.body}`; ctx.fillStyle = MUTED;
      ctx.fillText(card.contact_phone, x + 24, cy + 30);
      cy += 36;
    }
  } else { ctx.font = `500 26px ${style.body}`; ctx.fillStyle = MUTED; ctx.fillText("Non renseigné", x + 24, cy + 28); }
  y += contactH;

  // pied de carte
  ctx.font = `500 20px ${style.body}`;
  const footLines = wrap(ctx, EMERGENCY_CARD_FOOTNOTE, W - PAD * 2);
  const footH = 18 + footLines.length * 26 + 14;
  const footTop = Math.max(Math.max(y, photoBottom) + 20, CARD_HEIGHT - footH);
  ctx.fillStyle = TILE;
  ctx.fillRect(0, footTop, W, footH);
  ctx.fillStyle = LINE;
  ctx.fillRect(0, footTop, W, 2);
  ctx.fillStyle = MUTED;
  footLines.forEach((line, index) => ctx.fillText(line, PAD, footTop + 18 + 20 + index * 26 - 4));
  return footTop + footH;
}

export async function renderEmergencyCardPng(card: EmergencyCardView, photoSource: EmergencyCardPhoto): Promise<Blob> {
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
  const [photoImage, logoImage] = await Promise.all([loadPhoto(photoSource.url), loadPhoto(PROJECT_LOGO_WEBP)]);
  const photo: LoadedPhoto = { image: photoImage, initials: photoSource.initials };
  const brandLogo: LoadedPhoto = { image: logoImage, initials: "" };
  // Premier passage sur une toile haute pour connaître la hauteur nécessaire : rien n’est coupé, même avec beaucoup d’allergies ou de traitements.
  const scratch = document.createElement("canvas");
  scratch.width = W; scratch.height = 2400;
  const scratchCtx = scratch.getContext("2d") as Ctx | null;
  if (!scratchCtx) throw new Error("Le dessin de la carte n’est pas disponible sur cet appareil.");
  const needed = Math.max(CARD_HEIGHT, Math.ceil(paint(scratchCtx, card, photo, brandLogo, style)));
  const out = document.createElement("canvas");
  out.width = W; out.height = needed;
  const ctx = out.getContext("2d") as Ctx | null;
  if (!ctx) throw new Error("Le dessin de la carte n’est pas disponible sur cet appareil.");
  paint(ctx, card, photo, brandLogo, style);
  return new Promise((resolve, reject) => out.toBlob((blob) => blob ? resolve(blob) : reject(new Error("L’image n’a pas pu être créée.")), "image/png"));
}

export async function downloadEmergencyCardPng(card: EmergencyCardView, photo: EmergencyCardPhoto, filename = "carte-urgence-mon-e-carnet.png"): Promise<void> {
  const blob = await renderEmergencyCardPng(card, photo);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

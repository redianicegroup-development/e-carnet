/* Détourage d'un cachet ou d'une signature photographiés sur du papier.

   Objectif : un PNG transparent « net » (trait plein, bord franc, aucun grain de poussière, aucune ombre de papier),
   sans service externe ni bibliothèque : tout se passe dans le navigateur, la photo ne quitte pas l'appareil avant
   que le professionnel ait validé le résultat.

   Principe, volontairement classique et prévisible :
   1. on estime le « papier » en chaque point (éclairage inégal, ombre de la main) par un percentile élevé par bloc ;
   2. l'encre est ce qui est plus sombre que le papier local, mesuré en proportion (« 40 % plus sombre ») ;
   3. le seuil vient de l'encre elle-même (la moitié de son contraste), pas d'une valeur fixe : une encre pâle et
      une encre noire donnent le même trait ;
   4. on supprime les poussières isolées, puis on repeint l'encre en une seule couleur : le trait est uniforme.

   Ce fichier est pur (aucune API du navigateur) pour pouvoir être testé sous Node. */

export type Pixels = { data: Uint8ClampedArray; width: number; height: number };
export type InkColor = "original" | "black" | "blue";
export type InkOptions = {
  /** 1 = réglage automatique ; > 1 garde davantage de traits fins, < 1 supprime davantage de bruit. */
  sensitivity?: number;
  color?: InkColor;
};
export type InkResult =
  | { status: "ok"; pixels: Pixels; color: [number, number, number] }
  | { status: "empty" }
  | { status: "dark" };

export const INK_BLACK: [number, number, number] = [20, 20, 24];
export const INK_BLUE: [number, number, number] = [18, 44, 118];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const smoothstep = (value: number) => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };

/** Valeur sous laquelle se trouve `ratio` des valeurs de l'histogramme (256 classes). */
function percentileFromHistogram(histogram: Uint32Array, offset: number, total: number, ratio: number) {
  const target = total * ratio;
  let seen = 0;
  for (let value = 0; value < 256; value += 1) {
    seen += histogram[offset + value];
    if (seen >= target) return value;
  }
  return 255;
}

/** Couleur du papier en chaque pixel : percentile 70 par bloc (blocs d’environ 48 px), lissé, puis interpolé. Trois canaux. */
function estimatePaper(src: Pixels) {
  const { data, width, height } = src;
  const gridX = clamp(Math.round(width / 48), 6, 32);
  const gridY = clamp(Math.round(height / 48), 6, 32);
  const cellW = width / gridX;
  const cellH = height / gridY;
  const cells = new Float32Array(gridX * gridY * 3);
  for (let cy = 0; cy < gridY; cy += 1) {
    for (let cx = 0; cx < gridX; cx += 1) {
      const histogram = new Uint32Array(256 * 3);
      const x0 = Math.floor(cx * cellW);
      const x1 = Math.max(x0 + 1, Math.floor((cx + 1) * cellW));
      const y0 = Math.floor(cy * cellH);
      const y1 = Math.max(y0 + 1, Math.floor((cy + 1) * cellH));
      let count = 0;
      for (let y = y0; y < y1 && y < height; y += 1) {
        for (let x = x0; x < x1 && x < width; x += 1) {
          const index = (y * width + x) * 4;
          histogram[data[index]] += 1;
          histogram[256 + data[index + 1]] += 1;
          histogram[512 + data[index + 2]] += 1;
          count += 1;
        }
      }
      for (let channel = 0; channel < 3; channel += 1) cells[(cy * gridX + cx) * 3 + channel] = percentileFromHistogram(histogram, channel * 256, count, 0.7);
    }
  }
  // Niveau « papier » global (75e percentile des blocs) : un bloc entièrement couvert d'encre ne doit pas être pris pour du papier sombre.
  const floors: number[] = [];
  for (let channel = 0; channel < 3; channel += 1) {
    const values: number[] = [];
    for (let cell = 0; cell < gridX * gridY; cell += 1) values.push(cells[cell * 3 + channel]);
    values.sort((a, b) => a - b);
    floors.push(values[Math.floor(values.length * 0.75)] * 0.6);
  }
  const smooth = new Float32Array(cells.length);
  for (let cy = 0; cy < gridY; cy += 1) {
    for (let cx = 0; cx < gridX; cx += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = clamp(cx + dx, 0, gridX - 1);
            const ny = clamp(cy + dy, 0, gridY - 1);
            sum += cells[(ny * gridX + nx) * 3 + channel];
            n += 1;
          }
        }
        const own = cells[(cy * gridX + cx) * 3 + channel];
        smooth[(cy * gridX + cx) * 3 + channel] = Math.max(floors[channel], (own + sum / n) / 2, 1);
      }
    }
  }
  const paper = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    const fy = clamp((y + 0.5) / cellH - 0.5, 0, gridY - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(gridY - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < width; x += 1) {
      const fx = clamp((x + 0.5) / cellW - 0.5, 0, gridX - 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(gridX - 1, x0 + 1);
      const tx = fx - x0;
      for (let channel = 0; channel < 3; channel += 1) {
        const top = smooth[(y0 * gridX + x0) * 3 + channel] * (1 - tx) + smooth[(y0 * gridX + x1) * 3 + channel] * tx;
        const bottom = smooth[(y1 * gridX + x0) * 3 + channel] * (1 - tx) + smooth[(y1 * gridX + x1) * 3 + channel] * tx;
        paper[(y * width + x) * 3 + channel] = top * (1 - ty) + bottom * ty;
      }
    }
  }
  return { paper, floors };
}

/** Rectangle englobant les pixels dont l'opacité dépasse `minAlpha`. */
function inkBounds(src: Pixels, minAlpha: number) {
  const { data, width, height } = src;
  let minX = width; let minY = height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] >= minAlpha) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

/** Recadre sur le trait, avec une marge, sur un fond transparent d'au moins 32 × 32 px (minimum exigé par l'API). */
export function cropToInk(src: Pixels, paddingRatio = 0.05): Pixels | null {
  const bounds = inkBounds(src, 20);
  if (!bounds) return null;
  const boxW = bounds.maxX - bounds.minX + 1;
  const boxH = bounds.maxY - bounds.minY + 1;
  const padding = Math.max(4, Math.round(Math.max(boxW, boxH) * paddingRatio));
  const width = Math.max(32, boxW + padding * 2);
  const height = Math.max(32, boxH + padding * 2);
  const out = new Uint8ClampedArray(width * height * 4);
  const offsetX = Math.floor((width - boxW) / 2);
  const offsetY = Math.floor((height - boxH) / 2);
  for (let y = 0; y < boxH; y += 1) {
    const from = ((bounds.minY + y) * src.width + bounds.minX) * 4;
    out.set(src.data.subarray(from, from + boxW * 4), ((offsetY + y) * width + offsetX) * 4);
  }
  return { data: out, width, height };
}

/** Vrai si l'image a déjà un fond transparent (PNG déjà détouré) : on ne la retraite pas. */
export function hasTransparency(src: Pixels) {
  const { data } = src;
  let transparent = 0;
  const total = data.length / 4;
  for (let index = 3; index < data.length; index += 4) if (data[index] < 200) transparent += 1;
  return transparent / total > 0.05;
}

/** Réduit les dimensions pour tenir dans `maxSide`, sans jamais agrandir. */
export function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function extractInk(src: Pixels, options: InkOptions = {}): InkResult {
  const { width, height, data } = src;
  const total = width * height;
  const sensitivity = clamp(options.sensitivity ?? 1, 0.5, 2);
  const colorMode: InkColor = options.color ?? "original";
  const { paper, floors } = estimatePaper(src);

  // Un fond de table sombre ne se détoure pas : on le dit au lieu de produire un résultat faux.
  const paperLuma = 0.299 * (floors[0] / 0.6) + 0.587 * (floors[1] / 0.6) + 0.114 * (floors[2] / 0.6);
  if (paperLuma < 95) return { status: "dark" };

  // 2. Contraste d'encre : de combien le pixel est plus sombre que le papier local (0 à 1), canal le plus touché.
  const contrast = new Float32Array(total);
  const histogram = new Uint32Array(256);
  let candidates = 0;
  for (let pixel = 0; pixel < total; pixel += 1) {
    const base = pixel * 4;
    const rr = 1 - data[base] / paper[pixel * 3];
    const gg = 1 - data[base + 1] / paper[pixel * 3 + 1];
    const bb = 1 - data[base + 2] / paper[pixel * 3 + 2];
    const value = Math.max(0, rr, gg, bb);
    contrast[pixel] = value;
    if (value >= 0.08) { histogram[Math.min(255, Math.round(value * 255))] += 1; candidates += 1; }
  }
  if (candidates < total * 0.0005) return { status: "empty" };

  // 3. Seuil proportionnel au contraste de l'encre (92e percentile des pixels non vides). Un tiers seulement : les parties
  //    fines d'une signature, floutées par l'objectif, n'atteignent jamais la moitié du contraste d'un trait épais et
  //    seraient coupées. Le plancher (0,20) reste au-dessus du grain et des dégradés d’éclairage mal suivis (jusqu’à 0,12 mesurés sur une ombre de main).
  const strong = percentileFromHistogram(histogram, 0, candidates, 0.92) / 255;
  if (strong < 0.2) return { status: "empty" };
  const threshold = clamp((0.32 * strong) / sensitivity, 0.2, 0.5);
  const low = threshold * 0.6;
  const high = threshold * 1.4;
  const alpha = new Uint8ClampedArray(total);
  for (let pixel = 0; pixel < total; pixel += 1) alpha[pixel] = Math.round(255 * smoothstep((contrast[pixel] - low) / (high - low)));

  // 4a. Poussières, en deux temps. (1) Un îlot minuscule est toujours retiré. (2) Un îlot petit n'est gardé que s'il est
  //     proche du trait principal : le point d'un « i » ou d'un « N° » touche le dessin, un grain de poussière non.
  //     Les traits fins connectés au dessin ne sont jamais concernés (ils font partie du même îlot).
  const tinyArea = Math.max(12, Math.round(total * 0.00006));
  const mainArea = Math.max(tinyArea * 4, Math.round(total * 0.0004));
  const labels = new Int32Array(total);
  const queue = new Int32Array(total);
  const comps: { area: number; minX: number; minY: number; maxX: number; maxY: number }[] = [];
  for (let start = 0; start < total; start += 1) {
    if (alpha[start] < 128 || labels[start]) continue;
    const id = comps.length + 1;
    let head = 0; let tail = 0;
    queue[tail++] = start;
    labels[start] = id;
    const comp = { area: 0, minX: width, minY: height, maxX: 0, maxY: 0 };
    while (head < tail) {
      const current = queue[head++];
      const cx = current % width;
      const cy = (current - cx) / width;
      if (cx < comp.minX) comp.minX = cx;
      if (cx > comp.maxX) comp.maxX = cx;
      if (cy < comp.minY) comp.minY = cy;
      if (cy > comp.maxY) comp.maxY = cy;
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = cy + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = cx + dx;
          if (nx < 0 || nx >= width) continue;
          const neighbour = ny * width + nx;
          if (!labels[neighbour] && alpha[neighbour] >= 128) { labels[neighbour] = id; queue[tail++] = neighbour; }
        }
      }
    }
    comp.area = tail;
    comps.push(comp);
  }
  // Zone du dessin = union des gros îlots, élargie de 6 % de ses dimensions.
  let zone: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  for (const comp of comps) {
    if (comp.area < mainArea) continue;
    zone = zone
      ? { minX: Math.min(zone.minX, comp.minX), minY: Math.min(zone.minY, comp.minY), maxX: Math.max(zone.maxX, comp.maxX), maxY: Math.max(zone.maxY, comp.maxY) }
      : { minX: comp.minX, minY: comp.minY, maxX: comp.maxX, maxY: comp.maxY };
  }
  const margin = zone ? Math.round(Math.max(zone.maxX - zone.minX, zone.maxY - zone.minY) * 0.06) : 0;
  const removed = comps.map((comp) => {
    if (comp.area < tinyArea) return true;
    if (comp.area >= mainArea) return false;
    if (!zone) return true; // aucun dessin : tout ce qui reste est de la poussière
    const cx = (comp.minX + comp.maxX) / 2;
    const cy = (comp.minY + comp.maxY) / 2;
    return cx < zone.minX - margin || cx > zone.maxX + margin || cy < zone.minY - margin || cy > zone.maxY + margin;
  });
  for (let pixel = 0; pixel < total; pixel += 1) {
    const label = labels[pixel];
    if (!label || !removed[label - 1]) continue;
    const px = pixel % width;
    const py = (pixel - px) / width;
    alpha[pixel] = 0;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const nx = px + dx; const ny = py + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && alpha[ny * width + nx] < 128) alpha[ny * width + nx] = 0;
    }
  }
  // 4b. Voile : un pixel à demi transparent qui ne touche aucun trait franc est du bruit de papier.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (alpha[pixel] === 0 || alpha[pixel] >= 128) continue;
      let touches = false;
      for (let dy = -1; dy <= 1 && !touches; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx; const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && alpha[ny * width + nx] >= 128) { touches = true; break; }
      }
      if (!touches) alpha[pixel] = 0;
    }
  }

  // Après nettoyage il ne reste rien de significatif : une feuille vierge poussiéreuse n'est pas un cachet.
  let solid = 0;
  for (let pixel = 0; pixel < total; pixel += 1) if (alpha[pixel] >= 128) solid += 1;
  if (solid < total * 0.0008) return { status: "empty" };

  // 4c. Couleur unique du trait.
  let color: [number, number, number] = INK_BLACK;
  if (colorMode === "blue") color = INK_BLUE;
  else if (colorMode === "original") {
    // Teinte mesurée sur le cœur du trait (pas sur les bords, éclaircis par le papier).
    let r = 0; let g = 0; let b = 0; let count = 0;
    for (let pixel = 0; pixel < total; pixel += 1) {
      if (alpha[pixel] < 250 || contrast[pixel] < strong * 0.85) continue;
      r += data[pixel * 4]; g += data[pixel * 4 + 1]; b += data[pixel * 4 + 2]; count += 1;
    }
    if (count > 0) {
      r /= count; g /= count; b /= count;
      if (Math.max(r, g, b) - Math.min(r, g, b) < 22) color = INK_BLACK; // encre grise = encre noire
      else {
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const scale = luma > 105 ? 105 / luma : 1; // une encre claire s'imprime mal : on la fonce sans changer sa teinte
        color = [Math.round(r * scale), Math.round(g * scale), Math.round(b * scale)];
      }
    }
  }
  const out = new Uint8ClampedArray(total * 4);
  for (let pixel = 0; pixel < total; pixel += 1) {
    out[pixel * 4] = color[0]; out[pixel * 4 + 1] = color[1]; out[pixel * 4 + 2] = color[2]; out[pixel * 4 + 3] = alpha[pixel];
  }
  const cropped = cropToInk({ data: out, width, height });
  return cropped ? { status: "ok", pixels: cropped, color } : { status: "empty" };
}

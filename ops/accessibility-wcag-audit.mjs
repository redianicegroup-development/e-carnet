/* Audit d'accessibilité WCAG 2.2 AA (axe-core + contrôles propres au projet). UX-03.
 *
 * Usage : node ops/accessibility-wcag-audit.mjs
 *   BASE_URL   site à auditer (défaut http://127.0.0.1:3000)
 *   SPACES     espaces à couvrir, séparés par des virgules : public (défaut), patient, professionnel, etablissement
 *   A11Y_PATIENT, A11Y_PROFESSIONNEL, A11Y_ETABLISSEMENT   « courriel:mot de passe » d'un compte de recette de chaque espace
 *   A11Y_PALETTES   miel (défaut), all, ou une liste (sauge,miel,lavande,rose,argile) : applique les couleurs dérivées du thème
 *   ROUTES     remplace la liste des routes publiques ; REPORT  chemin du rapport JSON
 *
 * Ce que le script fait en plus d'axe :
 *   - tranche à la main les contrôles « à vérifier » de contraste : il masque le texte, photographie le fond réel et calcule le
 *     pire contraste possible (dégradés, images, éléments superposés) ;
 *   - parcourt la page au clavier et signale tout élément qui prend le focus sous la barre du bas ou l'en-tête collant (WCAG 2.4.11) ;
 *   - liste les cibles de moins de 24 × 24 px hors liens dans une phrase (WCAG 2.5.8).
 * Le code de sortie est 1 s'il reste une violation, un contrôle non tranché, un focus masqué ou un contraste insuffisant
 * (et une cible trop petite avec A11Y_TARGETS=strict). */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { luminanceRange, parseColor, relativeLuminance, requiredRatio, worstCaseRatio } from "./lib/wcag-contrast.mjs";

const require = createRequire(import.meta.url);
const base = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const publicRoutes = (process.env.ROUTES || "/,/a-propos,/aide,/faq,/connexion,/inscription,/mentions-legales,/confidentialite,/cgu,/urgence/demo").split(",");
const spaces = (process.env.SPACES || "public").split(",").map((item) => item.trim()).filter(Boolean);
const SPACE_ROUTES = {
  patient: ["/patient", "/patient/carnet", "/patient/consultations", "/patient/historique", "/patient/parametres", "/patient/proches"],
  professionnel: ["/professionnel", "/professionnel/patients", "/professionnel/consultations", "/professionnel/agenda", "/professionnel/parametres"],
  etablissement: ["/etablissement", "/etablissement/dossiers", "/etablissement/medecins", "/etablissement/demandes", "/etablissement/modeles", "/etablissement/parametres"],
};
const executablePath = process.env.CHROMIUM_PATH || (() => { try { return execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(); } catch { return undefined; } })();
const axeSource = await fs.readFile(require.resolve("axe-core/axe.min.js"), "utf8");

/* ----- palettes : mêmes variables que l'application (packages/ui/src/themes.ts), posées sur <html> ----- */
const paletteIds = (process.env.A11Y_PALETTES || "miel").split(",").map((item) => item.trim());
let paletteVariables = [{ id: "défaut", variables: null }];
if (spaces.some((space) => space !== "public") || process.env.A11Y_PALETTES) {
  const themes = await import("../packages/ui/src/themes.ts");
  const ids = paletteIds.includes("all") ? Object.keys(themes.PALETTES) : paletteIds;
  paletteVariables = ids.map((id) => {
    const palette = themes.PALETTES[id];
    if (!palette) throw new Error(`Palette inconnue : ${id}`);
    const variables = themes.resolveTheme({ palette: palette.colors, font_pair: "sora-bricolage", text_scale: "normal" });
    return { id, variables: Object.fromEntries(Object.entries(variables).filter(([name]) => !name.startsWith("--font") && name !== "--text-scale")) };
  });
}

async function login(context, space) {
  const credentials = process.env[`A11Y_${space.toUpperCase()}`];
  if (!credentials) throw new Error(`Compte de recette manquant pour l'espace « ${space} » : définir A11Y_${space.toUpperCase()}="courriel:mot de passe".`);
  const separator = credentials.indexOf(":");
  const email = credentials.slice(0, separator);
  const password = credentials.slice(separator + 1);
  await context.request.get(`${base}/api/v1/csrf/`);
  const csrf = (await context.cookies(base)).find((cookie) => cookie.name === "csrftoken")?.value;
  const response = await context.request.post(`${base}/api/v1/identity/login/`, { data: { email, password }, headers: { "X-CSRFToken": csrf ?? "", Origin: base, Referer: `${base}/connexion` } });
  if (!response.ok()) throw new Error(`Connexion refusée pour l'espace « ${space} » (${response.status()}).`);
}

/* ----- contraste : trancher les contrôles « à vérifier » en mesurant le fond réellement affiché ----- */
async function resolveContrast(page, incomplete) {
  const resolved = [];
  for (const item of incomplete.filter((entry) => entry.id === "color-contrast")) {
    for (const node of item.nodes) {
      const selector = node.target[node.target.length - 1];
      const locator = page.locator(selector).first();
      const info = await locator.evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return { color: style.color, size: parseFloat(style.fontSize), weight: style.fontWeight, width: box.width, height: box.height };
      }).catch(() => null);
      const text = info && parseColor(info.color);
      if (!info || !text || info.width < 2 || info.height < 2) { resolved.push({ selector, status: "non mesurable" }); continue; }
      await locator.evaluate((element) => element.setAttribute("data-a11y-probe", ""));
      await page.addStyleTag({ content: "[data-a11y-probe], [data-a11y-probe] * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }" });
      const png = await locator.screenshot({ type: "png" }).catch(() => null);
      await locator.evaluate((element) => element.removeAttribute("data-a11y-probe"));
      if (!png) { resolved.push({ selector, status: "non mesurable" }); continue; }
      const sample = await page.evaluate(async (encoded) => {
        const image = new Image();
        image.src = `data:image/png;base64,${encoded}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const step = Math.max(1, Math.floor((data.length / 4) / 4000));
        const rgb = [];
        for (let pixel = 0; pixel < data.length / 4; pixel += step) rgb.push(data[pixel * 4], data[pixel * 4 + 1], data[pixel * 4 + 2]);
        return rgb;
      }, png.toString("base64"));
      const range = luminanceRange(sample);
      const ratio = range ? worstCaseRatio(relativeLuminance(text), range.min, range.max) : 0;
      const required = requiredRatio(info.size, info.weight);
      resolved.push({ selector, ratio: Number(ratio.toFixed(2)), required, status: ratio >= required ? "conforme" : "insuffisant" });
    }
  }
  return resolved;
}

/* ----- focus au clavier : jamais caché sous la barre du bas ou l'en-tête collant (WCAG 2.4.11) ----- */
async function focusObscured(page, steps = 40) {
  const failures = [];
  await page.evaluate(() => window.scrollTo(0, 0));
  for (let step = 0; step < steps; step += 1) {
    await page.keyboard.press("Tab");
    const state = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return null;
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height) return null;
      const top = document.elementFromPoint(box.left + box.width / 2, Math.min(Math.max(box.top + box.height / 2, 0), innerHeight - 1));
      const covered = !top || !(element === top || element.contains(top) || top.contains(element));
      return { covered, tag: element.tagName.toLowerCase(), label: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 40) };
    });
    if (state?.covered) failures.push(state);
  }
  return failures;
}

/* ----- cibles de moins de 24 × 24 px (WCAG 2.5.8) ----- */
function smallTargets(page) {
  return page.evaluate(() => [...document.querySelectorAll("a[href], button, [role='button'], summary, select, input:not([type='hidden']), textarea")]
    .filter((element) => {
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") return false;
      if (element.tagName === "A" && style.display === "inline") return false; // lien dans une phrase : exempté
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (box.width < 24 || box.height < 24);
    })
    .slice(0, 20)
    .map((element) => ({ tag: element.tagName.toLowerCase(), label: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 40), width: Math.round(element.getBoundingClientRect().width), height: Math.round(element.getBoundingClientRect().height) })));
}

const browser = await chromium.launch({ headless: true, executablePath });
const results = [];
try {
  for (const space of spaces) {
    const routes = space === "public" ? publicRoutes : SPACE_ROUTES[space];
    if (!routes) throw new Error(`Espace inconnu : ${space}`);
    for (const palette of space === "public" ? [paletteVariables[0]] : paletteVariables) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
      try {
        if (space !== "public") await login(context, space);
        for (const route of routes) {
          const page = await context.newPage();
          const consoleErrors = [];
          page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
          const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => null);
          if (palette.variables) await page.evaluate((variables) => { for (const [name, value] of Object.entries(variables)) document.documentElement.style.setProperty(name, value); }, palette.variables);
          await page.addScriptTag({ content: axeSource });
          // Les éléments aria-hidden (flèches, filigranes) ne sont pas lus et ne portent pas d'information : hors périmètre du contraste.
          const axe = await page.evaluate(() => window.axe.run(document, { exclude: [".pub-footer__watermark", "[aria-hidden='true']"], runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
          const contrast = await resolveContrast(page, axe.incomplete);
          const unresolved = axe.incomplete.filter((entry) => entry.id !== "color-contrast").map((entry) => ({ id: entry.id, nodes: entry.nodes.length }));
          const obscured = space === "public" ? [] : await focusObscured(page);
          const targets = await smallTargets(page);
          results.push({ space, palette: palette.id, route, status: response?.status() ?? 0, violations: axe.violations, contrast, unresolved, obscured, smallTargets: targets, passes: axe.passes.length, consoleErrors });
          await page.close();
        }
      } finally { await context.close(); }
    }
  }
} finally { await browser.close(); }

const violations = results.flatMap((item) => item.violations.map((violation) => ({ space: item.space, palette: item.palette, route: item.route, id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.length })));
const contrastFailures = results.flatMap((item) => item.contrast.filter((entry) => entry.status !== "conforme").map((entry) => ({ route: item.route, palette: item.palette, ...entry })));
const unresolved = results.flatMap((item) => item.unresolved.map((entry) => ({ route: item.route, ...entry })));
const obscured = results.flatMap((item) => item.obscured.map((entry) => ({ route: item.route, ...entry })));
const smallTargetCount = results.reduce((total, item) => total + item.smallTargets.length, 0);
const report = { generatedAt: new Date().toISOString(), base, standard: "WCAG 2.2 AA (axe-core + contrôles du projet)", spaces, palettes: paletteVariables.map((item) => item.id), routes: results, violationCount: violations.length, violations, contrastFailures, unresolved, obscured, smallTargetCount };
const reportPath = process.env.REPORT || "reports/wcag-2.2-aa-automated.json";
await fs.mkdir("reports", { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ base, spaces, pages: results.length, violations: violations.length, contrastToSettle: contrastFailures.length, otherUnresolved: unresolved.length, focusObscured: obscured.length, smallTargets: smallTargetCount, report: reportPath }, null, 2));
// Les cibles < 24 px sont listées dans le rapport ; elles bloquent seulement avec A11Y_TARGETS=strict (cases à cocher natives et cas de bordure à trier d'abord).
const strictTargets = process.env.A11Y_TARGETS === "strict";
if (violations.length || contrastFailures.length || unresolved.length || obscured.length || (strictTargets && smallTargetCount)) process.exitCode = 1;

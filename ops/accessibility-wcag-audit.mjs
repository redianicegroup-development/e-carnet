import { chromium } from "playwright";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);

const base = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const routes = (process.env.ROUTES || "/,/a-propos,/aide,/faq,/connexion,/inscription,/mentions-legales,/confidentialite,/cgu,/urgence/demo").split(",");
const executablePath = process.env.CHROMIUM_PATH || (() => { try { return execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(); } catch { return undefined; } })();
const browser = await chromium.launch({ headless: true, executablePath });
const results = [];
try {
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const consoleErrors = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => null);
    const axeSource = await fs.readFile(require.resolve("axe-core/axe.min.js"), "utf8");
    await page.addScriptTag({ content: axeSource });
    const axe = await page.evaluate(async () => window.axe.run(document, { exclude: [".pub-footer__watermark"], runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
    results.push({ route, status: response?.status() ?? 0, violations: axe.violations, incomplete: axe.incomplete, passes: axe.passes.length, consoleErrors });
    await page.close();
  }
} finally { await browser.close(); }
const violations = results.flatMap((item) => item.violations.map((violation) => ({ route: item.route, id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.length })));
const report = { generatedAt: new Date().toISOString(), base, standard: "WCAG 2.2 AA automated subset", routes: results, violationCount: violations.length, violations };
await fs.mkdir("reports", { recursive: true });
await fs.writeFile(process.env.REPORT || "reports/wcag-2.2-aa-automated.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ base, routes: results.length, violations: violations.length, report: process.env.REPORT || "reports/wcag-2.2-aa-automated.json" }, null, 2));
if (violations.length) process.exitCode = 1;

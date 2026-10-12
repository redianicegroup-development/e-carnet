// Garde-fous du Module 8 (AKATech) : pages juridiques gérées en donnée, aucune information inventée,
// aucune promesse de conformité, aucune publication tant qu'un champ reste « À COMPLÉTER ».
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const legal = await import("../src/lib/legal/config.ts");
const read = (file) => readFileSync(new URL(`../src/app/${file}/page.tsx`, import.meta.url), "utf8");

test("chaque document a une route unique, une version datée et une date ISO valide", () => {
  const paths = new Set();
  for (const doc of Object.values(legal.LEGAL_DOCS)) {
    assert.match(doc.path, /^\/[a-z-]+$/);
    assert.ok(!paths.has(doc.path), `route en double : ${doc.path}`);
    paths.add(doc.path);
    assert.match(doc.version, /^\d{4}-\d{2}-\d{2}-v\d+$/);
    assert.match(doc.lastUpdated, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!Number.isNaN(Date.parse(`${doc.lastUpdated}T00:00:00Z`)), `date invalide : ${doc.lastUpdated}`);
  }
  assert.equal(legal.formatLegalDate("2026-10-10"), "10 octobre 2026");
});

test("la publication est bloquée tant qu'un champ reste à compléter", () => {
  const pending = legal.pendingFields();
  if (legal.LEGAL_REVIEW.status === "validated") {
    assert.equal(pending.length, 0, `champs restants : ${pending.map((f) => f.key).join(", ")}`);
    assert.ok(legal.LEGAL_REVIEW.reviewer && legal.LEGAL_REVIEW.reviewedOn, "validation juridique sans nom ni date");
  } else {
    assert.ok(pending.length > 0, "statut « pending » mais plus aucun champ à compléter : passer en « validated » après avis du juriste");
  }
});

test("les données techniques déclarées correspondent à l'inventaire du code", () => {
  assert.deepEqual(legal.COOKIES.map((c) => c.name), ["sessionid", "csrftoken", "ecarnet_visitor"]);
  assert.deepEqual(legal.COOKIES.filter((c) => c.essential).map((c) => c.name), ["sessionid", "csrftoken"]);
  assert.deepEqual(legal.HOSTS.map((h) => h.name), ["Vercel", "Render", "Neon"]);
  assert.ok(!legal.HOSTS.some((h) => /hodi/i.test(h.name)), "Hodi ne doit pas figurer tant que contrat et déploiement n'existent pas");
});

test("les pages restent en mode juridique : pas de promesse de conformité ni de ton marketing", () => {
  const forbidden = [/aucun outil de mesure d’audience/i, /aucun bandeau de consentement/i, /\b100 ?%/, /(?<!ne )garantit\b/i, /conforme à la loi/i, /conformité garantie/i, /\bcertifié\b/i, /sécurité maximale/i, /\b(totalement|entièrement|parfaitement) (sécuris|conform|prot)/i];
  for (const page of ["mentions-legales", "confidentialite", "cgu"]) {
    const source = read(page);
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `${page} : formulation interdite ${pattern}`);
    assert.match(source, /index: false, follow: true/, `${page} : noindex,follow attendu par défaut`);
  }
});

test("la politique de confidentialité ne déclare aucun outil que le projet n'utilise pas", () => {
  const source = read("confidentialite");
  for (const tool of [/google analytics/i, /meta pixel/i, /\bhotjar\b/i, /\bsentry\b/i, /\bstripe\b/i]) assert.doesNotMatch(source, tool);
});

const src = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("un traceur présent dans le code doit être déclaré dans la politique (cookie de visiteur)", () => {
  const layout = src("app/layout.tsx");
  if (layout.includes("AnonymousVisitorTracker")) {
    const visitor = legal.COOKIES.find((c) => c.name === "ecarnet_visitor");
    assert.ok(visitor && visitor.essential === false, "AnonymousVisitorTracker est monté mais ecarnet_visitor n'est pas déclaré comme cookie de mesure");
  }
  const page = read("confidentialite");
  assert.match(page, /Mesure de fréquentation/, "la page de confidentialité doit décrire la mesure de fréquentation");
});

test("le seul stockage local applicatif est le cache de thème déclaré dans la politique", async () => {
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (dir) => readdirSync(dir).flatMap((name) => { const full = `${dir}/${name}`; return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : []; });
  const root = new URL("../src", import.meta.url).pathname;
  const offenders = walk(root).filter((file) => /\b(localStorage|sessionStorage|indexedDB)\b/.test(readFileSync(file, "utf8")) && !file.includes("/confidentialite/") && !file.includes("/tests/"));
  assert.deepEqual(offenders, [`${root}/lib/themeStorage.ts`], `seul themeStorage.ts doit utiliser le stockage local : ${offenders.join(", ")}`);
  const privacy = read("confidentialite");
  assert.match(privacy, /copie du thème d’apparence choisi/i);
  assert.match(privacy, /se synchronise lorsque vous utilisez un autre appareil/i);
  assert.doesNotMatch(readFileSync(offenders[0], "utf8"), /sessionStorage|indexedDB/i);
});

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
  assert.deepEqual(legal.COOKIES.map((c) => c.name), ["sessionid", "csrftoken", "ecarnet_analytics_consent", "ecarnet_visitor"]);
  assert.deepEqual(legal.COOKIES.filter((c) => c.essential).map((c) => c.name), ["sessionid", "csrftoken", "ecarnet_analytics_consent"]);
  assert.deepEqual(legal.HOSTS.map((h) => h.name), ["Vercel", "Render", "Neon"]);
  assert.ok(!legal.HOSTS.some((h) => /hodi/i.test(h.name)), "Hodi ne doit pas figurer tant que contrat et déploiement n'existent pas");
});

test("la session PWA reste persistante 7 jours sans activité et sa durée déclarée correspond au serveur", () => {
  const settings = readFileSync(new URL("../../../apps/api/config/settings.py", import.meta.url), "utf8");
  const env = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
  const productionEnv = readFileSync(new URL("../../../apps/api/.env.production.example", import.meta.url), "utf8");
  const render = readFileSync(new URL("../../../render.yaml", import.meta.url), "utf8");
  const sessionCookie = legal.COOKIES.find((cookie) => cookie.name === "sessionid");
  assert.match(settings, /SESSION_COOKIE_AGE = int\(os\.environ\.get\("ECARNET_SESSION_AGE_SECONDS", str\(60 \* 60 \* 24 \* 7\)\)\)/);
  assert.match(settings, /SESSION_EXPIRE_AT_BROWSER_CLOSE = False/);
  assert.match(settings, /SESSION_SAVE_EVERY_REQUEST = True/);
  assert.match(env, /^ECARNET_SESSION_AGE_SECONDS=604800$/m);
  assert.match(productionEnv, /^ECARNET_SESSION_AGE_SECONDS=604800$/m);
  assert.match(render, /key: ECARNET_SESSION_AGE_SECONDS\s+value: "604800"/);
  assert.match(sessionCookie.duration, /7 jours sans activité/);
  assert.match(legal.TECH_VALIDITY.session, /7 jours sans activité/);
});

test("les configurations de référence et les textes visibles gardent fermé l’accès clinique admin", () => {
  const settings = readFileSync(new URL("../../../apps/api/config/settings.py", import.meta.url), "utf8");
  const env = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
  const productionEnv = readFileSync(new URL("../../../apps/api/.env.production.example", import.meta.url), "utf8");
  const render = readFileSync(new URL("../../../render.yaml", import.meta.url), "utf8");
  const terms = read("cgu");
  const establishmentHelp = readFileSync(new URL("../src/components/EstablishmentHelp.tsx", import.meta.url), "utf8");
  const recipientsFigure = readFileSync(new URL("../src/components/public/figures/RecipientsFigure.tsx", import.meta.url), "utf8");
  assert.match(settings, /ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ = os\.environ\.get\("ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ", "false"\)/);
  assert.match(env, /^ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ=false$/m);
  assert.match(productionEnv, /^ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ=false$/m);
  assert.match(render, /key: ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ\s+value: "false"/);
  assert.match(terms, /ne peut pas ouvrir le dossier.*reste désactivé par défaut/);
  assert.match(establishmentHelp, /ne peut pas ouvrir les dossiers.*reste désactivé par défaut/);
  assert.match(recipientsFigure, /gate: "closed", open: false/);
  assert.doesNotMatch(terms, /décision A8/);
});

test("la confidentialité distingue le cache API chiffré de la copie de carte QR non chiffrée", () => {
  const privacy = read("confidentialite");
  const security = read("securite");
  const help = readFileSync(new URL("../src/components/help/helpContent.ts", import.meta.url), "utf8");
  assert.match(privacy, /Copie hors connexion chiffrée \(IndexedDB\)/);
  assert.match(privacy, /Carte d’urgence ouverte par QR \(IndexedDB, copie séparée\)/);
  assert.match(privacy, /sans chiffrement applicatif/);
  assert.match(privacy, /n’est pas gérée par le réglage du cache API/);
  assert.doesNotMatch(privacy, /la seule copie de données est celle, chiffrée/);
  assert.match(security, /À part, une carte d’urgence ouverte par QR est gardée jusqu’à 24 heures.*sans chiffrement applicatif/);
  assert.match(help, /copie séparée.*sans chiffrement applicatif/);
});

test("la page /v1 ne promet ni stabilité de production, ni ETA-13, ni essais PAT-21 déjà réalisés", () => {
  const page = read("v1");
  assert.match(page, /ETA-13.*n’est pas implémenté/);
  assert.match(page, /essais avec cinq personnes.*ne sont pas déclarés comme réalisés/);
  assert.match(page, /données de santé réelles ne sont pas autorisées/);
  assert.doesNotMatch(page, /V1 stable et utilisable|socle fiable et utilisable|Share inter-établissements/);
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

test("chaque usage du stockage navigateur est connu, et déclaré dans la politique (sauf l'indicateur de défilement, sans donnée personnelle)", async () => {
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (dir) => readdirSync(dir).flatMap((name) => { const full = `${dir}/${name}`; return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : []; });
  const root = new URL("../src", import.meta.url).pathname;
  const offenders = walk(root).filter((file) => /\b(localStorage|sessionStorage|indexedDB)\b/.test(readFileSync(file, "utf8")) && !file.includes("/confidentialite/") && !file.includes("/tests/")).map((file) => file.slice(root.length + 1)).sort();
  assert.deepEqual(offenders, ["components/ScrollToTopOnNavigate.tsx", "components/public/PublicFooterScrollToTop.tsx", "lib/emergency-card-offline.ts", "lib/offline-cache.ts", "lib/offline-snapshot.ts", "lib/themeStorage.ts"], `usage du stockage navigateur non déclaré : ${offenders.join(", ")}`);
  const privacy = read("confidentialite");
  assert.match(privacy, /copie du thème d’apparence choisi/i);
  assert.match(privacy, /se synchronise lorsque vous utilisez un autre appareil/i);
  assert.match(privacy, /Copie hors connexion chiffrée \(IndexedDB\)/);
  assert.match(privacy, /Carte d’urgence ouverte par QR \(IndexedDB(?:, copie séparée)?\)/);
  assert.match(privacy, /sessionStorage[^.]*chemin[^.]*10 secondes/i, "le scroll du pied de page public est temporaire et décrit");
  // Le thème (localStorage) ne touche pas aux autres mécanismes ; l’indicateur de défilement (sessionStorage) ne garde qu'un chemin et une date.
  assert.doesNotMatch(readFileSync(`${root}/lib/themeStorage.ts`, "utf8"), /sessionStorage|indexedDB/i);
  const scroll = readFileSync(`${root}/lib/scroll-to-top.ts`, "utf8");
  assert.match(scroll, /JSON\.stringify\(\{ pathname, createdAt: now \}\)/);
});

test("la politique décrit la suppression immédiate et les seules traces protégées conservées", () => {
  const privacy = read("confidentialite");
  assert.match(privacy, /désactive immédiatement l’accès, sans agrément préalable/i);
  assert.match(privacy, /journaux d’audit immuables/i);
  assert.match(privacy, /trace anonymisée du motif de suppression/i);
});

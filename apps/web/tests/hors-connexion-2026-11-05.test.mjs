// Hors connexion (05/11/2026) : bandeau et messages clairs, relais fetch, copie CHIFFRÉE des lectures de l'API, écrans préparés.
// Le vrai code de src/lib est exécuté (WebCrypto de Node, faux IndexedDB) ; les composants sont vérifiés dans leur source.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createFakeIndexedDB } from "./helpers/fake-indexeddb.mjs";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const policy = await import("../src/lib/offline-policy.ts");
const net = await import("../src/lib/network-status.ts");
const cache = await import("../src/lib/offline-cache.ts");
const relay = await import("../src/lib/offline-fetch.ts");
const routes = await import("../src/lib/offline-routes.ts");
const spaces = await import("../src/lib/spaces.ts");

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-11-05T08:00:00.000Z");
const ORIGIN = "https://ecarnet.test";
const CACHE_DB = "ecarnet-offline-cache-v1";
const tick = (ms = 15) => new Promise((resolve) => setTimeout(resolve, ms));
/** Attend qu'une condition asynchrone soit vraie (les copies se font en tâche de fond) ; échoue au bout de 2 s. */
async function waitFor(condition, label = "condition") {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await condition()) return;
    await tick(20);
  }
  assert.fail(`délai dépassé : ${label}`);
}

function setGlobal(name, value) { Object.defineProperty(globalThis, name, { value, configurable: true, writable: true }); }
function freshBrowser() {
  const idb = createFakeIndexedDB();
  setGlobal("indexedDB", idb);
  cache.resetOfflineCacheForTests();
  return idb;
}
const json = (data) => JSON.stringify({ data });

/* ---------- règles pures ---------- */
test("copie chiffrée : seules les lectures de l'API du patient, du professionnel, de l'établissement et du compte sont éligibles", () => {
  const yes = ["/api/v1/patient/declarations/", "/api/v1/patient/care/appointments/?page=2", "/api/v1/professionals/me/", "/api/v1/establishments/", "/api/v1/identity/me/", "/api/v1/identity/me/theme/", "/api/v1/patient/emergency-card/"];
  const no = [
    "/api/v1/csrf/", "/api/v1/health/", "/api/v1/health/ready/", "/api/v1/identity/logout/", "/api/v1/identity/oauth/identities/",
    "/api/v1/patient/emergency-card/qr/abc/", "/api/v1/patient/care/access-qr/", "/api/v1/patient/documents/12/file/", "/api/v1/patient/export/",
    "/api/v1/professionals/credentials/stamp/", "/api/v1/establishments/join-codes/token/", "/api/v1/admin/audit/", "/api/v1/staff/etablissements/",
    "/api/v1/patient/../admin/", "/autre/api/v1/patient/x/", "/api/v2/patient/x/", "https://autre.test/api/v1/patient/x/", "", undefined,
  ];
  for (const path of yes) assert.equal(policy.isCacheablePath(path), true, path);
  for (const path of no) assert.equal(policy.isCacheablePath(path), false, String(path));
});

test("copie chiffrée : 7 jours pour le patient et son compte, 24 h pour les données de tiers ; groupe = ressource sans identifiant", () => {
  assert.equal(policy.cacheTtlMs("/api/v1/patient/declarations/"), 7 * DAY);
  assert.equal(policy.cacheTtlMs("/api/v1/identity/me/"), 7 * DAY);
  assert.equal(policy.cacheTtlMs("/api/v1/professionals/me/"), 7 * DAY, "le profil du médecin ouvre l'espace : 7 jours comme la session");
  assert.equal(policy.cacheTtlMs("/api/v1/establishments/"), DAY);
  assert.equal(policy.cacheArea("/api/v1/establishments/x/"), "establishment");
  assert.equal(policy.cacheArea("/api/v1/admin/x/"), null);
  assert.equal(policy.cacheGroup("/api/v1/patient/declarations/12/?x=1"), "/api/v1/patient/declarations/");
  assert.equal(policy.cacheGroup("/api/v1/patient/declarations/"), "/api/v1/patient/declarations/");
});

test("copie chiffrée : un changement de compte, d'espace, de profil ou d'établissement actif est une écriture qui change tout", () => {
  assert.equal(policy.changesSessionScope("/api/v1/identity/contexts/select/", "POST"), true);
  assert.equal(policy.changesSessionScope("/api/v1/identity/login/", "POST"), true);
  assert.equal(policy.changesSessionScope("/api/v1/identity/logout/", "POST"), true);
  assert.equal(policy.changesSessionScope("/api/v1/patient/representations/active/", "POST"), true);
  assert.equal(policy.changesSessionScope("/api/v1/establishments/active/", "POST"), true);
  assert.equal(policy.changesSessionScope("/api/v1/identity/me/theme/", "PATCH"), false, "le thème ne change pas de contexte");
  assert.equal(policy.changesSessionScope("/api/v1/patient/declarations/", "POST"), false);
  assert.equal(policy.changesSessionScope("/api/v1/identity/contexts/", "GET"), false, "une lecture ne change rien");
});

test("réseau : « hors connexion » = aucune réponse HTTP ; un serveur lent ou en erreur n'est jamais hors connexion", () => {
  assert.equal(net.isFetchNetworkFailure(new TypeError("Failed to fetch")), true);
  assert.equal(net.isFetchNetworkFailure(new TypeError("Load failed")), true);
  assert.equal(net.isFetchNetworkFailure(new DOMException("délai", "AbortError")), false);
  assert.equal(net.isFetchNetworkFailure({ status: 503 }), false);
  assert.equal(net.pingVerdictFromError(new TypeError("x")), "down");
  assert.equal(net.pingVerdictFromError(new DOMException("délai", "AbortError")), "unknown", "un délai dépassé (serveur qui se réveille) ne déclenche pas le bandeau");
  assert.equal(net.isOfflineVerdict(false, 0), true, "le navigateur dit hors ligne : immédiat");
  assert.equal(net.isOfflineVerdict(true, 1), false, "un seul échec ne suffit pas");
  assert.equal(net.isOfflineVerdict(true, 2), true, "Wi-Fi sans Internet : deux échecs");
  for (const message of [net.NETWORK_ERROR_MESSAGE, net.WRITE_OFFLINE_MESSAGE, net.OFFLINE_NO_COPY_MESSAGE, net.OFFLINE_BANNER_TITLE, net.OFFLINE_BANNER_TEXT]) assert.doesNotMatch(message, /Failed to fetch|Load failed|NetworkError/i);
  assert.match(net.OFFLINE_BANNER_TITLE, /hors connexion/i);
  assert.equal(net.formatCopyDate(null), "");
  assert.equal(net.formatCopyDate("pas une date"), "");
  assert.match(net.formatCopyDate(NOW), /\d/);
});

/* ---------- copie chiffrée (WebCrypto réel, faux IndexedDB) ---------- */
test("copie chiffrée : relecture exacte, mais ni le contenu ni l'adresse n'apparaissent dans la base ; clés non extractibles", async () => {
  const idb = freshBrowser();
  const path = "/api/v1/patient/declarations/";
  const body = json([{ id: "d1", label: "Pénicilline — allergie sévère" }]);
  assert.equal(await cache.rememberResponse(path, body, NOW), true);
  assert.deepEqual(await cache.recallResponse(path, NOW + HOUR), { text: body, savedAt: NOW });
  const dump = JSON.stringify(idb.rows(CACHE_DB, "entries"));
  assert.doesNotMatch(dump, /Pénicilline|allergie|declarations|api\/v1/, "ni le contenu ni l'adresse ne sont lisibles dans les entrées");
  const [row] = idb.rows(CACHE_DB, "entries");
  assert.deepEqual(Object.keys(row).sort(), ["area", "ct", "expiresAt", "group", "id", "iv", "savedAt"], "seuls l'espace, les dates et le chiffré sont en clair");
  assert.match(row.id, /^[0-9a-f]{64}$/, "le nom de l'entrée est un HMAC-SHA-256");
  assert.match(row.group, /^[0-9a-f]{64}$/);
  const keys = idb.rows(CACHE_DB, "meta").filter((item) => item.value && item.name !== "account");
  assert.equal(keys.length, 2);
  for (const item of keys) assert.equal(item.value.extractable, false, `${item.name} ne doit pas pouvoir être exportée`);
  await assert.rejects(crypto.subtle.exportKey("raw", keys[0].value));
  await cache.rememberResponse(path, body, NOW + 1);
  assert.equal(idb.rows(CACHE_DB, "entries").length, 1, "même adresse, même entrée (pas de doublon)");
  assert.equal(idb.rows(CACHE_DB, "entries")[0].id, row.id, "le nom haché est stable");
  assert.notEqual(idb.rows(CACHE_DB, "entries")[0].iv, row.iv, "un nouveau vecteur d'initialisation à chaque écriture");
});

test("copie chiffrée : périmée = supprimée ; 7 jours pour le patient, 24 h pour les données de tiers", async () => {
  const idb = freshBrowser();
  await cache.rememberResponse("/api/v1/patient/declarations/", json([1]), NOW);
  await cache.rememberResponse("/api/v1/establishments/", json({ x: 1 }), NOW);
  assert.ok(await cache.recallResponse("/api/v1/patient/declarations/", NOW + 6 * DAY));
  assert.equal(await cache.recallResponse("/api/v1/establishments/", NOW + 25 * HOUR), null, "tiers : 24 h");
  assert.equal(idb.rows(CACHE_DB, "entries").length, 1, "la copie périmée est SUPPRIMÉE, pas seulement ignorée");
  assert.equal(await cache.recallResponse("/api/v1/patient/declarations/", NOW + 8 * DAY), null, "patient : 7 jours");
  assert.equal(idb.rows(CACHE_DB, "entries").length, 0);
  assert.equal(await cache.recallResponse("/api/v1/patient/declarations/", NOW - 2 * HOUR), null, "une horloge qui recule ne rend pas la copie éternelle");
});

test("copie chiffrée : une entrée échangée ou altérée est refusée et supprimée (données authentifiées)", async () => {
  const idb = freshBrowser();
  const a = "/api/v1/patient/declarations/";
  const b = "/api/v1/patient/care/appointments/";
  await cache.rememberResponse(a, json(["A"]), NOW);
  await cache.rememberResponse(b, json(["B"]), NOW);
  const [first, second] = idb.rows(CACHE_DB, "entries");
  idb.seed(CACHE_DB, "entries", "id", [{ ...first, iv: second.iv, ct: second.ct }]); // le chiffré de B sous le nom de A
  assert.equal(await cache.recallResponse(a, NOW + HOUR), null);
  assert.equal(idb.rows(CACHE_DB, "entries").some((row) => row.id === first.id), false, "l'entrée altérée est supprimée");
  assert.ok(await cache.recallResponse(b, NOW + HOUR), "les autres entrées restent lisibles");
});

test("copie chiffrée : n'enregistre ni l'inéligible, ni le trop gros, ni rien quand le réglage est coupé", async () => {
  const idb = freshBrowser();
  assert.equal(await cache.rememberResponse("/api/v1/csrf/", json({ token: "x" }), NOW), false);
  assert.equal(await cache.rememberResponse("/api/v1/patient/documents/1/file/", "binaire", NOW), false);
  assert.equal(await cache.rememberResponse("/api/v1/patient/declarations/", "", NOW), false);
  assert.equal(await cache.rememberResponse("/api/v1/patient/declarations/", "x".repeat(policy.CACHE_MAX_ENTRY_CHARS + 1), NOW), false);
  assert.equal(idb.rows(CACHE_DB, "entries").length, 0);
  idb.seed("ecarnet-offline-v1", "snapshots", "key", [{ key: "prefs", declarationsEnabled: false }]);
  cache.resetOfflineCacheEnabledMemo();
  assert.equal(await cache.rememberResponse("/api/v1/patient/declarations/", json([1]), NOW), false, "réglage coupé : rien n'est copié");
  assert.equal(idb.rows(CACHE_DB, "entries").length, 0);
});

test("copie chiffrée : un autre compte sur le même appareil repart de zéro", async () => {
  const idb = freshBrowser();
  await cache.rememberResponse("/api/v1/identity/me/", json({ id: "a1" }), NOW);
  await cache.rememberResponse("/api/v1/patient/declarations/", json(["secret du compte a1"]), NOW);
  await cache.rememberResponse("/api/v1/identity/me/", json({ id: "a2" }), NOW + HOUR);
  assert.equal(await cache.recallResponse("/api/v1/patient/declarations/", NOW + HOUR), null, "rien du compte précédent ne doit survivre");
  assert.match((await cache.recallResponse("/api/v1/identity/me/", NOW + HOUR)).text, /a2/);
  assert.equal(idb.rows(CACHE_DB, "entries").length, 1);
  await cache.rememberResponse("/api/v1/identity/me/", json({ id: "a2" }), NOW + 2 * HOUR);
  await cache.rememberResponse("/api/v1/patient/declarations/", json(["a2"]), NOW + 2 * HOUR);
  await cache.rememberResponse("/api/v1/identity/me/", json({ id: "a2" }), NOW + 3 * HOUR);
  assert.ok(await cache.recallResponse("/api/v1/patient/declarations/", NOW + 3 * HOUR), "le même compte garde sa copie");
});

test("copie chiffrée : invalidation d'une ressource, effacement du contexte (identité conservée), effacement total avec les clés", async () => {
  const idb = freshBrowser();
  const decl = "/api/v1/patient/declarations/";
  const appts = "/api/v1/patient/care/appointments/";
  const me = "/api/v1/identity/me/";
  const pro = "/api/v1/professionals/me/";
  for (const path of [decl, `${decl}?profil=2`, appts, me, pro]) await cache.rememberResponse(path, path === me ? json({ id: "a1" }) : json([path]), NOW);
  await cache.invalidateGroupOf(`${decl}12/`);
  assert.equal(await cache.recallResponse(decl, NOW), null);
  assert.equal(await cache.recallResponse(`${decl}?profil=2`, NOW), null);
  assert.ok(await cache.recallResponse(appts, NOW), "une autre ressource n'est pas touchée");
  await cache.purgeScopedEntries();
  assert.equal(await cache.recallResponse(appts, NOW), null);
  assert.equal(await cache.recallResponse(pro, NOW), null);
  assert.ok(await cache.recallResponse(me, NOW), "l'identité du même compte est conservée");
  const before = idb.rows(CACHE_DB, "entries").map((row) => ({ ...row }));
  await cache.purgeOfflineCache();
  assert.equal(idb.rows(CACHE_DB, "entries").length, 0);
  assert.equal(idb.rows(CACHE_DB, "meta").length, 0, "les clés disparaissent aussi : rien ne redevient lisible");
  cache.resetOfflineCacheForTests();
  idb.seed(CACHE_DB, "entries", "id", before); // une copie du disque faite avant l'effacement
  assert.equal(await cache.recallResponse(me, NOW), null, "avec une nouvelle clé, l'ancienne copie est illisible");
  assert.equal(await cache.rememberResponse(appts, json(["neuf"]), NOW), true, "la copie repart normalement après un effacement");
});

/* ---------- relais fetch ---------- */
function relayEnv({ online = true, impl }) {
  const events = [];
  const calls = [];
  const env = {
    fetch: async (input, init) => { calls.push({ input, init }); return impl(input, init); },
    location: { origin: ORIGIN },
    navigator: { onLine: online },
    dispatchEvent: (event) => { events.push(event); return true; },
  };
  const uninstall = relay.installOfflineFetch(env);
  return { env, events, calls, uninstall };
}
const jsonResponse = (data, status = 200, type = "application/json") => new Response(JSON.stringify({ data }), { status, headers: { "content-type": type } });
const down = () => { throw new TypeError("Failed to fetch"); };

test("relais : lecture réussie → copie en tâche de fond ; sans réseau → réponse reconstruite depuis la copie, marquée, annoncée", async () => {
  freshBrowser();
  let network = true;
  const { env, events } = relayEnv({ impl: async () => (network ? jsonResponse([{ id: "d1" }]) : down()) });
  const live = await env.fetch("/api/v1/patient/declarations/", { credentials: "include" });
  assert.deepEqual((await live.json()).data, [{ id: "d1" }]);
  await waitFor(async () => (await cache.recallResponse("/api/v1/patient/declarations/")) !== null, "copie enregistrée en tâche de fond");
  network = false;
  const copy = await env.fetch("/api/v1/patient/declarations/", { credentials: "include" });
  assert.equal(copy.status, 200);
  assert.deepEqual((await copy.json()).data, [{ id: "d1" }]);
  assert.ok(copy.headers.get(policy.OFFLINE_COPY_HEADER), "l'en-tête indique que c'est une copie");
  const served = events.find((event) => event.type === net.SERVED_FROM_COPY_EVENT);
  assert.ok(served && typeof served.detail.savedAt === "number");
  assert.ok(events.some((event) => event.type === net.NETWORK_FAILURE_EVENT));
});

test("relais : sans copie, l'erreur est lisible (plus de « Failed to fetch ») mais reste un TypeError", async () => {
  freshBrowser();
  const { env } = relayEnv({ impl: async () => down() });
  await assert.rejects(env.fetch("/api/v1/patient/care/appointments/"), (error) => error instanceof TypeError && error.message === net.NETWORK_ERROR_MESSAGE);
  await assert.rejects(env.fetch("/api/v1/health/"), (error) => error instanceof TypeError && error.message === net.NETWORK_ERROR_MESSAGE, "la sonde aussi");
});

test("relais : navigateur hors ligne → aucun appel réseau, copie servie ; écriture refusée avec un message clair, rien n'est mis en attente", async () => {
  freshBrowser();
  await cache.rememberResponse("/api/v1/patient/declarations/", json(["copie"]), Date.now());
  const { env, calls } = relayEnv({ online: false, impl: async () => jsonResponse([]) });
  const copy = await env.fetch("/api/v1/patient/declarations/", { credentials: "include" });
  assert.deepEqual((await copy.json()).data, ["copie"]);
  await assert.rejects(env.fetch("/api/v1/patient/declarations/", { method: "POST", body: "{}" }), (error) => error instanceof TypeError && error.message === net.WRITE_OFFLINE_MESSAGE);
  await assert.rejects(env.fetch("/api/v1/patient/care/appointments/", { credentials: "include" }), (error) => error.message === net.NETWORK_ERROR_MESSAGE);
  assert.equal(calls.length, 0, "aucun appel réseau tant que le navigateur se dit hors ligne");
});

test("relais : une écriture qui échoue faute de réseau est annoncée et lisible ; une écriture réussie retire les lectures de la même ressource", async () => {
  freshBrowser();
  let mode = "ok";
  const { env, events } = relayEnv({ impl: async (input, init) => {
    if (mode === "down") return down();
    return (init?.method ?? "GET") === "GET" ? jsonResponse(["liste"]) : jsonResponse({ ok: true }, 201);
  } });
  await env.fetch("/api/v1/patient/declarations/", { credentials: "include" });
  await waitFor(async () => (await cache.recallResponse("/api/v1/patient/declarations/")) !== null, "copie enregistrée");
  await env.fetch("/api/v1/patient/declarations/", { method: "POST", body: "{}", credentials: "include" });
  await waitFor(async () => (await cache.recallResponse("/api/v1/patient/declarations/")) === null, "liste retirée après l'écriture");
  mode = "down";
  await assert.rejects(env.fetch("/api/v1/patient/declarations/", { method: "PATCH", body: "{}" }), (error) => error.message === net.WRITE_OFFLINE_MESSAGE);
  assert.ok(events.some((event) => event.type === net.NETWORK_FAILURE_EVENT));
});

test("relais : changer d'espace ou se déconnecter efface toute la copie ; changer de profil/établissement efface tout sauf l'identité", async () => {
  freshBrowser();
  const { env } = relayEnv({ impl: async (input, init) => ((init?.method ?? "GET") === "GET" ? jsonResponse({ id: "a1" }) : jsonResponse({ ok: true })) });
  const fill = async () => {
    await cache.rememberResponse("/api/v1/identity/me/", json({ id: "a1" }), Date.now());
    await cache.rememberResponse("/api/v1/patient/declarations/", json(["x"]), Date.now());
  };
  await fill();
  await env.fetch("/api/v1/patient/representations/active/", { method: "POST", body: "{}" });
  await waitFor(async () => (await cache.recallResponse("/api/v1/patient/declarations/")) === null, "contexte effacé");
  assert.ok(await cache.recallResponse("/api/v1/identity/me/"), "profil actif changé : l'identité du compte reste");
  await fill();
  await env.fetch("/api/v1/identity/contexts/select/", { method: "POST", body: "{}" });
  await waitFor(async () => (await cache.recallResponse("/api/v1/identity/me/")) === null, "tout effacé");
  assert.equal(await cache.recallResponse("/api/v1/patient/declarations/"), null, "autre espace : tout est effacé");
});

test("relais : n'intercepte ni un autre site, ni une requête hors /api/v1/, ni les délais dépassés ; ne garde ni erreur ni réponse non JSON", async () => {
  const idb = freshBrowser();
  const abort = new DOMException("délai", "AbortError");
  let next = () => jsonResponse([1]);
  const { env, calls } = relayEnv({ impl: async () => next() });
  await env.fetch("https://autre.test/api/v1/patient/declarations/");
  await env.fetch("/_next/static/chunks/app.js");
  await env.fetch("/api/v1/patient/declarations/", { credentials: "omit" });
  await tick();
  assert.equal(calls.length, 3);
  assert.equal(idb.rows(CACHE_DB, "entries").length, 0, "rien de tout cela n'est copié");
  next = () => jsonResponse(["x"], 500);
  await env.fetch("/api/v1/patient/declarations/", { credentials: "include" });
  next = () => jsonResponse(["x"], 200, "application/pdf");
  await env.fetch("/api/v1/patient/care/appointments/", { credentials: "include" });
  await tick();
  assert.equal(idb.rows(CACHE_DB, "entries").length, 0, "ni erreur serveur ni réponse non JSON");
  next = () => { throw abort; };
  await assert.rejects(env.fetch("/api/v1/patient/declarations/", { credentials: "include" }), (error) => error === abort, "un délai dépassé n'est pas une absence de réseau (le serveur peut se réveiller)");
  next = () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(env.fetch("https://autre.test/x"), (error) => error.message === "Failed to fetch", "un autre site garde son erreur d'origine");
});

test("relais : posé une seule fois, et retirable", () => {
  freshBrowser();
  const { env, uninstall } = relayEnv({ impl: async () => jsonResponse([]) });
  const installed = env.fetch;
  assert.equal(relay.installOfflineFetch(env)(), undefined, "une seconde pose ne fait rien");
  assert.equal(env.fetch, installed, "pas de double enveloppe");
  uninstall();
  assert.notEqual(env.fetch, installed);
});

/* ---------- écrans préparés et branchement ---------- */
test("écrans préparés : chaque adresse est une vraie page, chaque onglet des espaces est préparé, le service worker connaît les pages d'information", () => {
  const exists = (route) => existsSync(new URL(`../src/app${route === "/" ? "" : route}/page.tsx`, import.meta.url));
  for (const space of Object.keys(routes.SPACE_ROUTES)) {
    for (const route of routes.SPACE_ROUTES[space]) assert.ok(exists(route), `${route} n'est pas une page`);
    for (const tab of spaces.SPACES[space].tabs) assert.ok(routes.SPACE_ROUTES[space].includes(tab.href), `onglet ${tab.href} non préparé`);
    assert.deepEqual(routes.routesToWarm(space).slice(-routes.INFO_ROUTES.length), [...routes.INFO_ROUTES]);
  }
  for (const route of routes.INFO_ROUTES) assert.ok(exists(route), `${route} n'est pas une page`);
  const sw = read("public/sw.js");
  const listed = JSON.parse(`[${/const PUBLIC_PAGES = \[(.*?)\];/.exec(sw)[1]}]`);
  for (const route of routes.INFO_ROUTES) assert.ok(listed.includes(route), `${route} absent du précache du service worker`);
  for (const route of ["/aide", "/a-propos", "/securite", "/credits", "/cgu", "/confidentialite", "/mentions-legales"]) assert.ok(routes.INFO_ROUTES.includes(route), `page « en savoir plus » ${route}`);
});

test("branchement : bandeau et relais montés pour toute l'application, barres collantes sous le bandeau, nettoyage à la déconnexion", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /<NetworkProvider><OfflineBanner \/>[\s\S]*\{children\}[\s\S]*<\/NetworkProvider>/);
  assert.match(layout, /network-banner\.css/);
  const provider = read("src/components/network/NetworkProvider.tsx");
  assert.match(provider, /^"use client";\s*\n[^\n]*\n?import "\.\.\/\.\.\/lib\/offline-fetch";/m, "le relais est posé à l'import, avant les effets des composants");
  assert.match(provider, /pingVerdictFromError/);
  assert.match(provider, /RESTORED_WITH_REFRESH_MS/);
  const banner = read("src/components/network/OfflineBanner.tsx");
  assert.match(banner, /role="status" aria-live="polite"/);
  assert.match(banner, /OFFLINE_BANNER_TITLE/);
  assert.match(banner, /RESTORED_BANNER_TITLE/);
  assert.match(banner, /Actualiser/);
  const css = read("src/components/network/network-banner.css");
  assert.match(css, /\.net-banner-slot \{ position: sticky; top: 0;/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  for (const [file, expected] of [["src/components/shell/sidebar.css", 3], ["src/app/site-pages.css", 1]]) {
    assert.equal(read(file).split("var(--net-banner-h, 0px)").length - 1 >= expected, true, `${file} : barres collantes décalées sous le bandeau`);
  }
  assert.match(read("src/lib/logout.ts"), /purgeOfflineCache\(\)/);
  for (const file of ["src/components/AccountSettingsClient.tsx", "src/components/ProfessionalSettingsClient.tsx", "src/components/EstablishmentSettingsClient.tsx"]) {
    assert.match(read(file), /activeSection === "hors-connexion"[\s\S]*<OfflineDataToggle/, `${file} : rubrique Hors connexion`);
  }
  assert.match(read("src/components/ProfessionalSettingsClient.tsx"), /<OfflineDataToggle audience="third-party" \/>/);
  const toggle = read("src/components/OfflineDataToggle.tsx");
  assert.match(toggle, /purgeOfflineCache\(\)/);
  assert.match(toggle, /resetOfflineCacheEnabledMemo\(\)/);
  assert.match(read("public/sw.js"), /ecarnet-public-v6/);
});

test("sécurité : le service worker ne garde jamais de réponse d'API ; la copie ne dépend d'aucune clé écrite dans le code", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /request\.method !== "GET" \|\| path\.startsWith\("\/api\/"\)\) return;/);
  const cacheSource = read("src/lib/offline-cache.ts");
  assert.match(cacheSource, /generateKey\(\{ name: "AES-GCM", length: 256 \}, false,/, "clé AES non extractible");
  assert.match(cacheSource, /generateKey\(\{ name: "HMAC", hash: "SHA-256" \}, false,/, "clé HMAC non extractible");
  assert.match(cacheSource, /additionalData: encoder\.encode\(id\)/, "chiffré lié au nom de l'entrée");
  assert.doesNotMatch(cacheSource, /exportKey|importKey|localStorage|sessionStorage|Math\.random/);
  assert.match(cacheSource, /crypto\.getRandomValues\(new Uint8Array\(12\)\)/, "vecteur d'initialisation aléatoire");
});

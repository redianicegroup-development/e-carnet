// Hors connexion (décision du 02/11/2026) : copie des déclarations en lecture seule, carte d'urgence qui expire vraiment,
// désabonnement push et effacement à la déconnexion, textes d'information. Le vrai code de src/lib est exécuté sur un faux IndexedDB.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { createFakeIndexedDB } from "./helpers/fake-indexeddb.mjs";
import { loadTs } from "./helpers/load-ts.mjs";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const policy = await import("../src/lib/offline-policy.ts");
const reader = createRequire(import.meta.url)("../public/hors-connexion.js");

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-11-02T10:00:00.000Z");
const iso = (offsetMs) => new Date(NOW + offsetMs).toISOString();

function setGlobal(name, value) { Object.defineProperty(globalThis, name, { value, configurable: true, writable: true }); }
function browser({ online = true } = {}) {
  const idb = createFakeIndexedDB();
  setGlobal("indexedDB", idb);
  setGlobal("window", { indexedDB: idb, setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 20)), clearTimeout });
  setGlobal("navigator", { onLine: online });
  return idb;
}
const snapshotLib = () => loadTs("src/lib/offline-snapshot.ts", { "./offline-policy": policy });
const cardLib = () => loadTs("src/lib/emergency-card-offline.ts", { "./offline-policy": policy });
const apiDeclaration = (id, kind, label, extra = {}) => ({ id, kind, label, details: "", status: "declared", provenance: { code: "declared", label: "Déclaré par le patient" }, created_at: iso(-DAY), updated_at: iso(-DAY), ...extra });
const profiles = [
  { id: "p1", kind: "self", first_name: "Aka", last_name: "Elvis" },
  { id: "c1", kind: "child", first_name: "Awa", last_name: "Elvis" },
];

/* ---------- règles pures ---------- */
test("isExpired : limite, date invalide et horloge dans le futur", () => {
  assert.equal(policy.isExpired(iso(-23 * HOUR), policy.EMERGENCY_CARD_MAX_AGE_MS, NOW), false);
  assert.equal(policy.isExpired(iso(-25 * HOUR), policy.EMERGENCY_CARD_MAX_AGE_MS, NOW), true);
  assert.equal(policy.isExpired("pas une date", policy.SNAPSHOT_MAX_AGE_MS, NOW), true);
  assert.equal(policy.isExpired(undefined, policy.SNAPSHOT_MAX_AGE_MS, NOW), true);
  assert.equal(policy.isExpired(iso(2 * DAY), policy.SNAPSHOT_MAX_AGE_MS, NOW), true, "une date dans le futur ne doit pas rendre la copie éternelle");
  assert.equal(policy.isExpired(iso(-6 * DAY), policy.SNAPSHOT_MAX_AGE_MS, NOW), false);
  assert.equal(policy.isExpired(iso(-8 * DAY), policy.SNAPSHOT_MAX_AGE_MS, NOW), true);
});

test("carte d'urgence : la copie n'est autorisée que sans réponse du serveur ; 404 et 410 la font oublier", () => {
  const status = (code) => ({ status: code });
  assert.equal(policy.emergencyCardFallback(new TypeError("Failed to fetch")), "use-cache");
  assert.equal(policy.emergencyCardFallback(new DOMException("délai", "AbortError")), "use-cache");
  for (const code of [0, 429, 500, 502, 503, 504]) assert.equal(policy.emergencyCardFallback(status(code)), "use-cache", String(code));
  for (const code of [404, 410]) assert.equal(policy.emergencyCardFallback(status(code)), "forget", String(code));
  for (const code of [400, 401, 403]) assert.equal(policy.emergencyCardFallback(status(code)), "none", String(code));
});

test("toOfflineDeclaration : ne garde que ce qui s'affiche (minimisation) et ignore le mal formé", () => {
  const kept = policy.toOfflineDeclaration(apiDeclaration("d1", "allergy", "Pénicilline", { details: "Éruption", patient: "secret", created_at: "x" }));
  assert.deepEqual(kept, { id: "d1", kind: "allergy", label: "Pénicilline", details: "Éruption", provenance: "Déclaré par le patient" });
  assert.equal(policy.toOfflineDeclaration(null), null);
  assert.equal(policy.toOfflineDeclaration({ id: "d2", kind: "allergy" }), null);
  assert.equal(policy.toOfflineDeclaration({ id: "d3", kind: "treatment", label: "x".repeat(500) }).label.length, 200);
});

test("mergeSnapshot : fusionne les profils, repart de zéro pour un autre compte, retire profils disparus et copies périmées", () => {
  const first = policy.mergeSnapshot(null, { accountId: "a1", activeProfileId: "p1", profiles, declarations: [policy.toOfflineDeclaration(apiDeclaration("d1", "allergy", "Pénicilline"))], now: NOW - 3 * DAY });
  const second = policy.mergeSnapshot(first, { accountId: "a1", activeProfileId: "c1", profiles, declarations: [], now: NOW });
  assert.deepEqual(Object.keys(second.declarations).sort(), ["c1", "p1"], "le profil lu avant reste disponible hors connexion");
  assert.equal(second.declarations.p1.savedAt, iso(-3 * DAY), "la date de chaque profil reste celle de sa propre lecture");
  assert.equal(second.activeProfileId, "c1");
  const otherAccount = policy.mergeSnapshot(second, { accountId: "a2", activeProfileId: "p1", profiles: [profiles[0]], declarations: [], now: NOW });
  assert.deepEqual(Object.keys(otherAccount.declarations), ["p1"], "rien du compte précédent ne doit survivre");
  const childRemoved = policy.mergeSnapshot(second, { accountId: "a1", activeProfileId: "p1", profiles: [profiles[0]], declarations: [], now: NOW });
  assert.deepEqual(Object.keys(childRemoved.declarations), ["p1"], "un profil retiré disparaît");
  const staleDropped = policy.mergeSnapshot(first, { accountId: "a1", activeProfileId: "c1", profiles, declarations: [], now: NOW + 6 * DAY });
  assert.deepEqual(Object.keys(staleDropped.declarations), ["c1"], "la copie du profil p1 a dépassé 7 jours");
  assert.equal(policy.mergeSnapshot(null, { accountId: "a1", activeProfileId: "inconnu", profiles, declarations: [], now: NOW }), null);
  assert.equal(policy.mergeSnapshot(null, { accountId: "", activeProfileId: "p1", profiles, declarations: [], now: NOW }), null);
});

test("pruneSnapshot : 7 jours maximum, par profil, et rien de lisible = rien du tout", () => {
  const base = policy.mergeSnapshot(null, { accountId: "a1", activeProfileId: "p1", profiles, declarations: [], now: NOW - 5 * DAY });
  const mixed = policy.mergeSnapshot(base, { accountId: "a1", activeProfileId: "c1", profiles, declarations: [], now: NOW - 1 * DAY });
  assert.deepEqual(Object.keys(policy.pruneSnapshot(mixed, NOW).declarations).sort(), ["c1", "p1"]);
  assert.deepEqual(Object.keys(policy.pruneSnapshot(mixed, NOW + 3 * DAY).declarations), ["c1"]);
  assert.equal(policy.pruneSnapshot(mixed, NOW + 9 * DAY), null);
  assert.equal(policy.pruneSnapshot(null, NOW), null);
  assert.equal(policy.pruneSnapshot({ ...mixed, version: 2 }, NOW), null);
});

/* ---------- carte d'urgence (IndexedDB) ---------- */
test("carte d'urgence : une copie périmée est SUPPRIMÉE à la lecture, pas seulement ignorée", async () => {
  const idb = browser();
  const lib = cardLib();
  idb.seed("ecarnet-public-emergency-v1", "cards", "token", [{ token: "t-vieux", data: { contact_phone: "0102030405" }, cachedAt: iso(-25 * HOUR) }]);
  assert.equal(await lib.readCachedEmergencyCard("t-vieux", NOW), null);
  assert.equal(idb.rows("ecarnet-public-emergency-v1", "cards").length, 0, "la donnée de santé ne doit plus être sur l'appareil");
});

test("carte d'urgence : copie récente lisible, purge des seules copies périmées, oubli explicite", async () => {
  const idb = browser();
  const lib = cardLib();
  idb.seed("ecarnet-public-emergency-v1", "cards", "token", [
    { token: "t-frais", data: { n: 1 }, cachedAt: iso(-2 * HOUR) },
    { token: "t-vieux-1", data: { n: 2 }, cachedAt: iso(-30 * HOUR) },
    { token: "t-vieux-2", data: { n: 3 }, cachedAt: iso(-3 * DAY) },
    { token: "t-sans-date", data: { n: 4 } },
  ]);
  assert.deepEqual((await lib.readCachedEmergencyCard("t-frais", NOW)).data, { n: 1 });
  await lib.purgeExpiredEmergencyCards(NOW);
  assert.deepEqual(idb.rows("ecarnet-public-emergency-v1", "cards").map((row) => row.token), ["t-frais"], "périmées et sans date : supprimées");
  await lib.forgetEmergencyCard("t-frais");
  assert.equal(idb.rows("ecarnet-public-emergency-v1", "cards").length, 0);
  await lib.cacheEmergencyCard("t-neuf", { n: 5 });
  assert.equal(idb.rows("ecarnet-public-emergency-v1", "cards")[0].token, "t-neuf");
});

test("carte d'urgence : un QR désactivé (404) ne montre jamais la copie, même en ligne ; seul un défaut de réseau le permet", () => {
  const component = read("src/components/PublicEmergencyCard.tsx");
  assert.match(component, /emergencyCardFallback\(error\)/);
  assert.match(component, /fallback === "forget"\) await forgetEmergencyCard\(token\)/);
  assert.match(component, /fallback === "use-cache" \? await readCachedEmergencyCard/);
  assert.doesNotMatch(component, /\.catch\(async \(\) =>/, "plus de repli sur la copie quelle que soit l'erreur");
  assert.match(component, /purgeExpiredEmergencyCards\(\)/);
  assert.match(component, /keepEmergencyPageForOffline\(\)/);
});

/* ---------- copie des déclarations (IndexedDB) ---------- */
test("copie des déclarations : active par défaut, la couper l'efface aussitôt, la rallumer ne rend rien", async () => {
  browser();
  const lib = snapshotLib();
  assert.equal(await lib.isOfflineSnapshotEnabled(), true);
  await lib.saveOfflineSnapshot({ accountId: "a1", activeProfileId: "p1", profiles, declarations: [], now: NOW });
  assert.ok(await lib.readOfflineSnapshot(NOW));
  await lib.setOfflineSnapshotEnabled(false);
  assert.equal(await lib.isOfflineSnapshotEnabled(), false);
  assert.equal(await lib.readOfflineSnapshot(NOW), null, "couper la copie l'efface");
  await lib.setOfflineSnapshotEnabled(true);
  assert.equal(await lib.isOfflineSnapshotEnabled(), true);
  assert.equal(await lib.readOfflineSnapshot(NOW), null);
});

test("copie des déclarations : écritures successives fusionnées, autre compte remplacé, profil inconnu refusé", async () => {
  const idb = browser();
  const lib = snapshotLib();
  const item = policy.toOfflineDeclaration(apiDeclaration("d1", "allergy", "Pénicilline"));
  await lib.saveOfflineSnapshot({ accountId: "a1", activeProfileId: "p1", profiles, declarations: [item], now: NOW - DAY });
  await lib.saveOfflineSnapshot({ accountId: "a1", activeProfileId: "c1", profiles, declarations: [], now: NOW });
  const merged = await lib.readOfflineSnapshot(NOW);
  assert.deepEqual(Object.keys(merged.declarations).sort(), ["c1", "p1"]);
  assert.deepEqual(merged.declarations.p1.items, [item]);
  assert.equal(await lib.saveOfflineSnapshot({ accountId: "a1", activeProfileId: "inconnu", profiles, declarations: [], now: NOW }), true, "la transaction aboutit");
  assert.deepEqual(Object.keys((await lib.readOfflineSnapshot(NOW)).declarations).sort(), ["c1", "p1"], "mais rien n'est enregistré pour un profil inconnu");
  await lib.saveOfflineSnapshot({ accountId: "a2", activeProfileId: "p1", profiles: [profiles[0]], declarations: [], now: NOW });
  const replaced = await lib.readOfflineSnapshot(NOW);
  assert.equal(replaced.accountId, "a2");
  assert.deepEqual(Object.keys(replaced.declarations), ["p1"]);
  assert.equal(idb.rows("ecarnet-offline-v1", "snapshots").filter((row) => row.key === "current").length, 1, "un seul enregistrement");
});

test("copie des déclarations : purge à la demande, et purge des copies de plus de 7 jours au démarrage (le réglage est conservé)", async () => {
  const idb = browser();
  const lib = snapshotLib();
  await lib.setOfflineSnapshotEnabled(true);
  const old = policy.mergeSnapshot(null, { accountId: "a1", activeProfileId: "p1", profiles, declarations: [], now: NOW - 9 * DAY });
  idb.seed("ecarnet-offline-v1", "snapshots", "key", [old]);
  assert.equal(idb.rows("ecarnet-offline-v1", "snapshots").some((row) => row.key === "current"), true);
  await lib.purgeExpiredOfflineData(NOW);
  assert.equal(idb.rows("ecarnet-offline-v1", "snapshots").some((row) => row.key === "current"), false, "la copie périmée est supprimée, pas seulement masquée");
  assert.equal(idb.rows("ecarnet-offline-v1", "snapshots").some((row) => row.key === "prefs"), true);
  await lib.saveOfflineSnapshot({ accountId: "a1", activeProfileId: "p1", profiles, declarations: [], now: NOW });
  await lib.purgeOfflineSnapshot();
  assert.equal(await lib.readOfflineSnapshot(NOW), null);
  assert.equal(await lib.isOfflineSnapshotEnabled(), true, "effacer la copie ne change pas le réglage");
});

/* ---------- synchronisation ---------- */
function syncEnv({ online = true, representations, sequence, declarations, enabled = true }) {
  browser({ online });
  const snapshots = snapshotLib();
  const calls = [];
  const queue = sequence ? [...sequence] : null;
  const api = {
    apiGet: async (path) => {
      calls.push(path);
      if (path.endsWith("/representations/")) { const value = queue ? queue.shift() ?? queue.at(-1) ?? [] : representations; if (value instanceof Error) throw value; return value; }
      if (path.endsWith("/declarations/")) { if (declarations instanceof Error) throw declarations; return declarations; }
      throw new Error(`appel inattendu ${path}`);
    },
  };
  const sync = loadTs("src/lib/offline-sync.ts", { "../infrastructure/api/client": api, "./offline-snapshot": snapshots, "./offline-policy": policy });
  return { sync, snapshots, calls, enable: () => snapshots.setOfflineSnapshotEnabled(enabled) };
}
const account = { id: "a1", first_name: "Aka", last_name: "Elvis", patient_profile: { id: "p1" } };
const child = (extra = {}) => ({ patient_id: "c1", first_name: "Awa", last_name: "Elvis", status: "active", is_active: false, ...extra });

test("synchro : profil propre actif → profils (moi + enfants actifs) et déclarations minimisées", async () => {
  const env = syncEnv({ representations: [child(), child({ patient_id: "c2", status: "revoked" })], declarations: [apiDeclaration("d1", "blood_group", "O+"), { id: "mauvais" }] });
  await env.sync.syncOfflineSnapshot(account);
  const saved = await env.snapshots.readOfflineSnapshot();
  assert.equal(saved.activeProfileId, "p1");
  assert.deepEqual(saved.profiles.map((profile) => `${profile.id}:${profile.kind}`), ["p1:self", "c1:child"], "le profil révoqué n'est pas proposé");
  assert.deepEqual(saved.declarations.p1.items, [{ id: "d1", kind: "blood_group", label: "O+", details: "", provenance: "Déclaré par le patient" }]);
  assert.equal(JSON.stringify(saved).includes("created_at"), false, "aucun champ inutile n'est conservé");
});

test("synchro : profil enfant actif → déclarations rangées sous le bon profil", async () => {
  const env = syncEnv({ representations: [child({ is_active: true })], declarations: [apiDeclaration("d9", "allergy", "Arachide")] });
  await env.sync.syncOfflineSnapshot(account);
  const saved = await env.snapshots.readOfflineSnapshot();
  assert.equal(saved.activeProfileId, "c1");
  assert.deepEqual(Object.keys(saved.declarations), ["c1"]);
  assert.deepEqual(saved.profiles.map((profile) => profile.id), ["p1", "c1"]);
});

test("synchro : si le profil actif change pendant la lecture, rien n'est enregistré (jamais les déclarations d'un profil sous le nom d'un autre)", async () => {
  const env = syncEnv({ sequence: [[child()], [child({ is_active: true })]], declarations: [apiDeclaration("d1", "allergy", "Pénicilline")] });
  // Appels : 1) profils (avant), 2) déclarations, 3) profils (après). Le profil actif passe de « moi » à « c1 » pendant la lecture.
  await env.sync.syncOfflineSnapshot(account);
  assert.equal(await env.snapshots.readOfflineSnapshot(), null);
  assert.equal(env.calls.length, 3);
});

test("synchro : erreur d'API (session absente, accès délégué) → la copie précédente reste telle quelle", async () => {
  const env = syncEnv({ representations: [child()], declarations: Object.assign(new Error("refusé"), { status: 403 }) });
  await env.snapshots.saveOfflineSnapshot({ accountId: "a1", activeProfileId: "p1", profiles, declarations: [policy.toOfflineDeclaration(apiDeclaration("d0", "city", "Abidjan"))] });
  await env.sync.syncOfflineSnapshot(account);
  const saved = await env.snapshots.readOfflineSnapshot();
  assert.equal(saved.declarations.p1.items[0].label, "Abidjan");
});

test("synchro : aucune requête hors connexion, copie désactivée ou profil patient absent", async () => {
  const offline = syncEnv({ online: false, representations: [], declarations: [] });
  await offline.sync.syncOfflineSnapshot(account);
  assert.equal(offline.calls.length, 0);
  const disabled = syncEnv({ representations: [], declarations: [], enabled: false });
  await disabled.enable();
  await disabled.sync.syncOfflineSnapshot(account);
  assert.equal(disabled.calls.length, 0);
  const noProfile = syncEnv({ representations: [], declarations: [] });
  await noProfile.sync.syncOfflineSnapshot({ ...account, patient_profile: { id: null } });
  assert.equal(noProfile.calls.length, 0);
});

/* ---------- déconnexion ---------- */
function logoutEnv({ unsubscribe, purge }) {
  browser();
  const calls = [];
  const lib = loadTs("src/lib/logout.ts", {
    "./offline-snapshot": { purgeOfflineSnapshot: async () => { calls.push("purge"); return purge?.(); } },
    "./offline-cache": { purgeOfflineCache: async () => { calls.push("purge-cache"); } },
    "./push": { unsubscribeFromPush: async () => { calls.push("push"); return unsubscribe?.(); } },
  });
  return { lib, calls };
}

test("déconnexion : désabonne le push et efface la copie locale", async () => {
  const env = logoutEnv({});
  await env.lib.cleanUpBeforeLogout();
  assert.deepEqual(env.calls.sort(), ["purge", "purge-cache", "push"]);
});

test("déconnexion : une erreur ou un blocage du désabonnement ne bloque jamais la déconnexion ni l'effacement", async () => {
  const failing = logoutEnv({ unsubscribe: () => { throw new Error("push indisponible"); } });
  await failing.lib.cleanUpBeforeLogout();
  assert.deepEqual(failing.calls.sort(), ["purge", "purge-cache", "push"]);
  const hanging = logoutEnv({ unsubscribe: () => new Promise(() => {}) });
  const started = Date.now();
  await hanging.lib.cleanUpBeforeLogout(); // le plafond de 5 s est ramené à 20 ms par le faux window.setTimeout
  assert.ok(Date.now() - started < 2000);
  assert.ok(hanging.calls.includes("purge"));
  assert.ok(hanging.calls.includes("purge-cache"));
});

test("déconnexion : partout, le nettoyage passe AVANT l'appel d'API (le désabonnement a besoin de la session)", () => {
  const files = ["src/components/shell/SpaceShell.tsx", "src/components/AccountSettingsClient.tsx", "src/components/ProfessionalSettingsClient.tsx", "src/components/EstablishmentSettingsClient.tsx", "src/app/admin/page.tsx"];
  for (const file of files) {
    const source = read(file);
    const cleanup = source.indexOf("await cleanUpBeforeLogout()");
    const api = source.indexOf("identity/logout/");
    assert.ok(cleanup > 0 && api > 0 && cleanup < api, `${file} : cleanUpBeforeLogout doit précéder identity/logout`);
  }
  const push = read("src/lib/push.ts");
  assert.match(push, /export async function unsubscribeFromPush[\s\S]*"serviceWorker" in navigator/);
  assert.match(read("src/lib/logout.ts"), /unsubscribeFromPush[\s\S]*purgeOfflineSnapshot/);
});

test("espaces : la copie hors connexion est entretenue partout, effacée quand le serveur dit « session absente », et sans réseau l'identité vient de la copie (05/11/2026)", () => {
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(shell, /state\.status === "ready" && !bare && <OfflineCacheKeeper space=\{space\} \/>/);
  assert.doesNotMatch(shell, /OfflineSnapshotSync/, "l'ancienne synchro en clair des déclarations n'est plus montée");
  assert.match(shell, /isSessionMissing\(error\)\) \{\s*void purgeOfflineSnapshot\(\);[^\n]*\s*void purgeOfflineCache\(\)/);
  assert.match(shell, /navigator\.onLine !== false && probeFailures < 2/, "hors connexion la sonde est sautée : l'identité est lue par le relais fetch (copie chiffrée)");
  assert.match(shell, /OFFLINE_NO_COPY_MESSAGE/);
  const keeper = read("src/components/OfflineCacheKeeper.tsx");
  for (const needle of ["purgeOfflineSnapshot", "trimOfflineCache", "NETWORK_RESTORED_EVENT", "warmOfflineShells"]) assert.ok(keeper.includes(needle), needle);
  assert.doesNotMatch(read("src/lib/offline-sync.ts"), /apiPost|apiSend|apiPatch|apiPut|apiDelete|representations\/active/, "la synchro ne change jamais le profil actif et n'écrit rien côté serveur");
});

test("réglages : une rubrique « Hors connexion » avec activation, désactivation (efface) et effacement", () => {
  const settings = read("src/components/AccountSettingsClient.tsx");
  assert.match(settings, /id: "hors-connexion", title: "Hors connexion"/);
  assert.match(settings, /activeSection === "hors-connexion"[\s\S]*<OfflineDataToggle \/>/);
  const toggle = read("src/components/OfflineDataToggle.tsx");
  assert.match(toggle, /setOfflineSnapshotEnabled\(next\)/);
  assert.match(toggle, /Effacer de cet appareil/);
  assert.match(toggle, /appareil partagé/);
});

/* ---------- page hors connexion (lecture seule) ---------- */
test("page hors connexion : mêmes constantes que l'application", () => {
  assert.deepEqual(reader.constants, { DB_NAME: policy.OFFLINE_DB_NAME, STORE_NAME: policy.OFFLINE_STORE_NAME, SNAPSHOT_KEY: policy.SNAPSHOT_KEY, MAX_AGE_MS: policy.SNAPSHOT_MAX_AGE_MS });
});

test("page hors connexion : même expiration que l'application sur le même enregistrement", () => {
  const base = policy.mergeSnapshot(null, { accountId: "a1", activeProfileId: "p1", profiles, declarations: [], now: NOW - 5 * DAY });
  const mixed = policy.mergeSnapshot(base, { accountId: "a1", activeProfileId: "c1", profiles, declarations: [], now: NOW - DAY });
  for (const offset of [0, 3 * DAY, 9 * DAY]) assert.deepEqual(reader.pruneSnapshot(mixed, NOW + offset), policy.pruneSnapshot(mixed, NOW + offset), `+${offset / DAY} j`);
  for (const value of [undefined, null, {}, { ...mixed, version: 2 }]) assert.equal(reader.pruneSnapshot(value, NOW), null);
});

function sampleSnapshot() {
  const mine = [
    { id: "1", kind: "treatment", label: "Metformine", details: "2 fois par jour", provenance: "Déclaré par le patient" },
    { id: "2", kind: "allergy", label: "Pénicilline", details: "", provenance: "Déclaré par le patient" },
    { id: "3", kind: "blood_group", label: "O+", details: "", provenance: "Déclaré par le patient" },
    { id: "4", kind: "height", label: "172", details: "", provenance: "Déclaré par le patient" },
    { id: "5", kind: "weight", label: "68", details: "", provenance: "Déclaré par le patient" },
    { id: "6", kind: "inconnu_du_futur", label: "Autre info", details: "", provenance: "Déclaré par le patient" },
  ];
  const first = policy.mergeSnapshot(null, { accountId: "a1", activeProfileId: "p1", profiles, declarations: mine, now: NOW - HOUR });
  return policy.mergeSnapshot(first, { accountId: "a1", activeProfileId: "p1", profiles, declarations: mine, now: NOW - HOUR });
}

test("page hors connexion : déclarations regroupées comme dans le carnet, avec unités et provenance", () => {
  const html = reader.renderPanel(sampleSnapshot(), "p1", "carnet");
  const order = ["Groupe sanguin", "Allergies", "Traitements", "Taille", "Poids", "Autres"].map((title) => html.indexOf(`<h3>${title}</h3>`));
  assert.ok(order.every((position) => position > 0), "tous les groupes présents");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "ordre des groupes du carnet");
  assert.match(html, /<strong>172 cm<\/strong>/);
  assert.match(html, /<strong>68 kg<\/strong>/);
  assert.match(html, /2 fois par jour/);
  assert.match(html, /Déclaré par le patient/);
  assert.match(html, /Déclarations de Aka Elvis/);
});

test("page hors connexion : tout texte venu de l'utilisateur est échappé (pas d'injection)", () => {
  const evil = policy.mergeSnapshot(null, {
    accountId: "a1", activeProfileId: "p1",
    profiles: [{ id: "p1", kind: "self", first_name: "<script>alert(1)</script>", last_name: "\"onmouseover=\"x" }],
    declarations: [{ id: "1", kind: "allergy", label: "<img src=x onerror=alert(1)>", details: "</li><b>gras</b>", provenance: "<i>faux</i>" }],
    now: NOW,
  });
  for (const tab of ["home", "carnet"]) {
    const html = reader.renderPanel(evil, "p1", tab) + reader.renderProfiles(evil, "p1");
    assert.doesNotMatch(html, /<script|<img|<b>|<i>|<\/li><b/, `${tab} : balise injectée`);
    assert.doesNotMatch(html, /"onmouseover=/, `${tab} : attribut injecté`);
  }
  assert.match(reader.renderPanel(evil, "p1", "carnet"), /&lt;img src=x onerror=alert\(1\)&gt;/, "le texte reste lisible, sous forme de texte");
  assert.equal(reader.escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});

test("page hors connexion : changer de profil enfant, onglets qui demandent le réseau, profil jamais ouvert en ligne", () => {
  const snapshot = policy.mergeSnapshot(sampleSnapshot(), { accountId: "a1", activeProfileId: "p1", profiles, declarations: [policy.toOfflineDeclaration(apiDeclaration("x", "allergy", "Pénicilline"))], now: NOW });
  const chips = reader.renderProfiles(snapshot, "c1");
  assert.match(chips, /data-profile="p1" aria-pressed="false">Aka Elvis \(moi\)/);
  assert.match(chips, /data-profile="c1" aria-pressed="true">Awa Elvis/);
  assert.equal(reader.renderProfiles({ profiles: [profiles[0]] }, "p1"), "", "un seul profil : pas de sélecteur");
  assert.match(reader.renderPanel(snapshot, "c1", "carnet"), /pas encore été ouvert avec la connexion/, "enfant jamais ouvert en ligne");
  for (const tab of ["consultations", "historique"]) {
    const html = reader.renderPanel(snapshot, "p1", tab);
    assert.match(html, /a besoin de la connexion/);
    assert.doesNotMatch(html, /Pénicilline|<h3>/, `${tab} : aucune donnée de santé`);
  }
  assert.equal(reader.defaultProfileId(snapshot), "p1");
  assert.match(reader.renderTabs("carnet"), /id="tab-carnet"[^>]*aria-selected="true"/);
  assert.equal([...reader.renderTabs("carnet").matchAll(/role="tab"/g)].length, 4);
});

function fakePage(idb) {
  const elements = {};
  const make = (id) => ({ id, innerHTML: "", textContent: "", hidden: false, attributes: {}, listeners: {}, setAttribute(key, value) { this.attributes[key] = value; }, getAttribute(key) { return this.attributes[key] ?? null; }, addEventListener(type, fn) { this.listeners[type] = fn; }, focus() { this.focused = true; } });
  const get = (id) => (elements[id] ??= make(id));
  get("offline-app").hidden = true;
  const win = { indexedDB: idb, document: { getElementById: get, querySelectorAll: () => [] }, addEventListener() {}, location: { reload() { win.reloaded = true; } } };
  return { win, get };
}
const wait = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
const click = (page, attribute, value) => page.get("offline-app").listeners.click({ target: { getAttribute: (name) => (name === attribute ? value : null), parentNode: null } });

test("page hors connexion : avec une copie, l'app s'affiche (carnet d'abord), on change de profil et d'onglet sans réseau", async () => {
  const idb = createFakeIndexedDB();
  idb.seed("ecarnet-offline-v1", "snapshots", "key", [policy.mergeSnapshot(sampleSnapshot(), { accountId: "a1", activeProfileId: "c1", profiles, declarations: [policy.toOfflineDeclaration(apiDeclaration("e", "allergy", "Arachide"))], now: NOW - HOUR })]);
  const page = createPage(idb);
  function createPage(database) { return fakePage(database); }
  reader.start(page.win);
  await wait();
  assert.equal(page.get("offline-app").hidden, false);
  assert.equal(page.get("plain").hidden, true);
  assert.match(page.get("panel").innerHTML, /Déclarations de Awa Elvis/, "le profil actif en ligne est proposé d'abord");
  assert.match(page.get("panel").innerHTML, /Arachide/);
  assert.match(page.get("fresh").textContent, /Copie enregistrée le .*peut ne pas refléter/);
  click(page, "data-profile", "p1");
  assert.match(page.get("panel").innerHTML, /Déclarations de Aka Elvis/);
  assert.match(page.get("panel").innerHTML, /Metformine/);
  assert.match(page.get("profiles").innerHTML, /data-profile="p1" aria-pressed="true"/);
  click(page, "data-tab", "historique");
  assert.match(page.get("panel").innerHTML, /a besoin de la connexion/);
  assert.equal(page.get("panel").attributes["aria-labelledby"], "tab-historique");
  click(page, "data-tab", "home");
  click(page, "data-go", "carnet");
  assert.match(page.get("panel").innerHTML, /Metformine/);
  assert.equal(page.get("panel").focused, true, "le focus suit le bouton « Voir les déclarations »");
});

test("page hors connexion : sans copie (ou copie périmée), seule l'explication s'affiche", async () => {
  const empty = fakePage(createFakeIndexedDB());
  reader.start(empty.win);
  await wait();
  assert.equal(empty.get("offline-app").hidden, true);
  assert.equal(empty.get("plain").hidden, false);
  const idb = createFakeIndexedDB();
  idb.seed("ecarnet-offline-v1", "snapshots", "key", [policy.mergeSnapshot(null, { accountId: "a1", activeProfileId: "p1", profiles, declarations: [], now: Date.now() - 9 * DAY })]);
  const stale = fakePage(idb);
  reader.start(stale.win);
  await wait();
  assert.equal(stale.get("offline-app").hidden, true, "une copie de plus de 7 jours n'est jamais montrée");
});

test("page hors connexion : « Effacer de cet appareil » supprime la copie et revient à l'explication", async () => {
  const idb = createFakeIndexedDB();
  idb.seed("ecarnet-offline-v1", "snapshots", "key", [sampleSnapshot(), { key: "prefs", declarationsEnabled: true }]);
  const page = fakePage(idb);
  reader.start(page.win);
  await wait();
  click(page, "data-erase", "1");
  await wait();
  assert.equal(idb.rows("ecarnet-offline-v1", "snapshots").some((row) => row.key === "current"), false);
  assert.equal(idb.rows("ecarnet-offline-v1", "snapshots").some((row) => row.key === "prefs"), true, "le réglage n'est pas touché");
  assert.equal(page.get("offline-app").hidden, true);
  assert.equal(page.get("plain").hidden, false);
});

test("page hors connexion : lecture seule — aucune écriture, aucun réseau ; la seule suppression est « Effacer »", () => {
  const source = read("public/hors-connexion.js");
  assert.doesNotMatch(source, /\.put\(|\.add\(|\bfetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|WebSocket/);
  assert.equal([...source.matchAll(/\.delete\(/g)].length, 1);
  const html = read("public/hors-connexion.html");
  assert.match(html, /Vous êtes hors connexion/);
  assert.match(html, /<script src="\/hors-connexion\.js"><\/script>/);
  assert.match(html, /\[hidden\] \{ display: none !important; \}/, "l'attribut hidden doit l'emporter sur display:grid");
  assert.match(html, /role="tablist"/);
});

/* ---------- textes d'information ---------- */
test("textes d'information : la politique, l'aide et la page d'accueil décrivent la copie hors connexion (plus « aucune donnée médicale »)", () => {
  const privacy = read("src/app/confidentialite/page.tsx");
  assert.match(privacy, /Copie hors connexion chiffrée \(IndexedDB\)/);
  assert.match(privacy, /chiffrés \(AES‑GCM 256\)/);
  assert.match(privacy, /après 7 jours sans visite en ligne \(24 heures pour les informations de patients/);
  assert.match(privacy, /appareil partagé, désactivez-la/);
  assert.match(privacy, /Carte d’urgence ouverte par QR \(IndexedDB\)[\s\S]*24 heures[\s\S]*dès que le QR est désactivé ou renouvelé/);
  assert.match(privacy, /service worker garde[\s\S]*sans donnée personnelle[\s\S]*Il ne garde jamais les réponses de l’API/);
  assert.match(privacy, /abonnement aux notifications est retiré/);
  const help = read("src/components/help/helpContent.ts");
  const landing = read("src/lib/landing-content.ts");
  for (const source of [help, landing]) assert.doesNotMatch(source, /aucune donnée médicale n’est conservée|Aucune donnée médicale ni réponse/i);
  assert.match(help, /les écrans déjà ouverts en ligne, en lecture seule/);
  assert.match(help, /effacée à la déconnexion et après 7 jours \(24 heures pour les informations de patients/);
  assert.match(help, /bandeau en haut de l’écran/);
  assert.match(landing, /relire en lecture seule ce que vous avez déjà consulté/);
});

test("documentation : le journal des modifications et la doc PWA reflètent le comportement réel", () => {
  const pwa = read("../../docs/PWA-HORS-CONNEXION.md");
  assert.match(pwa, /7 jours/);
  assert.match(pwa, /lecture seule/);
  assert.match(pwa, /jamais le profil actif/);
  assert.doesNotMatch(read("../../docs/SECURITY.md"), /\*\*Carte imprimable hors ligne/, "la carte imprimable n'existe plus : elle ne doit plus être décrite comme une fonction");
  assert.match(read("../../docs/SECURITY.md"), /Copies locales hors connexion/);
  assert.match(read("../../docs/CHANGELOG.md"), /^## 2026-11-02 — Hors connexion/m);
});

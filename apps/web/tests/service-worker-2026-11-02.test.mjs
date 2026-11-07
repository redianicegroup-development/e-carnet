// Service worker exécuté tel quel dans un bac à sable (faux caches, faux réseau) : ce qui est gardé, ce qui ne l'est jamais,
// et ce que voit l'utilisateur sans réseau.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const ORIGIN = "https://ecarnet.test";
const swSource = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const offlineHtml = readFileSync(new URL("../public/hors-connexion.html", import.meta.url), "utf8");
const PRECACHED = ["/", "/aide", "/a-propos", "/securite", "/credits", "/cgu", "/confidentialite", "/mentions-legales", "/conditions-rattachement", "/proches-et-enfants", "/manifest.webmanifest", "/hors-connexion.html", "/hors-connexion.js", "/brand/app-icon.svg"];

function createEnv() {
  const listeners = {};
  const store = new Map(); // nom du cache -> Map(url -> Response)
  const state = { online: true, fetched: [] };
  const urlOf = (request) => new URL(typeof request === "string" ? request : request.url, ORIGIN).href;

  async function fakeFetch(request) {
    const url = urlOf(request);
    state.fetched.push(url);
    if (!state.online) throw new TypeError("Failed to fetch");
    const path = new URL(url).pathname;
    if (path === "/hors-connexion.html") return new Response(offlineHtml, { status: 200 });
    if (path.startsWith("/_next/static/")) return new Response(`/* ${path} */`, { status: 200, headers: { "content-type": "text/javascript" } });
    if (path === "/urgence/revoque") return new Response("QR désactivé", { status: 404 });
    if (path.startsWith("/urgence/")) return new Response("<html>coquille d'urgence</html>", { status: 200 });
    if (path === "/patient/parametres") return new Response('<html><script src="/_next/static/chunks/app-111.js"></script><script>self.__next_f.push(["I",["static/chunks/app/patient/parametres/page-222.js","static/css/c.css"]])</script></html>', { status: 200 });
    if (path.startsWith("/patient")) return new Response("<html>espace patient</html>", { status: 200 });
    if (path.startsWith("/introuvable")) return new Response("non", { status: 404 });
    return new Response(`<html>${path}</html>`, { status: 200 });
  }

  const makeCache = (name) => {
    if (!store.has(name)) store.set(name, new Map());
    const rows = store.get(name);
    return {
      async put(request, response) { rows.set(urlOf(request), response); },
      async add(url) { const response = await fakeFetch(url); if (!response.ok) throw new Error(`add ${url}`); rows.set(urlOf(url), response); },
      async match(request) { const found = rows.get(urlOf(request)); return found ? found.clone() : undefined; },
      async keys() { return [...rows.keys()].map((url) => ({ url })); },
      async delete(request) { return rows.delete(urlOf(request)); },
      async addAll(urls) { for (const url of urls) { const response = await fakeFetch(url); if (!response.ok) throw new Error(`addAll ${url}`); rows.set(urlOf(url), response); } },
    };
  };
  const caches = {
    async open(name) { return makeCache(name); },
    async match(request) { for (const rows of store.values()) { const found = rows.get(urlOf(request)); if (found) return found.clone(); } return undefined; },
    async keys() { return [...store.keys()]; },
    async delete(name) { return store.delete(name); },
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, listener) => { listeners[type] = listener; },
    skipWaiting() {},
    clients: { claim() {}, matchAll: async () => [], openWindow: async () => undefined },
    registration: { showNotification: async () => undefined },
  };
  vm.runInContext(swSource, vm.createContext({ self, caches, fetch: fakeFetch, Response, Request, URL, console }), { filename: "sw.js" });

  async function lifecycle(type) {
    const waits = [];
    listeners[type]({ waitUntil: (promise) => waits.push(promise) });
    await Promise.all(waits);
  }
  async function request(url, { mode = "navigate", method = "GET", destination = "" } = {}) {
    const waits = [];
    let handled = false;
    let responded;
    listeners.fetch({ request: { url: new URL(url, ORIGIN).href, mode, method, destination }, respondWith: (promise) => { handled = true; responded = promise; }, waitUntil: (promise) => waits.push(promise) });
    if (!handled) return { handled: false };
    let response;
    let error;
    try { response = await responded; } catch (caught) { error = caught; }
    await Promise.all(waits);
    return { handled: true, response, error, text: response ? await response.clone().text() : undefined };
  }
  async function message(data) {
    const waits = [];
    listeners.message({ data, waitUntil: (promise) => waits.push(promise) });
    await Promise.all(waits);
  }
  const cached = (name) => [...(store.get(name)?.keys() ?? [])].map((url) => new URL(url).pathname);
  return { state, store, lifecycle, request, message, cached };
}

test("installation : pages publiques, page hors connexion et son script sont précachés ; les anciens caches sont supprimés à l'activation", async () => {
  const env = createEnv();
  env.store.set("ecarnet-public-v4", new Map([[`${ORIGIN}/vieux`, new Response("x")]]));
  await env.lifecycle("install");
  assert.deepEqual(env.cached("ecarnet-public-v6").sort(), [...PRECACHED].sort());
  await env.lifecycle("activate");
  assert.equal(env.store.has("ecarnet-public-v4"), false, "l'ancien cache doit disparaître");
  assert.equal(env.store.has("ecarnet-public-v6"), true);
});

test("pages privées : la coquille (HTML sans donnée) est gardée par adresse ; sans réseau elle est rejouée, sinon la page hors connexion (tous les espaces)", async () => {
  const env = createEnv();
  await env.lifecycle("install");
  for (const path of ["/patient/carnet", "/professionnel/patients", "/etablissement/dossiers"]) {
    const online = await env.request(path);
    assert.equal(online.response.status, 200, path);
  }
  assert.deepEqual(env.cached("ecarnet-shells-v1").sort(), ["/etablissement/dossiers", "/patient/carnet", "/professionnel/patients"]);
  assert.equal(env.cached("ecarnet-public-v6").some((path) => /^\/(patient|professionnel|etablissement)/.test(path)), false, "une coquille privée ne va pas dans le cache des pages publiques");
  env.state.online = false;
  assert.equal((await env.request("/patient/carnet")).text, "<html>espace patient</html>", "coquille déjà ouverte : rejouée sans réseau");
  assert.equal((await env.request("/patient/carnet?onglet=vaccins")).text, "<html>espace patient</html>", "la requête (query) ne change pas la coquille");
  for (const path of ["/patient", "/patient/historique", "/connexion"]) {
    const offline = await env.request(path);
    assert.equal(offline.text, offlineHtml, `${path} : jamais ouverte, page hors connexion attendue`);
  }
});

test("coquilles : seule une réponse 200 est gardée (un 404 n'est jamais rejoué sans réseau)", async () => {
  const env = createEnv();
  await env.lifecycle("install");
  const missing = await env.request("/introuvable");
  assert.equal(missing.response.status, 404);
  await env.request("/patient/inconnue-404");
  env.state.online = false;
  assert.equal(env.cached("ecarnet-shells-v1").includes("/introuvable"), false);
});

test("pages publiques non précachées : copie gardée à chaque visite, rejouée sans réseau", async () => {
  const env = createEnv();
  await env.lifecycle("install");
  await env.request("/faq");
  assert.ok(env.cached("ecarnet-public-v6").includes("/faq"));
  env.state.online = false;
  assert.equal((await env.request("/faq")).text, "<html>/faq</html>");
});

test("préchauffage : coquilles des écrans et leurs fichiers /_next/static/ ; seules des adresses connues du site sont acceptées", async () => {
  const env = createEnv();
  await env.lifecycle("install");
  await env.message({ type: "WARM_SHELLS", paths: ["/patient/parametres", "/professionnel", "/cgu", "/api/v1/patient/declarations/", "//pirate.test/patient", "/inconnue", "https://pirate.test/patient", "/patient/../api/secret", "/patient/Parametres", 42, null] });
  assert.deepEqual(env.cached("ecarnet-shells-v1").sort(), ["/patient/parametres", "/professionnel"]);
  assert.deepEqual(env.cached("ecarnet-assets-v1").sort(), ["/_next/static/chunks/app-111.js", "/_next/static/chunks/app/patient/parametres/page-222.js", "/_next/static/css/c.css"]);
  assert.equal(env.state.fetched.some((url) => /pirate|api\/v1|secret|inconnue|Parametres/.test(url)), false, "aucune adresse hors liste ne doit être demandée");
  env.state.online = false;
  const page = await env.request("/patient/parametres");
  assert.match(page.text, /app-111\.js/, "la coquille préchauffée s'ouvre sans réseau");
  const script = await env.request("/_next/static/chunks/app/patient/parametres/page-222.js", { mode: "no-cors" });
  assert.equal(script.text, "/* /_next/static/chunks/app/patient/parametres/page-222.js */", "le fichier référencé par la coquille est servi depuis le cache");
  const before = env.state.fetched.length;
  await env.message({ type: "WARM_SHELLS", paths: "pas une liste" });
  assert.equal(env.state.fetched.length, before);
});

test("images, polices et scripts du site : copie gardée et rejouée sans réseau ; jamais l'API ni un autre site", async () => {
  const env = createEnv();
  await env.lifecycle("install");
  await env.request("/brand/logo.webp", { mode: "no-cors", destination: "image" });
  assert.ok(env.cached("ecarnet-assets-v1").includes("/brand/logo.webp"));
  env.state.online = false;
  assert.equal((await env.request("/brand/logo.webp", { mode: "no-cors", destination: "image" })).response.status, 200);
  const unknown = await env.request("/brand/jamais-vue.webp", { mode: "no-cors", destination: "image" });
  assert.equal(unknown.response.type, "error", "image jamais vue : erreur réseau normale");
  assert.equal((await env.request("/api/v1/patient/declarations/", { mode: "cors", destination: "image" })).handled, false);
  assert.equal((await env.request("https://autre-site.test/logo.webp", { mode: "no-cors", destination: "image" })).handled, false);
});

test("API : jamais interceptée ni gardée, quelle que soit la méthode", async () => {
  const env = createEnv();
  await env.lifecycle("install");
  assert.equal((await env.request("/api/v1/patient/declarations/", { mode: "cors" })).handled, false);
  assert.equal((await env.request("/api/v1/patient/declarations/", { mode: "cors", method: "POST" })).handled, false);
  assert.equal((await env.request("https://autre-site.test/script.js", { mode: "no-cors" })).handled, false);
  assert.equal(env.cached("ecarnet-assets-v1").length + env.cached("ecarnet-public-v6").filter((path) => path.startsWith("/api")).length, 0);
});

test("carte d'urgence : la coquille se recharge sans réseau, avec ses fichiers /_next/static/", async () => {
  const env = createEnv();
  await env.lifecycle("install");
  await env.request("/urgence/jeton-1");
  assert.ok(env.cached("ecarnet-public-v6").includes("/urgence/jeton-1"));
  await env.request("/_next/static/chunks/app.js", { mode: "no-cors" });
  env.state.online = false;
  const page = await env.request("/urgence/jeton-1");
  assert.equal(page.text, "<html>coquille d'urgence</html>");
  const script = await env.request("/_next/static/chunks/app.js", { mode: "no-cors" });
  assert.equal(script.text, "/* /_next/static/chunks/app.js */", "le script de la page doit être servi depuis le cache");
  const unknown = await env.request("/urgence/jamais-ouverte");
  assert.equal(unknown.response.status, 503, "une carte jamais ouverte n'est pas disponible sans réseau");
});

test("fichier statique jamais vu, sans réseau : erreur réseau normale, jamais du HTML à la place d'un script", async () => {
  const env = createEnv();
  await env.lifecycle("install");
  env.state.online = false;
  const asset = await env.request("/_next/static/chunks/inconnu.js", { mode: "no-cors" });
  assert.equal(asset.response, undefined);
  assert.ok(asset.error, "la requête doit échouer");
  const other = await env.request("/images/inconnue.png", { mode: "no-cors" });
  assert.equal(other.error, undefined);
  assert.equal(other.response.type, "error", "pas de repli sur l'accueil pour autre chose qu'une page");
  const page = await env.request("/aide");
  assert.equal(page.text, "<html>/aide</html>", "une page publique précachée reste disponible");
});

test("message de la page /urgence : seules des adresses du site sont acceptées et gardées", async () => {
  const env = createEnv();
  await env.lifecycle("install");
  await env.message({ type: "CACHE_EMERGENCY_PAGE", url: "/urgence/jeton-2", assets: ["/_next/static/a.js", "/_next/static/media/f.woff2?dpl=1", "//pirate.test/_next/static/x.js", "/_next/static/../../api/secret", "/api/v1/patient/declarations/", "https://pirate.test/_next/static/y.js", 42] });
  assert.ok(env.cached("ecarnet-public-v6").includes("/urgence/jeton-2"));
  assert.deepEqual(env.cached("ecarnet-assets-v1").sort(), ["/_next/static/a.js", "/_next/static/media/f.woff2"].sort());
  assert.equal(env.state.fetched.some((url) => /pirate|api\/v1|secret/.test(url)), false, "aucune adresse hors du site ne doit être demandée");
  for (const url of ["/patient", "/patient/carnet", "/urgence/", "/urgence/a/b", "https://pirate.test/urgence/x", 7, undefined]) {
    const before = env.state.fetched.length;
    await env.message({ type: "CACHE_EMERGENCY_PAGE", url, assets: ["/_next/static/z.js"] });
    assert.equal(env.state.fetched.length, before, `${String(url)} : rien ne doit être demandé`);
  }
  await env.message({ type: "AUTRE", url: "/urgence/jeton-3", assets: [] });
  assert.equal(env.cached("ecarnet-public-v6").includes("/urgence/jeton-3"), false);
});

test("les coquilles de carte d'urgence sont plafonnées (les plus anciennes disparaissent)", async () => {
  const env = createEnv();
  await env.lifecycle("install");
  for (let i = 0; i < 25; i += 1) await env.request(`/urgence/jeton-${i}`);
  const kept = env.cached("ecarnet-public-v6").filter((path) => path.startsWith("/urgence/"));
  assert.equal(kept.length, 20);
  assert.equal(kept.includes("/urgence/jeton-0"), false);
  assert.equal(kept.includes("/urgence/jeton-24"), true);
  assert.equal(env.cached("ecarnet-public-v6").includes("/hors-connexion.html"), true, "le plafond ne touche pas aux pages précachées");
});

test("un QR désactivé (404) n'est pas gardé : sans réseau, la coquille d'une carte révoquée n'existe pas", async () => {
  const env = createEnv();
  await env.lifecycle("install");
  const online = await env.request("/urgence/revoque");
  assert.equal(online.response.status, 404, "la réponse du serveur est transmise telle quelle");
  assert.equal(env.cached("ecarnet-public-v6").includes("/urgence/revoque"), false);
  env.state.online = false;
  assert.equal((await env.request("/urgence/revoque")).response.status, 503);
});

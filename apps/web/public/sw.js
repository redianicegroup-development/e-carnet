const CACHE_NAME = "ecarnet-public-v5";
const ASSET_CACHE = "ecarnet-assets-v1";
const SHELL_CACHE = "ecarnet-shells-v1";
const OFFLINE_URL = "/hors-connexion.html";
const OFFLINE_SCRIPT = "/hors-connexion.js";
const PUBLIC_PAGES = ["/", "/aide", "/a-propos", "/securite", "/credits", "/cgu", "/confidentialite", "/mentions-legales", "/conditions-rattachement", "/proches-et-enfants"];
const PUBLIC_ASSETS = [...PUBLIC_PAGES, "/manifest.webmanifest", OFFLINE_URL, OFFLINE_SCRIPT, "/brand/app-icon.svg"];
/* Pages privées (05/11/2026) : leur HTML est une coquille SANS donnée personnelle (les pages sont des composants navigateur ; les données viennent de
   l'API, jamais du HTML). On en garde donc la coquille pour que l'application s'ouvre sans réseau. Les RÉPONSES d'API ne sont jamais gardées ici :
   la copie des lectures est faite par l'application, chiffrée (IndexedDB, voir docs/PWA-HORS-CONNEXION.md). Sans coquille connue, /hors-connexion.html. */
const PRIVATE_PAGES = ["/patient", "/professionnel", "/etablissement", "/onboarding", "/connexion", "/inscription"];
const MAX_ASSET_ENTRIES = 400;
const MAX_SHELLS = 80;
const MAX_WARM_PATHS = 60;
const MAX_WARM_ASSETS = 160;
const MAX_EMERGENCY_PAGES = 20;

self.addEventListener("install", (event) => {
  /* Une page publique indisponible à l'installation ne doit pas empêcher d'installer les autres. */
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => Promise.all(PUBLIC_ASSETS.map((url) => cache.add(url).catch(() => undefined)))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== ASSET_CACHE && key !== SHELL_CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

const isPrivatePath = (path) => PRIVATE_PAGES.some((prefix) => path.startsWith(prefix));
const textResponse = (message, status) => new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/* Garde les `max` entrées les plus récentes (l'ordre de `keys()` est l'ordre d'insertion). */
async function trimCache(cache, max, accept) {
  const keys = (await cache.keys()).filter((request) => !accept || accept(new URL(request.url).pathname));
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((request) => cache.delete(request)));
}
const isEmergencyPath = (path) => path.startsWith("/urgence/");

/* Carte d'urgence : la coquille de la page (HTML sans donnée de santé) est gardée pour pouvoir se recharger sans réseau ; la carte elle-même
   est lue par l'application depuis l'API, puis depuis sa copie de 24 h (IndexedDB). */
async function emergencyPage(event, request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(cache.put(request, copy).then(() => trimCache(cache, MAX_EMERGENCY_PAGES, isEmergencyPath)).catch(() => undefined));
    }
    return response;
  } catch {
    return (await cache.match(request, { ignoreVary: true })) || textResponse("Carte d’urgence non disponible hors connexion.", 503);
  }
}

/* Fichiers /_next/static/ : noms à empreinte, donc immuables et sans donnée personnelle. Sans eux, la page de la carte d'urgence se recharge
   sans son script hors connexion et la copie locale ne peut jamais s'afficher. */
async function staticAsset(event, request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.status === 200) {
    const copy = response.clone();
    event.waitUntil(cache.put(request, copy).then(() => trimCache(cache, MAX_ASSET_ENTRIES)).catch(() => undefined));
  }
  return response;
}

/* Message de la page /urgence/<jeton> : elle liste les fichiers qu'elle vient de charger (la toute première visite n'est pas encore
   interceptée par le service worker). Seuls des chemins du site sont acceptés. */
async function cacheEmergencyPage(pageUrl, assets) {
  if (typeof pageUrl !== "string" || !/^\/urgence\/[^/?#\s]+$/.test(pageUrl)) return;
  const pages = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(pageUrl);
    if (!response.ok) return;
    await pages.put(pageUrl, response);
  } catch { return; }
  await trimCache(pages, MAX_EMERGENCY_PAGES, isEmergencyPath);
  const files = await caches.open(ASSET_CACHE);
  const wanted = (Array.isArray(assets) ? assets : []).filter((asset) => typeof asset === "string" && asset.startsWith("/_next/static/") && !asset.includes("..")).slice(0, 120);
  for (const asset of wanted) {
    if (await files.match(asset)) continue;
    try {
      const response = await fetch(asset);
      if (response.ok && response.status === 200) await files.put(asset, response);
    } catch { /* fichier indisponible : la page se rechargera avec ce qui a pu être gardé */ }
  }
  await trimCache(files, MAX_ASSET_ENTRIES);
}

/* Coquille d'une page privée : réseau d'abord ; sans réseau, la dernière coquille connue de CETTE adresse, sinon la page hors connexion. */
const shellKey = (url) => new Request(`${url.origin}${url.pathname}`);
async function privateShell(event, request) {
  const url = new URL(request.url);
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200 && !response.redirected) {
      const copy = response.clone();
      event.waitUntil(cache.put(shellKey(url), copy).then(() => trimCache(cache, MAX_SHELLS)).catch(() => undefined));
    }
    return response;
  } catch {
    return (await cache.match(shellKey(url), { ignoreVary: true })) || (await caches.match(OFFLINE_URL)) || textResponse("Vous êtes hors connexion.", 503);
  }
}

/* Page publique : réseau d'abord, copie gardée à chaque succès (aucune donnée personnelle), puis l'accueil en dernier recours. */
async function publicPage(event, request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200 && !response.redirected) {
      const copy = response.clone();
      event.waitUntil(cache.put(request, copy).catch(() => undefined));
    }
    return response;
  } catch {
    return (await cache.match(request, { ignoreVary: true, ignoreSearch: true })) || (await caches.match("/")) || Response.error();
  }
}

/* Images, polices, feuilles de style et scripts du site (hors /_next/static/, déjà traités) : réseau d'abord, copie gardée, repli sur la copie. */
const RUNTIME_DESTINATIONS = ["image", "font", "style", "script"];
async function runtimeAsset(event, request) {
  const cache = await caches.open(ASSET_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200) {
      const copy = response.clone();
      event.waitUntil(cache.put(request, copy).then(() => trimCache(cache, MAX_ASSET_ENTRIES)).catch(() => undefined));
    }
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

/* Préchauffage (message WARM_SHELLS de l'application, en ligne) : garde la coquille des écrans listés et les fichiers /_next/static/ qu'elle
   référence. Seules des adresses du site, connues (pages privées ou pages publiques), sont acceptées. */
const WARM_PATH = /^\/[a-z0-9\-_/]*$/;
const isWarmable = (path) => typeof path === "string" && path.length < 120 && WARM_PATH.test(path) && !path.includes("//") && (PUBLIC_PAGES.includes(path) || isPrivatePath(path));
const ASSET_PATTERN = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[A-Za-z0-9_\-/.[\]%~@]+?\.(?:js|css|woff2|woff)/g;
function assetUrlsIn(html) {
  const found = new Set();
  for (const match of html.matchAll(ASSET_PATTERN)) {
    const asset = match[0].startsWith("/_next/") ? match[0] : `/_next/${match[0]}`;
    if (!asset.includes("..")) found.add(asset);
  }
  return [...found];
}
async function warmShells(paths) {
  const wanted = [...new Set(Array.isArray(paths) ? paths.filter(isWarmable) : [])].slice(0, MAX_WARM_PATHS);
  if (wanted.length === 0) return;
  const shells = await caches.open(SHELL_CACHE);
  const pages = await caches.open(CACHE_NAME);
  const files = await caches.open(ASSET_CACHE);
  const assets = new Set();
  for (const path of wanted) {
    try {
      const response = await fetch(path, { credentials: "same-origin", cache: "no-store", headers: { Accept: "text/html" } });
      if (!response.ok || response.status !== 200 || response.redirected) continue;
      const html = await response.clone().text();
      const target = isPrivatePath(path) ? shells : pages;
      await target.put(isPrivatePath(path) ? shellKey(new URL(path, self.location.origin)) : new Request(new URL(path, self.location.origin)), response);
      assetUrlsIn(html).forEach((asset) => assets.add(asset));
    } catch { /* page indisponible : elle sera gardée à sa prochaine visite */ }
  }
  await trimCache(shells, MAX_SHELLS);
  let fetched = 0;
  for (const asset of assets) {
    if (fetched >= MAX_WARM_ASSETS) break;
    if (await files.match(asset)) continue;
    try {
      const response = await fetch(asset);
      if (response.ok && response.status === 200) { await files.put(asset, response); fetched += 1; }
    } catch { /* fichier indisponible : gardé à sa première utilisation */ }
  }
  await trimCache(files, MAX_ASSET_ENTRIES);
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "CACHE_EMERGENCY_PAGE") event.waitUntil(cacheEmergencyPage(data.url, data.assets));
  if (data.type === "WARM_SHELLS") event.waitUntil(warmShells(data.paths));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (request.mode === "navigate" && isEmergencyPath(path)) {
    event.respondWith(emergencyPage(event, request));
    return;
  }
  if (request.mode === "navigate" && isPrivatePath(path)) {
    event.respondWith(privateShell(event, request));
    return;
  }
  if (request.method !== "GET" || path.startsWith("/api/")) return;
  if (path.startsWith("/_next/static/")) {
    event.respondWith(staticAsset(event, request));
    return;
  }
  if (isPrivatePath(path)) return;
  /* Le repli sur l'accueil n'a de sens que pour une page : renvoyer du HTML à la place d'un script ou d'une feuille de style casserait la page. */
  if (request.mode === "navigate") {
    event.respondWith(publicPage(event, request));
    return;
  }
  if (RUNTIME_DESTINATIONS.includes(request.destination) || path === "/_next/image") {
    event.respondWith(runtimeAsset(event, request));
    return;
  }
  event.respondWith(fetch(request).catch(async () => (await caches.match(request)) || Response.error()));
});

/* ---------- Web Push ----------
   Le texte affiché vient du serveur et reste neutre (aucun nom de médicament sur l’écran verrouillé).
   Le détail est dans l’application, derrière la connexion. */
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const data = payload.data || {};
  const url = typeof payload.url === "string" && payload.url.startsWith("/") && !payload.url.startsWith("//") ? payload.url : "/patient";
  event.waitUntil(self.registration.showNotification(payload.title || "Mon E‑Carnet", {
    body: payload.body || "Vous avez une nouvelle notification.",
    icon: "/favicon.ico",
    // Un tag par notification : deux rappels à la même heure restent deux notifications (un tag par « kind » les écraserait).
    tag: data.notification_id || `ecarnet-${Date.now()}`,
    data: { url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/patient";
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && "focus" in client) {
        try { await client.focus(); if ("navigate" in client) await client.navigate(url); return; } catch { /* repli : nouvelle fenêtre */ }
      }
    }
    await self.clients.openWindow(url);
  })());
});

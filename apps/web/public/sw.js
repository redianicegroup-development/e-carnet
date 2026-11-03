const CACHE_NAME = "ecarnet-public-v4";
const ASSET_CACHE = "ecarnet-assets-v1";
const OFFLINE_URL = "/hors-connexion.html";
const OFFLINE_SCRIPT = "/hors-connexion.js";
const PUBLIC_ASSETS = ["/", "/aide", "/a-propos", "/securite", "/manifest.webmanifest", OFFLINE_URL, OFFLINE_SCRIPT, "/brand/app-icon.svg"];
/* Pages privées : leur HTML n'est jamais mis en cache et aucune réponse d'API non plus. Hors connexion, on affiche la page /hors-connexion.html,
   qui lit la copie locale des déclarations (IndexedDB, lecture seule, gérée par l'application : voir docs/PWA-HORS-CONNEXION.md). */
const PRIVATE_PAGES = ["/patient", "/professionnel", "/etablissement", "/onboarding", "/connexion", "/inscription"];
const MAX_ASSET_ENTRIES = 160;
const MAX_EMERGENCY_PAGES = 20;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== ASSET_CACHE).map((key) => caches.delete(key)))));
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

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "CACHE_EMERGENCY_PAGE") event.waitUntil(cacheEmergencyPage(data.url, data.assets));
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
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || textResponse("Vous êtes hors connexion.", 503)));
    return;
  }
  if (request.method !== "GET" || path.startsWith("/api/")) return;
  if (path.startsWith("/_next/static/")) {
    event.respondWith(staticAsset(event, request));
    return;
  }
  if (isPrivatePath(path)) return;
  /* Le repli sur l'accueil n'a de sens que pour une page : renvoyer du HTML à la place d'un script ou d'une feuille de style casserait la page. */
  event.respondWith(fetch(request).catch(async () => (await caches.match(request)) || (request.mode === "navigate" ? await caches.match("/") : undefined) || Response.error()));
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

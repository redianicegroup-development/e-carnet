const CACHE_NAME = "ecarnet-public-v2";
const PUBLIC_ASSETS = ["/", "/aide", "/a-propos", "/securite", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/patient") || url.pathname.startsWith("/professionnel") || url.pathname.startsWith("/onboarding") || url.pathname.startsWith("/connexion") || url.pathname.startsWith("/inscription")) return;
  event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match("/"))));
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

/* Page « Hors connexion » : lecture seule des déclarations enregistrées sur cet appareil.
   Charge sans framework (le service worker la sert pour toute page privée quand le réseau manque).
   Lit la base IndexedDB « ecarnet-offline-v1 » écrite par l'application (src/lib/offline-snapshot.ts) ; n'écrit jamais, sauf pour
   « Effacer de cet appareil ». Les constantes ci-dessous sont celles de src/lib/offline-policy.ts (un test vérifie qu'elles concordent).
   Syntaxe volontairement ancienne (pas d'async/await ni d'optional chaining) : elle doit tourner sur les vieux navigateurs mobiles. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) { module.exports = api; } else { api.start(root); }
})(typeof self !== "undefined" ? self : this, function () {
  var DB_NAME = "ecarnet-offline-v1";
  var STORE_NAME = "snapshots";
  var SNAPSHOT_KEY = "current";
  var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  var CLOCK_SKEW_MS = 5 * 60 * 1000;

  var TABS = [
    { id: "home", label: "Accueil" },
    { id: "carnet", label: "Mon carnet" },
    { id: "consultations", label: "Consultations" },
    { id: "historique", label: "Historique" }
  ];
  /* Même vocabulaire que le carnet (PatientCarnet.tsx), regroupé par type. */
  var GROUPS = [
    { kind: "blood_group", title: "Groupe sanguin" },
    { kind: "allergy", title: "Allergies" },
    { kind: "antecedent", title: "Antécédents" },
    { kind: "treatment", title: "Traitements" },
    { kind: "emergency_contact", title: "Contact d’urgence" },
    { kind: "height", title: "Taille", suffix: " cm" },
    { kind: "weight", title: "Poids", suffix: " kg" },
    { kind: "city", title: "Ville" }
  ];

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function isExpired(value, now) {
    var time = typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : NaN;
    if (!isFinite(time)) return true;
    var age = now - time;
    return age > MAX_AGE_MS || age < -CLOCK_SKEW_MS;
  }

  /* Reprend pruneSnapshot de offline-policy.ts : tout ce qui a plus de 7 jours est ignoré. */
  function pruneSnapshot(snapshot, now) {
    if (!snapshot || snapshot.key !== SNAPSHOT_KEY || snapshot.version !== 1 || !Array.isArray(snapshot.profiles)) return null;
    if (isExpired(snapshot.savedAt, now)) return null;
    var declarations = {};
    var found = false;
    Object.keys(snapshot.declarations || {}).forEach(function (id) {
      var entry = snapshot.declarations[id];
      if (entry && Array.isArray(entry.items) && !isExpired(entry.savedAt, now)) { declarations[id] = entry; found = true; }
    });
    if (!found) return null;
    return { key: snapshot.key, version: 1, accountId: snapshot.accountId, savedAt: snapshot.savedAt, activeProfileId: snapshot.activeProfileId, profiles: snapshot.profiles, declarations: declarations };
  }

  function profileName(profile) {
    var name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
    return name || "Profil";
  }

  function formatDate(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return "";
    try { return date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return date.toISOString(); }
  }

  function findProfile(snapshot, id) {
    for (var i = 0; i < snapshot.profiles.length; i += 1) if (snapshot.profiles[i].id === id) return snapshot.profiles[i];
    return null;
  }

  /* Profil proposé d'abord : celui qui était actif en ligne, s'il est lisible, sinon le premier qui l'est. */
  function defaultProfileId(snapshot) {
    if (snapshot.declarations[snapshot.activeProfileId] && findProfile(snapshot, snapshot.activeProfileId)) return snapshot.activeProfileId;
    for (var i = 0; i < snapshot.profiles.length; i += 1) if (snapshot.declarations[snapshot.profiles[i].id]) return snapshot.profiles[i].id;
    return snapshot.profiles.length ? snapshot.profiles[0].id : "";
  }

  function groupDeclarations(items) {
    var known = {};
    var groups = GROUPS.map(function (group) { known[group.kind] = true; return { kind: group.kind, title: group.title, suffix: group.suffix || "", items: [] }; });
    var others = { kind: "other", title: "Autres", suffix: "", items: [] };
    items.forEach(function (item) {
      var target = null;
      for (var i = 0; i < groups.length; i += 1) if (groups[i].kind === item.kind) target = groups[i];
      (target || others).items.push(item);
    });
    groups.push(others);
    return groups.filter(function (group) { return group.items.length > 0; });
  }

  function renderProfiles(snapshot, selectedId) {
    if (snapshot.profiles.length < 2) return "";
    return snapshot.profiles.map(function (profile) {
      var pressed = profile.id === selectedId;
      var label = profileName(profile) + (profile.kind === "self" ? " (moi)" : "");
      return '<button type="button" class="chip" data-profile="' + escapeHtml(profile.id) + '" aria-pressed="' + (pressed ? "true" : "false") + '">' + escapeHtml(label) + "</button>";
    }).join("");
  }

  function renderTabs(selectedTab) {
    return TABS.map(function (tab) {
      var selected = tab.id === selectedTab;
      return '<button type="button" role="tab" class="tab" id="tab-' + tab.id + '" data-tab="' + tab.id + '" aria-selected="' + (selected ? "true" : "false") + '" aria-controls="panel" tabindex="' + (selected ? "0" : "-1") + '">' + escapeHtml(tab.label) + "</button>";
    }).join("");
  }

  function renderNeedsNetwork(tabLabel) {
    return "<h2>" + escapeHtml(tabLabel) + "</h2>" +
      "<p>Cette rubrique a besoin de la connexion : vos consultations, votre historique, vos documents et votre agenda ne sont pas conservés sur cet appareil.</p>" +
      '<p class="muted">Elle reviendra dès que le réseau sera disponible.</p>';
  }

  function renderCarnet(snapshot, profileId) {
    var profile = findProfile(snapshot, profileId);
    var entry = snapshot.declarations[profileId];
    if (!profile) return "<p>Profil introuvable sur cet appareil.</p>";
    if (!entry) {
      return "<h2>" + escapeHtml(profileName(profile)) + "</h2>" +
        "<p>Ce profil n’a pas encore été ouvert avec la connexion sur cet appareil. Ouvrez-le une fois en ligne pour le consulter ici.</p>";
    }
    var html = "<h2>Déclarations de " + escapeHtml(profileName(profile)) + "</h2>";
    if (entry.items.length === 0) return html + "<p>Aucune déclaration enregistrée pour ce profil.</p>";
    groupDeclarations(entry.items).forEach(function (group) {
      html += '<section class="group"><h3>' + escapeHtml(group.title) + "</h3><ul>";
      group.items.forEach(function (item) {
        html += "<li><strong>" + escapeHtml(item.label) + escapeHtml(group.suffix) + "</strong>" +
          (item.details ? '<span class="details">' + escapeHtml(item.details) + "</span>" : "") +
          '<span class="badge">' + escapeHtml(item.provenance || "Déclaré par le patient") + "</span></li>";
      });
      html += "</ul></section>";
    });
    return html;
  }

  function renderHome(snapshot, profileId) {
    var profile = findProfile(snapshot, profileId);
    var entry = snapshot.declarations[profileId];
    if (!profile) return "<p>Profil introuvable sur cet appareil.</p>";
    var count = entry ? entry.items.length : 0;
    var title = profile.kind === "self" ? "Bonjour" + (profile.first_name ? " " + escapeHtml(profile.first_name) : "") : "Dossier de " + escapeHtml(profileName(profile));
    return "<h2>" + title + "</h2>" +
      (entry
        ? "<p>" + count + (count > 1 ? " déclarations sont enregistrées" : " déclaration est enregistrée") + " sur cet appareil, en lecture seule.</p>" +
          '<p><button type="button" class="primary" data-go="carnet">Voir les déclarations</button></p>'
        : "<p>Ce profil n’a pas encore été ouvert avec la connexion sur cet appareil.</p>") +
      '<p class="muted">Pour modifier une déclaration, ajouter un document ou consulter l’historique, reconnectez-vous au réseau.</p>';
  }

  function renderPanel(snapshot, profileId, tabId) {
    if (tabId === "carnet") return renderCarnet(snapshot, profileId);
    if (tabId === "home") return renderHome(snapshot, profileId);
    var label = "";
    TABS.forEach(function (tab) { if (tab.id === tabId) label = tab.label; });
    return renderNeedsNetwork(label || "Rubrique");
  }

  /* ---------- lecture / effacement de la base ---------- */
  function readSnapshot(win, done) {
    var factory = win.indexedDB;
    if (!factory) { done(null); return; }
    var request;
    try { request = factory.open(DB_NAME, 1); } catch (e) { done(null); return; }
    request.onupgradeneeded = function () {
      /* La base n'existait pas : rien n'a jamais été enregistré. On la laisse vide, mais correcte pour l'application. */
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onerror = function () { done(null); };
    request.onblocked = function () { done(null); };
    request.onsuccess = function () {
      var db = request.result;
      try {
        var get = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(SNAPSHOT_KEY);
        get.onsuccess = function () { db.close(); done(pruneSnapshot(get.result, Date.now())); };
        get.onerror = function () { db.close(); done(null); };
      } catch (e) { db.close(); done(null); }
    };
  }

  function eraseSnapshot(win, done) {
    var request;
    try { request = win.indexedDB.open(DB_NAME, 1); } catch (e) { done(); return; }
    request.onerror = function () { done(); };
    request.onsuccess = function () {
      var db = request.result;
      try {
        var transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).delete(SNAPSHOT_KEY);
        transaction.oncomplete = function () { db.close(); done(); };
        transaction.onerror = function () { db.close(); done(); };
        transaction.onabort = function () { db.close(); done(); };
      } catch (e) { db.close(); done(); }
    };
  }

  /* ---------- page ---------- */
  function start(win) {
    var doc = win.document;
    if (!doc || !doc.getElementById) return;
    var plain = doc.getElementById("plain");
    var app = doc.getElementById("offline-app");
    function reload() { win.location.reload(); }
    var retryButtons = doc.querySelectorAll("[data-retry]");
    for (var i = 0; i < retryButtons.length; i += 1) retryButtons[i].addEventListener("click", reload);
    win.addEventListener("online", reload);

    readSnapshot(win, function (snapshot) {
      if (!snapshot || !app || !plain) return;
      var profileId = defaultProfileId(snapshot);
      var tabId = "carnet";
      var elements = { profiles: doc.getElementById("profiles"), tabs: doc.getElementById("tabs"), panel: doc.getElementById("panel"), fresh: doc.getElementById("fresh") };

      function paint(focusPanel) {
        elements.profiles.innerHTML = renderProfiles(snapshot, profileId);
        elements.tabs.innerHTML = renderTabs(tabId);
        elements.panel.innerHTML = renderPanel(snapshot, profileId, tabId);
        elements.panel.setAttribute("aria-labelledby", "tab-" + tabId);
        var entry = snapshot.declarations[profileId];
        elements.fresh.textContent = entry ? "Copie enregistrée le " + formatDate(entry.savedAt) + ". Elle peut ne pas refléter vos dernières modifications." : "";
        if (focusPanel) elements.panel.focus();
      }

      app.addEventListener("click", function (event) {
        var node = event.target;
        while (node && node !== app && !(node.getAttribute && (node.getAttribute("data-profile") || node.getAttribute("data-tab") || node.getAttribute("data-go") || node.getAttribute("data-erase")))) node = node.parentNode;
        if (!node || node === app) return;
        if (node.getAttribute("data-profile")) { profileId = node.getAttribute("data-profile"); paint(false); }
        else if (node.getAttribute("data-tab")) { tabId = node.getAttribute("data-tab"); paint(false); doc.getElementById("tab-" + tabId).focus(); }
        else if (node.getAttribute("data-go")) { tabId = node.getAttribute("data-go"); paint(true); }
        else if (node.getAttribute("data-erase")) {
          eraseSnapshot(win, function () { app.hidden = true; plain.hidden = false; });
        }
      });
      /* Flèches gauche/droite entre onglets, comme un vrai tablist. */
      elements.tabs.addEventListener("keydown", function (event) {
        var key = event.key;
        if (key !== "ArrowRight" && key !== "ArrowLeft") return;
        var index = 0;
        TABS.forEach(function (tab, position) { if (tab.id === tabId) index = position; });
        index = (index + (key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
        tabId = TABS[index].id;
        paint(false);
        doc.getElementById("tab-" + tabId).focus();
      });

      paint(false);
      plain.hidden = true;
      app.hidden = false;
    });
  }

  return {
    constants: { DB_NAME: DB_NAME, STORE_NAME: STORE_NAME, SNAPSHOT_KEY: SNAPSHOT_KEY, MAX_AGE_MS: MAX_AGE_MS },
    escapeHtml: escapeHtml,
    isExpired: isExpired,
    pruneSnapshot: pruneSnapshot,
    defaultProfileId: defaultProfileId,
    groupDeclarations: groupDeclarations,
    renderProfiles: renderProfiles,
    renderTabs: renderTabs,
    renderPanel: renderPanel,
    start: start
  };
});

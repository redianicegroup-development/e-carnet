// ACS-13 — accès d'urgence « bris de glace » (interface) + retrait des blocs barrés dans Langue et Partager l'application.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const bg = await import("../src/lib/break-glass.ts");
const history = await import("../src/components/access/access-history.ts");
const routes = await import("../src/lib/offline-routes.ts");

/* ------------------------------------------------------------------ retraits demandés */

test("langue : la note « Traduction automatique par Google Translate… » en bas de la fenêtre est retirée", () => {
  const tsx = read("src/components/app/LanguageSettings.tsx");
  const css = read("src/components/app/language.css");
  assert.doesNotMatch(tsx, /language-note/);
  assert.doesNotMatch(tsx, /Traduction automatique par Google Translate/);
  assert.doesNotMatch(tsx, /rien n.est envoyé/);
  assert.doesNotMatch(tsx, /Le choix est mémorisé sur cet appareil/);
  assert.doesNotMatch(css, /language-note/);
  // Ce qui n'était pas barré reste : le chapeau, les trois langues, et l'information avant la première traduction.
  assert.match(tsx, /LANGUE DE L.APPLICATION|Langue de l.application/i);
  assert.match(tsx, /Traduction automatique/); // la fenêtre de consentement avant d'envoyer du texte à Google
});

test("partage : plus de champ du lien, plus de « Partager sur » ni de boutons de réseaux ; « Partager… » et « Copier le lien » restent", () => {
  const tsx = read("src/components/app/ShareAppSettings.tsx");
  const css = read("src/components/app/app-settings.css");
  assert.doesNotMatch(tsx, /Lien d.installation/);
  assert.doesNotMatch(tsx, /<input/);
  assert.doesNotMatch(tsx, /Partager sur/);
  assert.doesNotMatch(tsx, /shareTargets|ShareTarget|share-app__targets|share-app__title/);
  for (const network of ["WhatsApp", "Facebook", "Telegram", "LinkedIn", "SMS", "E-mail", "wa.me", "twitter.com", "t.me", "facebook.com/sharer", "mailto:"]) {
    assert.ok(!tsx.includes(network), `« ${network} » devrait avoir disparu`);
  }
  assert.doesNotMatch(css, /share-app__targets|share-app__title/);
  assert.match(tsx, /Partager…/);
  assert.match(tsx, /Copier le lien/);
  assert.match(tsx, /Le lien ne contient aucune information sur vous ni sur votre carnet/);
  // Les messages d'erreur ne renvoient plus vers un champ qui n'existe plus.
  assert.doesNotMatch(tsx, /sélectionnez le lien|Copiez le lien ci-dessous/);
});

/* ------------------------------------------------------------------ logique pure */

test("compte à rebours : jamais négatif, formaté mm:ss", () => {
  const now = Date.parse("2026-11-12T10:00:00Z");
  assert.equal(bg.secondsLeft("2026-11-12T11:00:00Z", now), 3600);
  assert.equal(bg.secondsLeft("2026-11-12T10:00:00Z", now), 0);
  assert.equal(bg.secondsLeft("2026-11-12T09:00:00Z", now), 0);
  assert.equal(bg.secondsLeft("n'importe quoi", now), 0);
  assert.equal(bg.formatCountdown(3600), "60:00");
  assert.equal(bg.formatCountdown(65), "01:05");
  assert.equal(bg.formatCountdown(-4), "00:00");
});

test("motif : le texte libre est obligatoire (10 à 280 caractères) avant l'envoi", () => {
  assert.notEqual(bg.noteProblem(""), "");
  assert.notEqual(bg.noteProblem("   court  "), "");
  assert.equal(bg.noteProblem("Patient inconscient, famille injoignable."), "");
  assert.notEqual(bg.noteProblem("x".repeat(281)), "");
  assert.equal(bg.noteProblem("x".repeat(280)), "");
});

test("fonction désactivée côté serveur : reconnue pour ne rien afficher", () => {
  assert.equal(bg.isBreakGlassDisabled({ status: 404, details: { code: "break_glass_disabled" } }), true);
  assert.equal(bg.isBreakGlassDisabled({ status: 404, details: { code: "not_found" } }), false);
  assert.equal(bg.isBreakGlassDisabled({ status: 403, details: { code: "break_glass_disabled" } }), false);
  assert.equal(bg.isBreakGlassDisabled(new Error("x")), false);
  assert.equal(bg.isBreakGlassDisabled(null), false);
});

/* ------------------------------------------------------------------ historique du patient */

test("historique : l'accès d'urgence est dit sans détour, et sa revue aussi", () => {
  const base = { id: "e1", status: "active", extension_count: null, professional_name: "Dr X", facility_label: "Clinique", created_at: "2026-11-12T10:00:00Z", emergency_access_id: "a1" };
  const opened = history.describeEvent({ ...base, event_type: "break_glass.opened", action: "opened", reason_category: "unconscious", access_duration_minutes: 60 });
  assert.equal(opened.tone, "danger");
  assert.match(opened.title, /Accès d’urgence/);
  assert.match(opened.detail, /Sans votre accord préalable/);
  assert.match(opened.detail, /patient inconscient/);
  assert.match(opened.detail, /Votre carnet complet n’a pas été ouvert/);
  const unjustified = history.describeEvent({ ...base, event_type: "break_glass.reviewed", action: "reviewed", status: "unjustified" });
  assert.equal(unjustified.tone, "danger");
  assert.match(unjustified.title, /injustifié/);
  const justified = history.describeEvent({ ...base, event_type: "break_glass.reviewed", action: "reviewed", status: "justified" });
  assert.equal(justified.tone, "ok");
});

test("historique : un accès d'urgence forme sa propre session, séparée des accès par QR", () => {
  const events = [
    { id: "1", event_type: "break_glass.opened", action: "opened", status: "active", extension_count: null, professional_id: "p1", professional_name: "Dr X", facility_label: "Clinique", created_at: "2026-11-12T10:00:00Z", emergency_access_id: "a1" },
    { id: "2", event_type: "break_glass.reviewed", action: "reviewed", status: "justified", extension_count: null, professional_id: "p1", professional_name: "Dr X", facility_label: "Clinique", created_at: "2026-11-13T10:00:00Z", emergency_access_id: "a1" },
    { id: "3", event_type: "access_grant.accepted", action: "accept", method: "qr_scan", status: "active", extension_count: 0, access_grant_id: "g1", professional_id: "p1", professional_name: "Dr X", facility_label: "Clinique", created_at: "2026-11-14T10:00:00Z" },
  ];
  const [group] = history.groupByProfessional(events, []);
  assert.equal(group.sessions.length, 2);
  const emergency = group.sessions.find((session) => session.id === "a1");
  assert.equal(emergency.status, "emergency");
  assert.equal(emergency.lines.length, 2);
  assert.equal(history.STATUS_LABELS.emergency, "Accès d’urgence");
});

/* ------------------------------------------------------------------ interface */

test("professionnel : formulaire à motif obligatoire, aucune donnée gardée sur l'appareil, fiche effacée à la fin de l'heure", () => {
  const tsx = read("src/components/ProfessionalEmergencyAccess.tsx");
  assert.match(tsx, /\/professional\/emergency-access\//);
  assert.doesNotMatch(tsx, /localStorage|sessionStorage|indexedDB|caches\./);
  assert.match(tsx, /reason_category/);
  assert.match(tsx, /reason_note/);
  assert.match(tsx, /noteProblem/);
  assert.match(tsx, /confirmed/); // case de confirmation : le patient ne peut pas consentir
  assert.match(tsx, /left === 0/); // à zéro, la fiche disparaît de l'écran
  assert.match(tsx, /setOpened\(null\)/);
  assert.match(tsx, /ne se renouvelle pas/);
  assert.match(tsx, /isBreakGlassDisabled/);
});

test("établissement : la revue est une décision motivée ; un abus exige une explication", () => {
  const tsx = read("src/components/EstablishmentEmergencyReviews.tsx");
  assert.match(tsx, /emergency-access\/\$\{item\.id\}\/review\//);
  assert.match(tsx, /Non justifié : abus à signaler/);
  assert.match(tsx, /missingNote/);
  assert.match(tsx, /C’est votre propre accès/);
  assert.doesNotMatch(tsx, /localStorage|sessionStorage/);
});

test("pages et liens : non indexées ; liens visibles seulement si le serveur répond ; jamais mises en cache hors ligne", () => {
  for (const page of ["src/app/professionnel/urgence/page.tsx", "src/app/etablissement/urgences/page.tsx"]) {
    assert.ok(existsSync(new URL(page, root)), page);
    assert.match(read(page), /robots: \{ index: false, follow: false \}/);
  }
  const link = read("src/components/BreakGlassEntryLink.tsx");
  assert.match(link, /if \(!state\) return null/);
  assert.match(link, /catch \{/);
  // Un accès d'urgence se trace en ligne : ses pages ne font pas partie des routes préchargées hors connexion.
  const all = Object.values(routes.SPACE_ROUTES).flat();
  assert.ok(!all.some((route) => route.includes("urgence")));
});

test("notification d'accès d'urgence : renvoie vers l'historique des accès", () => {
  assert.match(read("src/components/notifications/NotificationBell.tsx"), /access\|share\|grant\|partag\|break_glass/);
});

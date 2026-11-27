// Console d'administration du 25/11/2026 : profil grid, huit onglets, utilisateurs, indicateurs, portail de surveillance séparé,
// suspension et suppression immédiates, récupération retirée, bannières sans lien ni texte.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const api = (rel) => readFileSync(new URL(`../api/apps/identity/${rel}`, root), "utf8");
const walk = (dir) => readdirSync(dir).flatMap((name) => { const path = join(dir, name); return statSync(path).isDirectory() ? walk(path) : [path]; });

test("la console tient en huit onglets : la barre du bas ne masque plus les pages", () => {
  const page = read("src/app/admin/page.tsx");
  const ids = [...page.matchAll(/\{ id: "([a-z-]+)", label: "[^"]+", short: "[^"]+", icon: "[a-z]+" \}/g)].map((m) => m[1]);
  assert.deepEqual(ids, ["overview", "users", "establishments", "billing", "banners", "audit", "feedback", "settings"]);
  assert.doesNotMatch(page, /AdminRecoveryClient|AdminOperationsClient|AdminAccountActionRequestsClient/);
  const css = read("src/app/globals.css");
  assert.match(css, /\.space--admin \.sb__list \{[^}]*flex-wrap: nowrap/, "une seule ligne d'onglets");
  assert.match(css, /\.space--admin \.admin-space-main \{[^}]*padding: 22px 16px calc\(112px \+ env\(safe-area-inset-bottom\)\)/, "le bas des pages n'est plus masqué");
  for (const old of ["activity", "survey", "account-requests", "recovery", "representation-transfers", "operations"]) assert.match(page, new RegExp(`"?${old}"?:`), `l'ancienne adresse #${old} mène quelque part`);
  assert.match(page, /view: "activity"/);
  assert.match(page, /setRetoursView/);
});

test("établissements et facturation : une liste de profils, la fiche s'ouvre au toucher", () => {
  const billing = read("src/components/AdminBillingClient.tsx");
  assert.match(billing, /<ProfileGrid label="Établissements et abonnements">/);
  assert.doesNotMatch(billing, /rows\.map\(\(row\) => <li/, "plus de liste de lignes serrées");
  assert.match(billing, /label: "Voir le détail"/);
  const users = read("src/components/AdminUsersClient.tsx");
  assert.match(users, /<ProfileGrid label="Utilisateurs">/);
});

test("Utilisateurs : recherche, filtres, fiche, désactivation et sessions avec confirmation, comptes de l'équipe protégés", () => {
  const users = read("src/components/AdminUsersClient.tsx");
  assert.match(users, /\/api\/v1\/identity\/admin\/users\//);
  for (const role of ["patient", "professional", "establishment", "laboratory", "staff"]) assert.match(users, new RegExp(`"${role}"`), role);
  assert.match(users, /type="search"/);
  assert.match(users, /Voir plus de comptes/);
  assert.match(users, /await confirm\(/);
  assert.match(users, /action: "deactivate" \| "reactivate"/);
  assert.match(users, /sessions\/revoke\//);
  assert.match(users, /user\.protected \? \[\]/, "aucune action sur un compte de l'équipe");
  assert.doesNotMatch(users, /avatar_data|password/i, "aucun secret ni contenu médical");
  assert.match(users, /Journal des connexions/);
  assert.match(users, /Suspensions et suppressions/);
  assert.match(users, /Transferts de dossiers/);
});

test("journaux : lecture seule, sans motif de suppression ni identité d'une suspension", () => {
  const journal = read("src/components/AdminAccountJournalClient.tsx");
  assert.doesNotMatch(journal, /apiPost|apiPatch|apiDelete|<select/, "l'équipe ne traite plus ces demandes");
  assert.match(journal, /reason_label/);
  assert.doesNotMatch(journal, /user_email|user_name|details/);
  const logins = read("src/components/AdminLoginJournal.tsx");
  assert.match(logins, /sans adresse IP ni appareil/);
  assert.doesNotMatch(logins, /ip_address|user_agent/);
});

test("Accueil : indicateurs de la plateforme, alertes, évolution sur 30 jours et activité récente sans contenu", () => {
  const overview = read("src/components/AdminOverviewPanel.tsx");
  assert.match(overview, /\/api\/v1\/identity\/admin\/overview\//);
  for (const label of ["Utilisateurs", "Actifs (30 jours)", "Établissements", "Abonnements actifs", "Transactions", "Revenus générés", "Activités récentes", "Nouveaux comptes", "Connexions réussies"]) assert.match(overview, new RegExp(label.replace(/[()]/g, "\\$&")), label);
  assert.match(overview, /aria-label="Alertes importantes"/);
  assert.match(overview, /onOpenTab\(alert\.tab\)/);
  assert.match(overview, /<code>\{event\.event_type\}<\/code>/, "un type inconnu s'affiche tel quel, jamais masqué");
  assert.match(read("src/app/admin/page.tsx"), /<AdminOverviewPanel onOpenTab=\{openTab\} \/>/);
});

test("suspension immédiate avec motif, suppression immédiate sans motif", () => {
  const form = read("src/components/AccountActionRequestsSettingsClient.tsx");
  assert.match(form, /Motif de suspension/);
  assert.match(form, /: \{ request_type: requestType \}/, "la suppression n'envoie aucun motif");
  assert.doesNotMatch(form, /Motif de la suppression|reason: reason, details/);
  assert.match(form, /accountSuspended=1/);
  assert.match(form, /await confirm\(/);
  const views = api("account_action_views.py");
  assert.doesNotMatch(views, /class AdminAccountActionRequestStatusView|class AdminDeleteRequestedAccountView/);
  assert.match(views, /Suspension IMMÉDIATE/);
});

test("portail de surveillance : une page à part, jamais liée depuis le site ni la console, sans compte Mon E-Carnet", () => {
  const page = read("src/app/surveillance/page.tsx");
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  const portal = read("src/components/OpsPortalClient.tsx");
  assert.match(portal, /ECARNET_OPS_PORTAL_ID/);
  assert.match(portal, /ECARNET_OPS_PORTAL_SECRET/);
  assert.match(portal, /autoComplete="off"/);
  assert.doesNotMatch(portal, /localStorage|sessionStorage|document\.cookie/, "le secret n'est jamais mémorisé par la page");
  const ops = read("src/infrastructure/api/ops.ts");
  assert.match(ops, /"X-Ops-Csrf"/);
  assert.match(ops, /credentials: "include"/);
  assert.doesNotMatch(ops, /localStorage|sessionStorage/);
  const operations = read("src/components/AdminOperationsClient.tsx");
  assert.match(operations, /opsGet/);
  assert.doesNotMatch(operations, /apiGet|apiPatch|admin\/operations/);
  const linkers = walk(new URL("src", root).pathname).filter((file) => /\.(tsx|ts)$/.test(file) && !/surveillance|OpsPortalClient|infrastructure\/api\/ops|AnonymousVisitorTracker/.test(file) && /["'`]\/surveillance/.test(readFileSync(file, "utf8")));
  assert.deepEqual(linkers, [], "aucun lien vers /surveillance : on connaît l'adresse, on ne la montre pas");
  assert.equal(existsSync(new URL("src/components/AdminRecoveryClient.tsx", root)), false);
  assert.match(read("src/components/AnonymousVisitorTracker.tsx"), /"\/surveillance"/, "pas de suivi de visite sur le portail");
});

test("routes : le portail et les nouveautés existent, la récupération d'administration a disparu", () => {
  const urls = api("urls.py");
  for (const route of ["ops/login/", "ops/logout/", "ops/session/", "ops/summary/", "ops/incidents/<uuid:incident_id>/", "admin/overview/", "admin/users/", "admin/users/<int:user_id>/status/", "admin/users/<int:user_id>/sessions/revoke/", "admin/login-events/"]) assert.ok(urls.includes(`"${route}"`), route);
  assert.doesNotMatch(urls, /admin\/recovery\/|admin\/operations\/|account-requests\/<uuid:request_id>/);
  assert.equal(existsSync(new URL("../api/apps/identity/admin_recovery_assist.py", root)), false);
});

// PRO-21 — espace laboratoire : trois onglets (Scanner, Dépôts, Moi), choisi d'après le contexte du compte, historique filtrable.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const spaces = await import("../src/lib/spaces.ts");
const tour = await import("../src/lib/tour.ts");
const routes = await import("../src/lib/offline-routes.ts");
const history = await import("../src/lib/lab-history.ts");

const LAB = [{ role: "establishment", is_active: true, onboarding_completed: true, is_laboratory: true }];
const CLINIC = [{ role: "establishment", is_active: true, onboarding_completed: true, is_laboratory: false }];

test("l'espace laboratoire a trois onglets : Scanner, Dépôts, Moi — le compte reste « établissement » côté serveur", () => {
  const lab = spaces.SPACES.laboratory;
  assert.deepEqual(lab.tabs.map((tab) => tab.id), ["scanner", "depots", "moi"]);
  assert.deepEqual(lab.tabs.map((tab) => tab.href), ["/laboratoire", "/laboratoire/depots", "/laboratoire/parametres"]);
  assert.equal(lab.role, "establishment");
  assert.equal(lab.home, "/laboratoire");
  assert.equal(lab.tabs.at(-1).id, "moi");
  const [scanner, depots, moi] = lab.tabs;
  assert.ok(scanner.match("/laboratoire") && !scanner.match("/laboratoire/depots"));
  assert.ok(depots.match("/laboratoire/depots") && !depots.match("/laboratoire"));
  assert.ok(moi.match("/laboratoire/parametres"));
  assert.equal(spaces.visibleTabsFor("laboratory", false).length, 3);
});

test("l'espace établissement garde ses cinq onglets, sans rien de laboratoire", () => {
  assert.deepEqual(spaces.SPACES.establishment.tabs.map((tab) => tab.id), ["home", "dossiers", "equipe", "demandes", "parametres"]);
});

test("le shell envoie un laboratoire vers son espace, et un compte qui n'en est pas un ailleurs — sans boucle", () => {
  assert.equal(spaces.isLaboratoryAccount(LAB), true);
  assert.equal(spaces.isLaboratoryAccount(CLINIC), false);
  assert.equal(spaces.isLaboratoryAccount(undefined), false);
  assert.equal(spaces.laboratoryRedirect("establishment", LAB), "/laboratoire");
  assert.equal(spaces.laboratoryRedirect("laboratory", LAB), null);
  assert.equal(spaces.laboratoryRedirect("establishment", CLINIC), null);
  assert.equal(spaces.laboratoryRedirect("laboratory", CLINIC), "/etablissement");
  assert.equal(spaces.laboratoryRedirect("laboratory", [{ role: "patient", is_active: true, onboarding_completed: true }]), "/");
  assert.equal(spaces.laboratoryRedirect("patient", LAB), null);
  assert.equal(spaces.laboratoryRedirect("professional", LAB), null);
});

test("aucun changement de contexte serveur n'est demandé pour l'espace laboratoire", () => {
  const professional = [{ role: "professional", is_active: false, onboarding_completed: true }, { role: "patient", is_active: true, onboarding_completed: true }];
  assert.equal(spaces.contextToActivate("laboratory", professional), null);
  assert.equal(spaces.spaceSwitchTarget("laboratory", LAB), null);
});

test("la visite guidée du laboratoire désigne de vrais onglets", () => {
  const targets = tour.tourSteps("laboratory").map((step) => step.target).filter(Boolean);
  assert.deepEqual(targets, ["nav-scanner", "nav-depots", "account"]);
  for (const target of targets.filter((value) => value.startsWith("nav-"))) assert.ok(spaces.SPACES.laboratory.tabs.some((tab) => `nav-${tab.id}` === target), target);
});

test("hors connexion : les trois écrans du laboratoire sont de vraies pages, tous préparés", () => {
  for (const route of routes.SPACE_ROUTES.laboratory) assert.ok(existsSync(new URL(`../src/app${route}/page.tsx`, import.meta.url)), route);
  for (const tab of spaces.SPACES.laboratory.tabs) assert.ok(routes.SPACE_ROUTES.laboratory.includes(tab.href), tab.href);
});

test("la période relative devient une date de début locale ; « Toute la période » n'en envoie aucune", () => {
  const now = new Date(2026, 10, 13, 15, 0);
  assert.equal(history.periodStart("all", now), undefined);
  assert.equal(history.periodStart("7d", now), "2026-11-06");
  assert.equal(history.periodStart("30d", now), "2026-10-14");
  assert.equal(history.periodStart("90d", now), "2026-08-15");
  assert.equal(history.localDay(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("les lignes sont regroupées par jour local, dans l'ordre reçu, avec Aujourd'hui et Hier", () => {
  const now = new Date(2026, 10, 13, 15, 0);
  const at = (day, hour) => new Date(2026, 10, day, hour, 30).toISOString();
  const rows = [{ id: "a", occurred_at: at(13, 14) }, { id: "b", occurred_at: at(13, 9) }, { id: "c", occurred_at: at(12, 18) }, { id: "d", occurred_at: at(10, 8) }, { id: "x", occurred_at: "pas une date" }];
  const groups = history.groupByDay(rows, now);
  assert.deepEqual(groups.map((group) => group.items.map((item) => item.id)), [["a", "b"], ["c"], ["d"]]);
  assert.deepEqual(groups.map((group) => group.label), ["Aujourd’hui", "Hier", "mardi 10 novembre 2026"]);
  assert.equal(history.timeLabel(at(13, 14)), "14:30");
  assert.equal(history.timeLabel("illisible"), "");
});

test("une ligne d'historique n'a que les initiales et l'année de naissance, jamais le nom", () => {
  assert.equal(history.whoLine({ patient_initials: "A. K.", birth_year: 1990 }), "A. K. · né(e) en 1990");
  assert.equal(history.whoLine({ patient_initials: "A. K.", birth_year: null }), "A. K.");
  assert.equal(history.whoLine({ patient_initials: "", birth_year: null }), "Patient");
  assert.deepEqual(history.LAB_STATUSES, ["deposited", "replaced", "abandoned"]);
  for (const status of history.LAB_STATUSES) assert.ok(history.STATUS_LABEL[status] && history.STATUS_PLURAL[status]);
});

test("câblage : le layout choisit l'espace, le shell redirige, la console établissement ne rend plus le laboratoire", () => {
  assert.match(read("src/app/laboratoire/layout.tsx"), /space="laboratory"/);
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(shell, /laboratoryRedirect\(space, state\.account\.contexts\)/);
  assert.match(shell, /!spaceRedirect/);
  assert.doesNotMatch(read("src/components/EstablishmentConsole.tsx"), /LaboratoryWorkspace/);
  assert.match(read("src/components/EstablishmentSettingsClient.tsx"), /laboratory \? navItems\.filter/);
  assert.match(read("src/components/LaboratoryDeposits.tsx"), /ListSearchBar/);
  assert.match(read("src/components/ThemeBootstrap.tsx"), /\/laboratoire/);
  assert.match(read("src/components/AnonymousVisitorTracker.tsx"), /\/laboratoire/);
});

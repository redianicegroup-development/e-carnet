// Visite guidée de la première connexion : une par espace, mémorisée dans le navigateur, rejouable depuis le menu du compte.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const tour = await import("../src/lib/tour.ts");

function memory(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    keys: () => [...data.keys()],
  };
}

test("chaque espace a sa visite : accueil centré, onglets réels, menu du compte en dernier", () => {
  for (const space of ["patient", "professional", "establishment"]) {
    const steps = tour.tourSteps(space);
    assert.ok(steps.length >= 5 && steps.length <= 8, `${space} : une visite courte`);
    assert.equal(steps[0].target, undefined, `${space} : la première étape est centrée`);
    assert.equal(steps.at(-1).target, "account", `${space} : la dernière étape montre le menu du compte`);
    assert.equal(new Set(steps.map((step) => step.id)).size, steps.length, `${space} : identifiants uniques`);
    for (const step of steps) {
      assert.ok(step.title && step.text && step.tag && step.icon);
      if (step.id !== "welcome") assert.ok(step.target, `${space}/${step.id} désigne un repère`);
    }
  }
});

test("onglets choisis par espace", () => {
  const targets = (space) => tour.tourSteps(space).map((step) => step.target).filter(Boolean);
  assert.deepEqual(targets("patient"), ["nav-home", "nav-carnet", "nav-consultations", "nav-historique", "notifications", "account"]);
  assert.deepEqual(targets("professional"), ["nav-home", "nav-acces", "nav-patients", "nav-consultations", "account"]);
  assert.deepEqual(targets("establishment"), ["nav-home", "nav-equipe", "nav-demandes", "nav-parametres", "account"]);
});

test("les étapes dont l'onglet est masqué sont sautées (professionnel pas encore rattaché)", () => {
  const present = new Set(["nav-home", "nav-acces", "account"]);
  const steps = tour.availableSteps(tour.tourSteps("professional"), (target) => present.has(target));
  assert.deepEqual(steps.map((step) => step.id), ["welcome", "home", "attachment", "account"]);
  assert.equal(tour.availableSteps(tour.tourSteps("patient"), () => true).length, tour.tourSteps("patient").length);
  // tourSteps rend des copies : modifier le résultat ne change pas les textes de référence
  tour.tourSteps("patient")[0].title = "x";
  assert.notEqual(tour.tourSteps("patient")[0].title, "x");
});

test("mémoire : par compte et par espace, effacée avec les données du site", () => {
  assert.equal(tour.tourStorageKey("acc-1", "patient"), "ecarnet.tour.v1.acc-1.patient");
  const storage = memory();
  assert.equal(tour.hasSeenTour(storage, "acc-1", "patient"), false);
  tour.markTourSeen(storage, "acc-1", "patient");
  assert.equal(tour.hasSeenTour(storage, "acc-1", "patient"), true);
  assert.equal(tour.hasSeenTour(storage, "acc-1", "professional"), false, "un autre espace a sa propre visite");
  assert.equal(tour.hasSeenTour(storage, "acc-2", "patient"), false, "un autre compte aussi");
  assert.match(storage.getItem("ecarnet.tour.v1.acc-1.patient"), /^\d{4}-\d{2}-\d{2}$/, "seule une date est conservée");
  tour.resetTour(storage, "acc-1", "patient");
  assert.equal(tour.hasSeenTour(storage, "acc-1", "patient"), false, "« Revoir la visite guidée » la relance");
  // données du site effacées = mémoire vide = la visite reprend
  const cleared = memory();
  assert.equal(tour.hasSeenTour(cleared, "acc-1", "patient"), false);
});

test("sans mémoire utilisable, la visite ne se rejoue pas à chaque page et rien ne plante", () => {
  assert.equal(tour.hasSeenTour(null, "a", "patient"), true);
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  assert.equal(tour.hasSeenTour(broken, "a", "patient"), true);
  assert.doesNotThrow(() => tour.markTourSeen(broken, "a", "patient"));
  assert.doesNotThrow(() => tour.resetTour(broken, "a", "patient"));
  assert.doesNotThrow(() => tour.markTourSeen(null, "a", "patient"));
});

test("placement de la carte : à droite d'une barre latérale, au-dessus d'une barre basse, jamais hors écran", () => {
  const card = { width: 384, height: 260 };
  const desktop = { width: 1280, height: 800 };
  const side = tour.placeCard({ target: { left: 10, top: 120, right: 70, bottom: 170, width: 60, height: 50 }, card, viewport: desktop });
  assert.equal(side.side, "right");
  assert.ok(side.left >= 70 + 16);
  const mobile = { width: 390, height: 780 };
  const bar = tour.placeCard({ target: { left: 120, top: 700, right: 180, bottom: 760, width: 60, height: 60 }, card: { width: 366, height: 250 }, viewport: mobile });
  assert.equal(bar.side, "above");
  assert.ok(bar.top + 250 <= 700 - 16 + 0.5, "la carte ne recouvre pas la barre basse");
  const header = tour.placeCard({ target: { left: 330, top: 6, right: 380, bottom: 56, width: 50, height: 50 }, card: { width: 366, height: 250 }, viewport: mobile });
  assert.equal(header.side, "below");
  const centered = tour.placeCard({ target: null, card, viewport: desktop });
  assert.equal(centered.side, "center");
  for (const place of [side, bar, header, centered]) {
    assert.ok(place.left >= 0 && place.top >= 0);
  }
  assert.ok(bar.left + 366 <= 390 && header.left + 366 <= 390);
  const padded = tour.padRect({ left: 10, top: 10, right: 30, bottom: 30, width: 20, height: 20 }, 6);
  assert.deepEqual(padded, { left: 4, top: 4, right: 36, bottom: 36, width: 32, height: 32 });
});

test("les repères data-tour existent sur les vrais onglets et boutons", () => {
  const sidebar = read("src/components/shell/AppSidebar.tsx");
  assert.match(sidebar, /"data-tour": `nav-\$\{item\.id\}`/);
  assert.match(sidebar, /data-tour="account"/);
  assert.match(read("src/components/shell/GooeyAccountMenu.tsx"), /data-tour="account"/);
  assert.match(read("src/components/notifications/NotificationBell.tsx"), /data-tour="notifications"/);
});

test("la visite est montée dans l'espace, après le choix des cookies, et rejouable depuis le menu du compte", () => {
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(shell, /<ProductTour space=\{space\} accountId=\{state\.account\.id\} \/>/);
  assert.match(shell, /!bare && !passwordChangePending && !profilePending && <ProductTour/, "jamais par-dessus un écran bloquant");
  assert.match(shell, /label: "Revoir la visite guidée"[^}]*TOUR_RESTART_EVENT/);
  const component = read("src/components/tour/ProductTour.tsx");
  assert.match(component, /getAnalyticsConsent\(\) === null\) return/, "attend le choix de la bannière de cookies");
  assert.match(component, /subscribeAnalyticsConsent\(evaluate\)/);
  assert.match(component, /hasSeenTour\(storage, accountId, space\)/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /aria-modal="true"/);
});

test("la mémoire passe par le point d'accès unique au stockage local (themeStorage.ts), sans nouveau cookie", () => {
  assert.match(read("src/components/tour/ProductTour.tsx"), /import \{ deviceStorage \} from "..\/..\/lib\/themeStorage"/);
  assert.match(read("src/lib/themeStorage.ts"), /export function deviceStorage\(\): Storage \| null/);
  assert.doesNotMatch(read("src/components/tour/ProductTour.tsx") + read("src/lib/tour.ts"), /localStorage|sessionStorage|indexedDB/);
});

test("aucun nouveau cookie ni couleur propre ; mouvement réduit respecté", () => {
  assert.doesNotMatch(read("src/lib/tour.ts") + read("src/components/tour/ProductTour.tsx"), /document\.cookie/);
  const css = read("src/components/tour/tour.css");
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, "uniquement les variables de la palette");
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /goo-panel-in/);
  assert.match(css, /@media print/);
});

test("l'aide et la confidentialité expliquent la visite", () => {
  assert.match(read("src/components/help/helpContent.ts"), /Comment revoir la visite guidée \?/);
  assert.match(read("src/app/confidentialite/page.tsx"), /visite guidée/);
});

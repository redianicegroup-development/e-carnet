// Guide « Comment ça marche ? » : le parcours de chaque espace, pas à pas, lancé tout seul pour les deux premières utilisations.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const howto = await import("../src/lib/howto.ts");
const { SPACES } = await import("../src/lib/spaces.ts");

const SPACE_IDS = ["patient", "professional", "establishment", "laboratory"];
const ready = { clinical: true };

function memory(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
  };
}

test("chaque espace a son guide : étapes courtes, identifiants uniques, menu du compte en dernier", () => {
  for (const space of SPACE_IDS) {
    const steps = howto.howToSteps(space, ready);
    assert.ok(steps.length >= 4 && steps.length <= (space === "patient" ? 6 : 5), `${space} : un guide court`);
    assert.equal(new Set(steps.map((step) => step.id)).size, steps.length, `${space} : identifiants uniques`);
    assert.equal(steps.at(-1).target, "account", `${space} : la dernière étape montre le menu du compte`);
    for (const step of steps) assert.ok(step.title && step.text && step.tag && step.icon, `${space}/${step.id} est complet`);
  }
});

test("les étapes suivent les parcours décrits, dans l'ordre", () => {
  const ids = (space) => howto.howToSteps(space, ready).map((step) => step.id);
  assert.deepEqual(ids("patient"), ["prepare", "share", "history", "child", "trusted", "account"], "20/11/2026 : Carnet enfant et Proches de confiance sont expliqués");
  assert.deepEqual(ids("professional"), ["attach", "credentials", "scan", "consult", "account"]);
  assert.deepEqual(ids("establishment"), ["codes", "approve", "records", "account"]);
  assert.deepEqual(ids("laboratory"), ["scan", "deposit", "history", "account"]);
});

test("chaque étape ouvre une vraie page de l'application", () => {
  for (const space of SPACE_IDS) {
    for (const step of howto.howToSteps(space, ready)) {
      if (!step.href) continue;
      assert.match(step.href, /^\/[a-z/-]+$/, `${space}/${step.id} : adresse sans fragment ni paramètre (un #scanner lancerait la caméra)`);
      const page = `src/app${step.href === "/" ? "" : step.href}/page.tsx`;
      assert.ok(existsSync(new URL(`../${page}`, import.meta.url)), `${space}/${step.id} : ${page} existe`);
      assert.ok(step.href.startsWith(`/${SPACES[space].home.split("/")[1]}`), `${space}/${step.id} reste dans son espace`);
    }
  }
});

test("les repères désignés existent vraiment dans l'interface", () => {
  const sidebar = read("src/components/shell/AppSidebar.tsx");
  assert.match(sidebar, /"data-tour": `nav-\$\{item\.id\}`/);
  const markers = {
    "howto-preconsult": "src/components/PatientConsultationFlow.tsx",
    "howto-qr": "src/components/PatientConsultationFlow.tsx",
    "howto-attach": "src/components/ProfessionalAccess.tsx",
    "howto-scan": "src/components/ProfessionalHome.tsx",
    "howto-lab-scan": "src/components/LaboratoryScanner.tsx",
  };
  for (const space of SPACE_IDS) {
    const tabIds = new Set(SPACES[space].tabs.map((tab) => tab.id));
    for (const step of howto.howToSteps(space, ready)) {
      if (!step.target || step.target === "account") continue;
      if (step.target.startsWith("nav-")) assert.ok(tabIds.has(step.target.slice(4)), `${space}/${step.id} : l'onglet ${step.target} existe`);
      else if (step.target.startsWith("settings-")) {
        assert.match(read("src/components/SettingsDirectory.tsx"), /data-tour=\{`settings-\$\{item\.id\}`\}/);
        const settingsFile = space === "patient" ? "AccountSettingsClient" : "ProfessionalSettingsClient";
        assert.match(read(`src/components/${settingsFile}.tsx`), new RegExp(`id: "${step.target.slice(9)}", title: "`), `${space}/${step.id} : la rubrique ${step.target} existe dans les paramètres`);
      } else {
        assert.ok(markers[step.target], `${space}/${step.id} : repère ${step.target} connu`);
        assert.match(read(markers[step.target]), new RegExp(`data-tour="${step.target}"`));
      }
    }
  }
  assert.match(read("src/components/shell/GooeyAccountMenu.tsx"), /data-tour="account"/);
});

test("médecin pas encore rattaché : toutes les étapes restent, celles qui exigent le rattachement s'affichent au centre", () => {
  const locked = howto.howToSteps("professional", { clinical: false });
  const open = howto.howToSteps("professional", ready);
  assert.equal(locked.length, open.length);
  for (const id of ["scan", "consult"]) {
    const before = locked.find((step) => step.id === id);
    const after = open.find((step) => step.id === id);
    assert.equal(before.href, undefined, `${id} : n'ouvre pas une page encore masquée`);
    assert.equal(before.target, undefined, `${id} : ne désigne pas un bouton absent`);
    assert.match(before.text, /dès que votre rattachement est confirmé/);
    assert.ok(after.href && after.target, `${id} : une fois rattaché, page et repère sont là`);
    assert.doesNotMatch(after.text, /dès que votre rattachement est confirmé/);
  }
  for (const id of ["attach", "credentials", "account"]) {
    assert.deepEqual(locked.find((step) => step.id === id), open.find((step) => step.id === id), `${id} ne dépend pas du rattachement`);
  }
  // les autres espaces ne dépendent pas du rattachement
  for (const space of ["patient", "establishment", "laboratory"]) assert.deepEqual(howto.howToSteps(space, { clinical: false }), howto.howToSteps(space, ready));
});

test("les textes disent ce que fait le code (délais et règles réels)", () => {
  const text = (space) => howto.howToSteps(space, ready).map((step) => step.text).join(" ");
  assert.match(text("patient"), /5 minutes/);
  assert.match(text("patient"), /2 h/);
  assert.match(text("patient"), /Seul le motif est obligatoire/);
  assert.match(text("professional"), /48 h/);
  assert.match(text("professional"), /cachet ou votre signature/);
  assert.match(text("establishment"), /48 h/);
  assert.match(text("establishment"), /motif d’ouverture \(obligatoire\)/);
  assert.match(text("laboratory"), /un PDF par examen/);
  // ces valeurs sont celles de l'application
  assert.match(read("src/components/PatientAccessGrants.tsx"), /expire au bout de 5 minutes/);
  assert.match(read("src/components/PatientPreconsultations.tsx"), /Seul le motif est obligatoire/);
  assert.match(read("src/components/ProfessionalAccess.tsx"), /Il est valable 48 h/);
  assert.match(read("src/components/EstablishmentPatientRecords.tsx"), /Choisissez un motif/);
});

test("tourSteps rend des copies : modifier le résultat ne change pas les textes de référence", () => {
  howto.howToSteps("patient", ready)[0].title = "x";
  assert.notEqual(howto.howToSteps("patient", ready)[0].title, "x");
});

test("mémoire : deux utilisations, par compte et par espace, une fois la visite guidée vue", () => {
  assert.equal(howto.howToStorageKey("acc-1", "patient"), "ecarnet.howto.v1.acc-1.patient");
  assert.equal(howto.HOWTO_MAX_RUNS, 2);
  const storage = memory();
  const at = (now, extra = {}) => howto.shouldAutoStartHowTo({ storage, accountId: "acc-1", space: "patient", tourSeen: true, now, ...extra });
  const day = 24 * 60 * 60 * 1000;
  const T0 = 1_700_000_000_000; // une date réelle (le dernier lancement initial vaut 0)
  assert.equal(at(T0), true, "1re utilisation : se lance");
  assert.equal(at(T0, { tourSeen: false }), false, "la visite guidée passe d'abord");
  howto.recordHowToRun(storage, "acc-1", "patient", T0);
  assert.equal(storage.getItem("ecarnet.howto.v1.acc-1.patient"), `1:${T0}`);
  assert.equal(at(T0 + 5 * 60 * 1000), false, "recharger la page 5 minutes plus tard ne consomme pas une utilisation");
  assert.equal(at(T0 + day), true, "2e utilisation : le lendemain");
  howto.recordHowToRun(storage, "acc-1", "patient", T0 + day);
  assert.equal(storage.getItem("ecarnet.howto.v1.acc-1.patient"), `2:${T0 + day}`);
  assert.equal(at(T0 + 9 * day), false, "après deux utilisations, plus de lancement automatique");
  assert.equal(howto.shouldAutoStartHowTo({ storage, accountId: "acc-1", space: "professional", tourSeen: true, now: T0 }), true, "un autre espace a son propre compteur");
  assert.equal(howto.shouldAutoStartHowTo({ storage, accountId: "acc-2", space: "patient", tourSeen: true, now: T0 }), true, "un autre compte aussi");
  // données du site effacées = mémoire vide = le guide reprend
  assert.equal(howto.shouldAutoStartHowTo({ storage: memory(), accountId: "acc-1", space: "patient", tourSeen: true, now: T0 }), true);
});

test("mémoire inutilisable ou illisible : rien ne plante et le guide ne boucle pas", () => {
  const args = { accountId: "a", space: "patient", tourSeen: true, now: 9e12 };
  assert.equal(howto.shouldAutoStartHowTo({ ...args, storage: null }), false);
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  assert.equal(howto.shouldAutoStartHowTo({ ...args, storage: broken }), false);
  assert.doesNotThrow(() => howto.recordHowToRun(broken, "a", "patient", 1));
  assert.doesNotThrow(() => howto.recordHowToRun(null, "a", "patient", 1));
  const unreadable = memory({ "ecarnet.howto.v1.a.patient": "n'importe quoi" });
  assert.equal(howto.shouldAutoStartHowTo({ ...args, storage: unreadable }), false, "valeur illisible = déjà fait");
  const throwingSet = { getItem: () => null, setItem() { throw new Error("quota"); }, removeItem() {} };
  assert.doesNotThrow(() => howto.recordHowToRun(throwingSet, "a", "patient", 1));
  assert.deepEqual(howto.readHowTo(memory(), "a", "patient"), { runs: 0, last: 0 });
});

test("le guide est monté dans l'espace, rejouable depuis le menu du compte, et passe après la visite guidée", () => {
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(shell, /<HowToTour space=\{space\} accountId=\{state\.account\.id\} clinical=\{space === "professional" \? clinicalReady : true\} \/>/);
  assert.match(shell, /!bare && !passwordChangePending && !profilePending && <HowToTour/, "jamais par-dessus un écran bloquant");
  assert.match(shell, /label: "Comment ça marche \?"[^}]*HOWTO_RESTART_EVENT/);
  assert.match(shell, /label: "Revoir la visite guidée"[^}]*TOUR_RESTART_EVENT/, "la visite guidée reste rejouable");
  const component = read("src/components/tour/HowToTour.tsx");
  assert.match(component, /getAnalyticsConsent\(\) !== null/, "attend le choix de la bannière de cookies");
  assert.match(component, /hasSeenTour\(storage, accountId, space\)/, "attend la fin de la visite guidée");
  assert.match(component, /addEventListener\(TOUR_FINISHED_EVENT/);
  assert.match(component, /recordHowToRun\(/);
  assert.match(component, /router\.push\(step\.href\)/, "chaque étape ouvre sa page");
  assert.match(component, /router\.push\(back\)/, "on revient là où l'on était");
  assert.match(component, /event\.key === "Escape"/);
  assert.match(read("src/components/tour/ProductTour.tsx"), /window\.dispatchEvent\(new Event\(TOUR_FINISHED_EVENT\)\)/);
  assert.match(component, /import \{ deviceStorage \} from "..\/..\/lib\/themeStorage"/, "mémoire via le point d'accès unique, sans nouveau cookie");
});

test("aucun nouvel accès direct au stockage du navigateur (test legal) ; l'aide et la confidentialité décrivent le guide", () => {
  for (const file of ["src/lib/howto.ts", "src/components/tour/HowToTour.tsx"]) assert.doesNotMatch(read(file), /\b(localStorage|sessionStorage|indexedDB)\b/, file);
  assert.match(read("src/app/confidentialite/page.tsx"), /guide « Comment ça marche \? »/);
  assert.match(read("src/components/help/helpContent.ts"), /guide « Comment ça marche \? »/);
});

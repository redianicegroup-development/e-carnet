// Navigation mobile (03/11/2026) : 5e onglet « Moi » du patient, 3e onglet en évidence (couleur miel de la palette choisie),
// pages ouvertes tout en haut depuis « Aide », « En savoir plus » et la barre de navigation.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const spaces = await import("../src/lib/spaces.ts");
const rules = await import("../src/lib/scroll-to-top.ts");
const ids = (tabs) => tabs.map((tab) => tab.id);

/* ---------- onglets ---------- */
test("patient : cinq onglets dont Moi en dernier ; Moi est un onglet « compte » (masqué sur grand écran)", () => {
  assert.deepEqual(ids(spaces.visibleTabsFor("patient", false)), ["home", "carnet", "consultations", "historique", "moi"]);
  assert.deepEqual(ids(spaces.visibleTabsFor("patient", true)), ["home", "carnet", "consultations", "historique", "moi"]);
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(shell, /account: tab === moi, featured: tab\.featured === true/);
  assert.match(read("src/components/shell/sidebar.css"), /\.sb__item--account \{ display: none; \}/, "sur grand écran le compte est dans le menu de la sidebar");
  const patientMoi = spaces.SPACES.patient.tabs.find((tab) => tab.id === "moi");
  assert.equal(patientMoi.href, "/patient/parametres");
  assert.equal(patientMoi.match("/patient/parametres/profil"), true);
});

test("le 3e onglet de chaque espace est l'onglet principal : Consultations (patient) et Suivi (professionnel) ; aucun autre n'est en évidence", () => {
  const featuredOf = (space, ready) => spaces.visibleTabsFor(space, ready).map((tab, index) => (tab.featured ? `${index}:${tab.id}` : null)).filter(Boolean);
  assert.deepEqual(featuredOf("patient", false), ["2:consultations"]);
  assert.deepEqual(featuredOf("professional", true), ["2:consultations"]);
  assert.deepEqual(featuredOf("professional", false), [], "médecin sans rattachement actif : seulement Accueil et Rattachement, rien en évidence");
  assert.deepEqual(featuredOf("establishment", true), []);
  assert.equal(spaces.SPACES.patient.tabs[2].label, "Consultations");
  assert.equal(spaces.SPACES.professional.tabs[2].label, "Suivi");
});

test("AppSidebar : l'onglet principal porte sa classe et sa pastille ; toute la navigation est une zone de retour en haut", () => {
  const sidebar = read("src/components/shell/AppSidebar.tsx");
  assert.match(sidebar, /featured\?: boolean/);
  assert.match(sidebar, /\$\{item\.featured \? " sb__item--featured" : ""\}/);
  assert.match(sidebar, /item\.featured \? <span className="sb__orb" aria-hidden="true" \/> : null/);
  assert.match(sidebar, /<nav className=\{`sb[^`]*`\} aria-label=\{ariaLabel\} data-scroll-top="true">/);
});

test("pastille de l'onglet principal : couleur miel du thème (jamais une teinte fixe), mobile seulement, sans pseudo-élément", () => {
  const css = strip(read("src/app/soft-skin.css"));
  const media = css.slice(css.indexOf("body .sb__orb { display: none; }"));
  const block = media.slice(0, media.indexOf("/* Sidebar desktop") === -1 ? media.indexOf("@media (min-width: 920px)") : media.indexOf("@media (min-width: 920px)"));
  assert.match(block, /@media \(max-width: 919px\) \{/);
  assert.match(block, /body \.sb__item--featured \.sb__orb \{ display: block;[^}]*background: var\(--orb-honey\);/);
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b|\byellow\b|\bgold\b|\bamber\b/i, "aucune teinte écrite en dur : la couleur suit la palette");
  assert.doesNotMatch(css, /::before|::after/, "la peau reste sans pseudo-élément (règle de goo.css)");
  // actif : la goutte d'accent entoure la pastille ; l'icône reste lisible sur le miel
  assert.match(block, /\.sb__item\.sb__item--featured\.is-active \{ background: transparent; box-shadow: none; \}/);
  assert.match(block, /\.sb__item\.sb__item--featured\.is-active \{ color: var\(--text\); \}|\.sb__item\.sb__item--featured\.is-active \{ color: var\(--text\)/);
  // pas de pastille sur grand écran
  const desktop = css.slice(css.indexOf("@media (min-width: 920px)"));
  assert.doesNotMatch(desktop.slice(0, desktop.indexOf("/* Barre haute mobile")), /sb__orb|sb__item--featured/);
  // la couleur « miel » vient bien des couleurs choisies par la personne
  const tokens = read("../../packages/ui/src/styles/tokens.css");
  assert.match(tokens, /--tone-honey-1: var\(--brand-2\);/);
  assert.match(tokens, /--tone-honey-2: var\(--brand-3\);/);
  assert.match(tokens, /--orb-honey: linear-gradient\(145deg, var\(--tone-honey-1\), var\(--tone-honey-2\)\);/);
  assert.match(read("../../packages/ui/src/themes.ts"), /"--brand-1": c1, "--brand-2": c2, "--brand-3": c3/);
});

/* ---------- retour en haut : règles ---------- */
const base = "https://ecarnet.test/patient";
const click = (overrides = {}) => ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, href: "https://ecarnet.test/aide", base, target: "", download: false, ...overrides });

test("retour en haut : une autre page est retenue ; la page courante remonte sans repère", () => {
  assert.deepEqual(rules.decideScrollOnClick(click()), { action: "scroll", remember: "/aide" });
  assert.deepEqual(rules.decideScrollOnClick(click({ href: "https://ecarnet.test/patient/consultations?a=1" })), { action: "scroll", remember: "/patient/consultations" });
  assert.deepEqual(rules.decideScrollOnClick(click({ href: "https://ecarnet.test/patient" })), { action: "scroll", remember: null });
  assert.deepEqual(rules.decideScrollOnClick(click({ target: "_self" })), { action: "scroll", remember: "/aide" });
});

test("retour en haut : ancres, nouvel onglet, téléchargement, autre site, touches et clic non principal sont laissés tels quels", () => {
  const ignored = [
    click({ href: "https://ecarnet.test/aide#donnees" }),
    click({ target: "_blank" }),
    click({ download: true }),
    click({ href: "https://autre-site.test/aide" }),
    click({ metaKey: true }), click({ ctrlKey: true }), click({ shiftKey: true }), click({ altKey: true }),
    click({ button: 1 }), click({ button: 2 }),
    click({ href: "pas une adresse", base: "pas une base" }),
  ];
  for (const input of ignored) assert.deepEqual(rules.decideScrollOnClick(input), { action: "ignore" }, JSON.stringify(input));
});

test("repère de défilement : retenu 10 s, jamais perdu avant le changement d'adresse, jamais appliqué à une autre page", () => {
  const NOW = 1_000_000;
  const raw = rules.serializePendingScroll("/aide", NOW);
  assert.equal(rules.readPendingScroll(raw, "/aide", NOW + 50), "scroll");
  assert.equal(rules.readPendingScroll(raw, "/patient", NOW + 50), "other-page");
  assert.equal(rules.readPendingScroll(raw, "/aide", NOW + rules.PENDING_SCROLL_MAX_AGE_MS + 1), "expired");
  assert.equal(rules.readPendingScroll(null, "/aide", NOW), "none");
  for (const bad of ["pas du json", "null", "42", JSON.stringify({ pathname: 3, createdAt: NOW }), JSON.stringify({ pathname: "/aide", createdAt: "x" }), JSON.stringify({ pathname: "/aide" })]) {
    assert.equal(rules.readPendingScroll(bad, "/aide", NOW), "invalid", bad);
  }
  assert.equal(rules.SCROLL_TOP_ZONES, '[data-footer-zone="true"], [data-scroll-top="true"]');
});

/* ---------- retour en haut : le vrai composant, sur un faux navigateur ---------- */
function mountScroll({ pathname = "/patient", pending = null } = {}) {
  class FakeElement { constructor(props = {}) { Object.assign(this, props); } closest(selector) { return this.matches?.(selector) ? this : this.parent?.closest?.(selector) ?? null; } }
  const frames = [];
  const scrolls = [];
  const store = new Map(pending ? [["ecarnet:pending-footer-scroll", pending]] : []);
  const listeners = {};
  const effects = [];
  Object.defineProperty(globalThis, "Element", { value: FakeElement, configurable: true, writable: true });
  Object.defineProperty(globalThis, "document", { value: { addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener: (type) => { delete listeners[type]; } }, configurable: true, writable: true });
  Object.defineProperty(globalThis, "window", {
    value: {
      location: { href: `https://ecarnet.test${pathname}`, pathname },
      sessionStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => { store.set(key, value); }, removeItem: (key) => { store.delete(key); } },
      scrollTo: (options) => { scrolls.push(options); },
      requestAnimationFrame: (fn) => { frames.push(fn); return frames.length; },
      cancelAnimationFrame: () => {},
    },
    configurable: true, writable: true,
  });
  const lib = rules;
  const component = loadTs("src/components/ScrollToTopOnNavigate.tsx", {
    react: { useEffect: (fn) => { effects.push(fn); } },
    "next/navigation": { usePathname: () => pathname },
    "../lib/scroll-to-top": lib,
  });
  component.ScrollToTopOnNavigate();
  const cleanups = effects.map((effect) => effect());
  const flush = () => { while (frames.length) frames.shift()(); };
  const zone = (attribute) => new FakeElement({ matches: (selector) => selector.includes(attribute) });
  const linkIn = (zoneNode, href, extra = {}) => new FakeElement({ href, target: "", hasAttribute: () => false, parent: zoneNode, matches: (selector) => selector === "a[href]", ...extra });
  const press = (target, init = {}) => listeners.click?.({ target, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...init });
  return { scrolls, store, flush, zone, linkIn, press, cleanups, listening: () => typeof listeners.click === "function" };
}
const KEY = "ecarnet:pending-footer-scroll";

test("composant : un lien de la barre de navigation vers une autre page remonte aussitôt et retient la destination", () => {
  const page = mountScroll({ pathname: "/patient" });
  assert.equal(page.listening(), true);
  const nav = page.zone("data-scroll-top");
  page.press(page.linkIn(nav, "https://ecarnet.test/patient/consultations"));
  assert.deepEqual(page.scrolls, [{ top: 0, left: 0, behavior: "instant" }]);
  assert.equal(JSON.parse(page.store.get(KEY)).pathname, "/patient/consultations");
});

test("composant : même page → remonte et efface un repère périmé ; pied de page public couvert comme avant", () => {
  const page = mountScroll({ pathname: "/patient", pending: JSON.stringify({ pathname: "/vieux", createdAt: Date.now() }) });
  page.press(page.linkIn(page.zone("data-scroll-top"), "https://ecarnet.test/patient"));
  assert.equal(page.scrolls.length, 1);
  const stored = page.store.get(KEY);
  assert.ok(stored === undefined || JSON.parse(stored).pathname !== "/vieux", "l'ancien repère ne doit pas survivre");
  const footer = mountScroll({ pathname: "/aide" });
  footer.press(footer.linkIn(footer.zone("data-footer-zone"), "https://ecarnet.test/cgu"));
  assert.equal(footer.scrolls.length, 1);
  assert.equal(JSON.parse(footer.store.get(KEY)).pathname, "/cgu");
});

test("composant : hors zone, avec ancre, nouvel onglet ou autre site → aucun défilement ni repère", () => {
  const page = mountScroll({ pathname: "/patient" });
  const outside = page.linkIn(null, "https://ecarnet.test/aide");
  page.press(outside);
  const nav = page.zone("data-scroll-top");
  page.press(page.linkIn(nav, "https://ecarnet.test/aide#donnees"));
  page.press(page.linkIn(nav, "https://ecarnet.test/aide", { target: "_blank" }));
  page.press(page.linkIn(nav, "https://autre-site.test/aide"));
  page.press(page.linkIn(nav, "https://ecarnet.test/aide"), { ctrlKey: true });
  page.press({ notAnElement: true });
  assert.equal(page.scrolls.length, 0);
  assert.equal(page.store.has(KEY), false);
});

test("composant : la page de destination (re)montée remonte en haut après deux images, puis efface le repère", () => {
  const page = mountScroll({ pathname: "/aide", pending: JSON.stringify({ pathname: "/aide", createdAt: Date.now() }) });
  assert.equal(page.scrolls.length, 0, "pas avant la fin de la transition");
  page.flush();
  assert.deepEqual(page.scrolls, [{ top: 0, left: 0, behavior: "instant" }]);
  assert.equal(page.store.has(KEY), false);
});

test("composant : le repère attend la bonne page, et un repère périmé ou illisible est supprimé sans défilement", () => {
  const early = mountScroll({ pathname: "/patient", pending: JSON.stringify({ pathname: "/aide", createdAt: Date.now() }) });
  early.flush();
  assert.equal(early.scrolls.length, 0);
  assert.equal(JSON.parse(early.store.get(KEY)).pathname, "/aide", "le routeur n'a pas encore changé l'adresse : le repère est gardé");
  const expired = mountScroll({ pathname: "/aide", pending: JSON.stringify({ pathname: "/aide", createdAt: Date.now() - 60_000 }) });
  expired.flush();
  assert.equal(expired.scrolls.length, 0);
  assert.equal(expired.store.has(KEY), false);
  const broken = mountScroll({ pathname: "/aide", pending: "{pas du json" });
  broken.flush();
  assert.equal(broken.scrolls.length, 0);
  assert.equal(broken.store.has(KEY), false);
});

/* ---------- les trois cas signalés ---------- */
test("lien « Aide » de l'espace : ouvre le haut de la page d'aide (plus d'ancre #donnees), comme le pied de page", () => {
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(shell, /<p className="space-footer" data-scroll-top="true"><Link href="\/aide">Aide<\/Link><\/p>/);
  assert.doesNotMatch(shell, /\/aide#donnees/);
  assert.match(shell, /<ScrollToTopOnNavigate \/>/);
});

test("« En savoir plus » : tous ses liens (aide, à propos, légal, crédits) ouvrent la page en haut", () => {
  const more = read("src/components/SettingsMoreSection.tsx");
  assert.match(more, /<section className="settings-more-content"[^>]*data-scroll-top="true">/);
  assert.ok([...more.matchAll(/href: "(\/[a-z-]+)"/g)].length >= 7, "toutes les pages sont dans la zone");
  assert.match(read("src/components/shell/GooeyAccountMenu.tsx"), /<div className="gm" ref=\{root\} data-open=\{open\} data-scroll-top="true">/);
});

test("une seule logique de retour en haut : pages publiques et espaces utilisent le même composant (l'ancien est supprimé)", () => {
  assert.equal(fs.existsSync(new URL("../src/components/public/PublicFooterScrollToTop.tsx", import.meta.url)), false);
  const publicShell = read("src/components/public/PublicShell.tsx");
  assert.match(publicShell, /import \{ ScrollToTopOnNavigate \} from "\.\.\/ScrollToTopOnNavigate";/);
  assert.match(publicShell, /<footer className="pub-footer" data-footer-zone="true">/);
  assert.doesNotMatch(read("src/lib/scroll-to-top.ts"), /sessionStorage|localStorage/, "la logique pure ne touche pas au stockage : le composant s'en charge");
});

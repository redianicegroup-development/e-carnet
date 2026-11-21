import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* Lot du 20/11/2026 (2) : en-tête des pages publiques, délégations révoquées, bienvenue, menu et bandeau hors connexion, guide, largeur des menus. */
const root = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");

test("pages publiques, visiteur connecté : « Retour » à gauche, logo centré, plus de recouvrement", () => {
  const header = read("src/components/public/PublicHeader.tsx");
  assert.match(header, /<Link className="pub-return-link" href=\{state\.href\} aria-label="Retour à mon espace">[\s\S]*?Retour\s*<\/Link>/);
  assert.doesNotMatch(header, /\n\s*Retour à mon espace\n/, "le texte visible est « Retour » ; le nom accessible reste complet");
  assert.match(read("src/app/site-pages.css"), /\.pub-header \.brand \{ position: fixed; z-index: 1;[^}]*left: 50%/, "le logo reste centré");
});

test("proches de confiance : une délégation révoquée disparaît de la liste", () => {
  const source = read("src/components/TrustedContactDelegationClient.tsx");
  assert.match(source, /const current = items\.filter\(\(item\) => item\.status !== "revoked"\)/);
  assert.match(source, /current\.map\(\(item\) =>/);
});

test("message de bienvenue : l'astérisque jaune du héro remplace les étoiles vertes", () => {
  const greeting = read("src/components/modal/GreetingModal.tsx");
  assert.doesNotMatch(greeting, /✦/);
  assert.equal((greeting.match(/M12 2\.5v19M3\.8 7\.2l16\.4 9\.6M20\.2 7\.2 3\.8 16\.8/g) ?? []).length, 2, "le même tracé que le héro, deux fois");
  assert.match(read("src/components/modal/modal.css"), /\.greeting-toast__spark \{[^}]*stroke: var\(--brand-3, #f2b632\)/);
});

test("menu plein écran : son haut commence sous le bandeau « hors connexion »", () => {
  assert.match(read("src/app/site-pages.css"), /\.pub-menu \{ --fs:[^}]*padding: calc\(var\(--net-banner-h, 0px\) \+ max\(14px, env\(safe-area-inset-top\)\)\)/);
});

test("guide : la pré-consultation explique le choix du profil, et le projecteur suit les changements de hauteur de la page", () => {
  const howto = read("src/lib/howto.ts");
  assert.match(howto, /Si vous avez un carnet enfant, choisissez d’abord le profil dans « Pour qui est cette consultation \? »/);
  const tour = read("src/components/tour/ProductTour.tsx");
  assert.match(tour, /new ResizeObserver\(\(\) => layout\(\)\)/);
  assert.match(tour, /observer\?\.observe\(document\.body\)/);
  assert.match(tour, /observer\?\.disconnect\(\)/);
});

test("barre latérale : le menu du compte a la même largeur que le panneau de notifications", () => {
  assert.match(read("src/lib/popover-width.ts"), /SIDEBAR_POPOVER_MAX_WIDTH = 360/);
  const sidebar = read("src/components/shell/AppSidebar.tsx");
  assert.match(sidebar, /Math\.min\(SIDEBAR_POPOVER_MAX_WIDTH, window\.innerWidth - rect\.left - 12\)/);
  assert.doesNotMatch(sidebar, /: host\.clientWidth;/, "plus limité à la largeur de la barre latérale");
  assert.match(read("src/components/notifications/NotificationBell.tsx"), /const PANEL_MAX_WIDTH = SIDEBAR_POPOVER_MAX_WIDTH/);
});

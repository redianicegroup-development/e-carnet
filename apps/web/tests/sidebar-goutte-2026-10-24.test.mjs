// Cloche et menu du compte de la barre latérale PC : la même goutte gooey que l'en-tête mobile, une seule mécanique.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const sidebar = read("src/components/shell/sidebar.css");
const bellCss = read("src/components/notifications/notification-bell.css");
const bell = read("src/components/notifications/NotificationBell.tsx");
const block = sidebar.slice(sidebar.indexOf("Cloche et menu du compte de la barre latérale"));

test("la barre latérale PC affiche la cloche et le menu du compte avec les classes gm__* de l'en-tête", () => {
  // soft-skin.css cache `.gm` sur PC (l'en-tête mobile disparaît) : la barre latérale le réaffiche explicitement
  assert.match(read("src/app/soft-skin.css"), /@media \(min-width: 920px\) \{ body \.gm \{ display: none; \} \}/);
  assert.match(block, /@media \(min-width: 920px\)/);
  assert.match(block, /body \.sb \.gm \{[^}]*display: block/);
  for (const part of ["gm__goo", "gm__anchor", "gm__blob", "gm__panel", "gm__content", "gm__trigger"]) assert.match(block, new RegExp(part));
});

test("la goutte s'ouvre vers le haut (barre dépliée) ou vers la droite (rail replié), avec le même ressort que l'en-tête", () => {
  assert.match(block, /--gm-dy: calc\(-1 \* \(var\(--gm-hh\)/);
  assert.match(block, /body \.sb\.is-collapsed \.gm \{[^}]*--gm-dx: var\(--gm-shift\); --gm-dy: 0px/);
  assert.match(block, /translate\(var\(--gm-dx\), var\(--gm-dy\)\)/);
  // le calque filtré n'existe qu'à l'ouverture : la goutte de départ ne dépasse jamais de la ligne fermée
  assert.match(block, /\.gm__goo \{[^}]*opacity: 0; visibility: hidden/);
  // le contenu net est ancré en bas à gauche : il se découvre sans glisser
  assert.match(block, /\.gm__content \{[^}]*bottom: 0; left: 0/);
});

test("plus aucune ancienne règle de goutte parallèle : une seule mécanique pour la cloche et le menu du compte", () => {
  assert.doesNotMatch(bellCss, /notification-bell__(goo|anchor|blob)/);
  assert.doesNotMatch(bellCss, /min-width: 920px/);
  assert.doesNotMatch(bellCss, /data-placement="sidebar"/);
  assert.doesNotMatch(bell, /--nb-h/);
  assert.doesNotMatch(sidebar.replace(block, ""), /gm--sidebar/);
});

test("la cloche de la barre latérale a un libellé (barre dépliée) et s'ancre à gauche du bouton", () => {
  assert.match(bell, /className="notification-bell__label">Notifications</);
  assert.match(bellCss, /\.notification-bell__label \{ display: none; \}/);
  assert.match(bell, /if \(placement === "sidebar"\)[\s\S]*align: "left"/);
  assert.match(block, /\.notification-bell__label \{ display: block/);
});

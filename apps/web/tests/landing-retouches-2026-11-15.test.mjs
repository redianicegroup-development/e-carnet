// Retouches du 15/11/2026 (3e demande) : modal « Partager en QR » responsive, pastille du héro retirée, carrés du titre agrandis,
// image de la section Solution plafonnée, liens de navigation de l'en-tête centrés.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("le héro n'a plus la pastille « Carnet de santé numérique » (page et contenu)", () => {
  assert.doesNotMatch(read("src/app/page.tsx"), /HERO\.eyebrow|className="eyebrow" data-hero-item/);
  assert.doesNotMatch(read("src/lib/landing-content.ts"), /Carnet de santé numérique/);
});

test("les carrés de photos : chacun sa taille (--t), plus petits sur mobile, tous rendus par la même règle", () => {
  const css = read("src/app/landing-showcase.css");
  assert.match(css, /\.lp-hero__slot \{ --t: 110px; position: absolute;[^}]*width: var\(--t\); height: var\(--t\);/);
  for (const slot of ["a", "b", "c", "d", "media"]) assert.match(css, new RegExp(`\\.lp-hero__slot--${slot} \\{ --t:`));
  const mobile = css.slice(css.indexOf("@media (max-width: 759px)"));
  assert.match(mobile, /\.lp-hero__slot--a \{ --t: 24vw;/);
  assert.match(mobile, /\.lp-hero__mark \{[^}]*font-size: clamp\(2\.8rem, 17\.5vw, 5\.6rem\)/);
});

test("« Partager en QR » : fenêtre de 680 px sur ordinateur (QR à gauche, détails à droite), empilée dessous de 720 px, jamais coupée", () => {
  const css = read("src/components/access/access-history.css");
  assert.match(css, /@media \(min-width: 720px\) \{\s*\.modal-dialog\.share-qr-dialog \{ width: min\(100%, 680px\)/);
  assert.match(css, /\.share-qr-dialog \.patient-active-qr \{ flex-direction: row/);
  assert.match(css, /\.share-qr-dialog \.patient-active-qr__countdown \{ white-space: nowrap/);
  assert.match(css, /max-height: 700px\) \{[^}]*patient-active-qr__code svg \{ width: 148px/);
  assert.match(read("src/components/modal/modal.css"), /\.modal-dialog \{[^}]*max-height: min\(92dvh, 720px\)[^}]*overflow: auto/, "si l'écran est très bas, la fenêtre défile");
});

test("section Solution : l'image main + téléphone est plafonnée à 440 px et à 64 % de la hauteur d'écran, mobile inchangé", () => {
  const css = read("src/app/landing-v2.css");
  assert.match(css, /\.lp2-solution \.lp2-hand-stack \{width:min\(100%,440px,calc\(64svh \* \.7075 \+ 68px\)\)\}/);
  assert.match(css, /\.lp2-hand-stack, \.lp2-solution \.lp2-hand-stack \{width:min\(86vw,420px\)\}/);
  assert.match(css, /\.lp2-flow-phone \.lp2-hand-stack \{[^}]*width:min\(100%,420px\)/, "les trois étapes gardent leur taille");
});

test("en-tête public : le logo seul, sans fond ni nom, et un bouton à trois traits fixé en bas sur tous les écrans", () => {
  const css = read("src/app/site-pages.css");
  const header = read("src/components/public/PublicHeader.tsx");
  assert.match(css, /\.pub-header \{ position: relative; z-index: 20; height: 0; \}/, "pas de barre : le logo flotte sans arrière-plan");
  assert.match(css, /\.pub-header:not\(\.pub-header--connected\) \.brand \{ position: absolute;/);
  assert.doesNotMatch(css, /\.pub-header:not\(\.pub-header--connected\) \{ display: grid; grid-template-columns/);
  assert.match(css, /\.pub-burger \{ position: fixed; z-index: 840; left: 50%; bottom: calc\(18px \+ env\(safe-area-inset-bottom\)\);/);
  const brand = header.slice(header.indexOf('className="pub-header"'), header.indexOf("</header>"));
  assert.doesNotMatch(brand, /Mon E[‑-]Carnet<\/span>/, "le logo de l'en-tête n'a pas de nom écrit à côté");
});

test("menu public : liens sans Sécurité, langues Google Translate, e-mail / WhatsApp / Facebook et © 2026", () => {
  const header = read("src/components/public/PublicHeader.tsx");
  for (const href of ["/#parcours", "/#profils", "/#questions", "/a-propos", "/#contact", "/connexion"]) assert.ok(header.includes(`href="${href}"`), href);
  assert.ok(!header.includes('href="/securite"'), "Sécurité ne figure pas dans le menu");
  assert.match(header, /useLanguageChooser\(\)/);
  assert.match(header, /LANGUAGES\.map/);
  assert.match(header, /socialLinks\(\)/);
  assert.match(header, /© 2026/);
  const social = read("src/lib/social.ts");
  for (const id of ['"email"', '"whatsapp"', '"facebook"']) assert.ok(social.includes(id), id);
  assert.match(social, /NEXT_PUBLIC_FACEBOOK_URL/);
});

test("pied de page : e-mail, WhatsApp et Facebook à la place de l'aide et de la sécurité", () => {
  const shell = read("src/components/public/PublicShell.tsx");
  const icons = shell.slice(shell.indexOf('className="pub-footer__icons"'), shell.indexOf("</nav>", shell.indexOf('className="pub-footer__icons"')));
  assert.match(icons, /socialLinks\(\)/);
  assert.doesNotMatch(icons, /name="help"|name="shield"/);
});

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

test("les carrés du titre : même côté en « em » (ils suivent la taille du titre), deux diaporamas inclinés et un carré vide pour la grande image", () => {
  const css = read("src/app/landing-hero.css");
  assert.match(css, /\.lp-hero__slot \{ --t: \.98em; position: relative; display: inline-block;/);
  assert.match(css, /\.lp-hero__slot--a \{ rotate: -6deg; \}/);
  assert.match(css, /\.lp-hero__slot--b \{ rotate: 5deg; \}/);
  assert.match(css, /\.lp-hero h1 \{[^}]*font-size: clamp\(2rem, min\(8\.4vw, 9\.2svh\), 6\.6rem\)/);
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

test("en-tête public : le logo seul, centré en haut, sans fond ni nom, et un bouton à trois traits fixé en bas sur tous les écrans", () => {
  const css = read("src/app/site-pages.css");
  const header = read("src/components/public/PublicHeader.tsx");
  assert.match(css, /\.pub-header \{ position: relative; z-index: 20; height: 0; \}/, "pas de barre : le logo flotte sans arrière-plan");
  assert.match(css, /\.pub-header \.brand \{ position: absolute; top: [^}]*left: 50%; transform: translateX\(-50%\); \}/, "logo centré, sur toutes les pages publiques");
  assert.doesNotMatch(css, /\.pub-header--connected \{[^}]*(background|backdrop-filter)/, "pas de fond non plus pour un visiteur connecté");
  assert.match(css, /\.pub-return-link \{ position: absolute;/, "« Retour à mon espace » flotte à gauche du logo");
  assert.match(css, /\.pub-burger \{ position: fixed; z-index: 840; left: 50%; bottom: calc\(18px \+ env\(safe-area-inset-bottom\)\);/);
  const brand = header.slice(header.indexOf('className="pub-header"'), header.indexOf("</header>"));
  assert.doesNotMatch(brand, /Mon E[‑-]Carnet<\/span>/, "le logo de l'en-tête n'a pas de nom écrit à côté");
  const connected = header.slice(header.indexOf('className="pub-header pub-header--connected"'), header.indexOf("</header>", header.indexOf('className="pub-header pub-header--connected"')));
  assert.match(connected, /className="brand"/, "le visiteur connecté voit aussi le logo centré");
});

test("menu plein écran : sur ordinateur les liens sont centrés (plus d'escalier), le losange ne décale pas le mot", () => {
  const css = read("src/app/site-pages.css");
  assert.doesNotMatch(css, /--off/, "plus de décalage en escalier");
  assert.match(css, /@media \(min-width: 900px\) \{\s*\.pub-nav__link \{ justify-content: center; text-align: center; \}/);
  assert.match(css, /\.pub-nav__dot \{ position: absolute; left: calc\(100% \+ \.16em\);/);
  assert.match(read("src/components/public/PublicHeader.tsx"), /<span className="pub-nav__text">\{children\}<span className="pub-nav__dot" aria-hidden="true" \/><\/span>/);
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
